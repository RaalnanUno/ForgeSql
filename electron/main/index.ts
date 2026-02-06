// File: electron/main/index.ts
import util from "util";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

import type { SqlServerConnectionProfile } from "../shared/types";
import { openDb, closeDb, queryText, buildOdbcConnectionString, query } from "./db/sqlserver";
import { listDatabasesSql, listTablesSql, listViewsSql, describeTableSql, primaryKeySql } from "./db/queries";

let win: BrowserWindow | null = null;

function formatError(e: any): string {
  if (!e) return "Unknown error (empty).";
  if (typeof e === "string") return e;

  const msg = e?.message ? String(e.message) : "";
  if (msg && msg !== "[object Object]") return msg;

  const nestedMsg =
    e?.originalError?.message ??
    e?.cause?.message ??
    e?.innerError?.message ??
    e?.error?.message;

  if (nestedMsg) return String(nestedMsg);

  const bits = [
    e.code ? `code=${e.code}` : null,
    e.number ? `number=${e.number}` : null,
    e.state ? `state=${e.state}` : null,
    e.class ? `class=${e.class}` : null,
    e.serverName ? `server=${e.serverName}` : null,
    e.sqlstate ? `sqlstate=${e.sqlstate}` : null,
  ].filter(Boolean);

  try {
    const dump = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
    return bits.length ? `${bits.join(", ")}\n${dump}` : dump;
  } catch {
    return bits.length ? bits.join(", ") : String(e);
  }
}

function splitFullName(fullName: string): { schema: string; table: string } {
  const raw = (fullName ?? "").trim();
  const parts = raw.split(".");
  if (parts.length === 2) return { schema: parts[0], table: parts[1] };
  return { schema: "dbo", table: raw };
}

// conservative identifier validation: dbo, TableName, ColumnName, etc.
function isSafeIdent(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test((s ?? "").trim());
}

function qIdent(name: string): string {
  const n = (name ?? "").trim();
  if (!isSafeIdent(n)) throw new Error(`Unsafe identifier: ${name}`);
  // bracket quoting for SQL Server (safe for reserved words too)
  return `[${n}]`;
}

function qFullName(fullName: string): { schema: string; table: string; sql: string } {
  const { schema, table } = splitFullName(fullName);
  if (!isSafeIdent(schema) || !isSafeIdent(table)) throw new Error(`Unsafe table name: ${fullName}`);
  return { schema, table, sql: `${qIdent(schema)}.${qIdent(table)}` };
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await win.loadURL(devUrl);
  else await win.loadFile(path.join(__dirname, "../../../reactui/dist/index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await closeDb();
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("db:open", async (_evt, args: { profile: SqlServerConnectionProfile }) => {
  try {
    await openDb(args.profile);

    const used =
      (args.profile.connectionString ?? "").trim() ||
      buildOdbcConnectionString(args.profile).connectionString;

    return { ok: true, connectionString: used };
  } catch (e: any) {
    console.error("db:open failed raw:", e);
    console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));
    if (e?.originalError) console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
    if (e?.cause) console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:close", async () => {
  try {
    await closeDb();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:listDatabases", async () => {
  try {
    const r = await queryText(listDatabasesSql);
    const databases = r.rows.map((x) => String(x[0]));
    return { ok: true, databases };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:listTables", async () => {
  try {
    const r = await queryText(listTablesSql);
    const tables = r.rows.map((x) => String(x[0]));
    return { ok: true, tables };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:listViews", async () => {
  try {
    const r = await queryText(listViewsSql);
    const views = r.rows.map((x) => String(x[0]));
    return { ok: true, views };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:query", async (_evt, args: { sql: string }) => {
  try {
    const r = await queryText(args.sql);
    return { ok: true, result: { columns: r.columns, rows: r.rows }, rowCount: r.rowCount };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:describeTable", async (_evt, args: { fullName: string }) => {
  try {
    const { schema, table } = splitFullName(args.fullName);
    if (!isSafeIdent(schema) || !isSafeIdent(table)) throw new Error(`Unsafe table name: ${args.fullName}`);

    const r = await query(describeTableSql(schema, table), { schema, table });

    const cols = (r.recordset ?? []).map((x: any) => ({
      name: String(x.name),
      dataType: String(x.dataType),
      isNullable: !!x.isNullable,
      maxLength: x.maxLength === null || x.maxLength === undefined ? null : Number(x.maxLength),
      numericPrecision: x.numericPrecision === null || x.numericPrecision === undefined ? null : Number(x.numericPrecision),
      numericScale: x.numericScale === null || x.numericScale === undefined ? null : Number(x.numericScale),
      isIdentity: !!x.isIdentity,
    }));

    return { ok: true, columns: cols };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:getPrimaryKey", async (_evt, args: { fullName: string }) => {
  try {
    const { schema, table } = splitFullName(args.fullName);
    if (!isSafeIdent(schema) || !isSafeIdent(table)) throw new Error(`Unsafe table name: ${args.fullName}`);

    const r = await query(primaryKeySql(schema, table), { schema, table });
    const pk = (r.recordset ?? []).map((x: any) => String(x.name));
    return { ok: true, primaryKey: pk };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:updateCell", async (_evt, args: { req: any }) => {
  try {
    const req = args.req as {
      fullName: string;
      pk: Record<string, any>;
      column: string;
      value: any;
    };

    const { sql: tableSql } = qFullName(req.fullName);

    if (!req.pk || !Object.keys(req.pk).length) {
      return { ok: false, error: "Missing primary key values." };
    }

    if (!isSafeIdent(req.column)) return { ok: false, error: `Unsafe column: ${req.column}` };

    const pkKeys = Object.keys(req.pk);
    for (const k of pkKeys) {
      if (!isSafeIdent(k)) return { ok: false, error: `Unsafe PK column: ${k}` };
    }

    const setSql = `${qIdent(req.column)} = @val`;
    const whereSql = pkKeys.map((k) => `${qIdent(k)} = @pk_${k}`).join(" AND ");
    const sqlText = `UPDATE ${tableSql} SET ${setSql} WHERE ${whereSql};`;

    const params: Record<string, any> = { val: req.value };
    for (const k of pkKeys) params[`pk_${k}`] = req.pk[k];

    const r = await query(sqlText, params);
    return { ok: true, rowCount: r.rowCount };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});

ipcMain.handle("db:insertRow", async (_evt, args: { req: any }) => {
  try {
    const req = args.req as {
      fullName: string;
      values: Record<string, any>;
    };

    const { schema, table, sql: tableSql } = qFullName(req.fullName);

    const values = req.values ?? {};
    const keys = Object.keys(values);
    if (!keys.length) return { ok: false, error: "No values provided." };

    // exclude identity columns
    const meta = await query(describeTableSql(schema, table), { schema, table });
    const cols = (meta.recordset ?? []).map((x: any) => ({
      name: String(x.name),
      isIdentity: !!x.isIdentity,
    }));
    const colMap = new Map(cols.map((c) => [c.name.toLowerCase(), c]));

    const safeKeys: string[] = [];
    for (const k of keys) {
      if (!isSafeIdent(k)) return { ok: false, error: `Unsafe column: ${k}` };
      const c = colMap.get(k.toLowerCase());
      if (!c) return { ok: false, error: `Unknown column: ${k}` };
      if (c.isIdentity) continue;
      safeKeys.push(k);
    }

    if (!safeKeys.length) return { ok: false, error: "All provided fields were identity or invalid." };

    const colSql = safeKeys.map(qIdent).join(", ");
    const valSql = safeKeys.map((k) => `@v_${k}`).join(", ");
    const sqlText = `INSERT INTO ${tableSql} (${colSql}) VALUES (${valSql});`;

    const params: Record<string, any> = {};
    for (const k of safeKeys) params[`v_${k}`] = values[k];

    const r = await query(sqlText, params);
    return { ok: true, rowCount: r.rowCount };
  } catch (e: any) {
    return { ok: false, error: formatError(e) };
  }
});
