var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main/index.ts
var import_util = __toESM(require("util"));
var import_electron = require("electron");
var import_path = __toESM(require("path"));

// electron/main/db/sqlserver.ts
var import_msnodesqlv8 = __toESM(require("mssql/msnodesqlv8"));
var pool = null;
function normalizeServer(raw) {
  const s = (raw ?? "").trim();
  if (!s) return ".";
  const lower = s.toLowerCase();
  if (s === "." || lower === "localhost" || lower === "(local)") return ".";
  return s;
}
function buildOdbcConnectionString(profile) {
  const rawServer = (profile.server ?? ".").trim();
  const server = normalizeServer(rawServer);
  const database = profile.database ?? "master";
  const driver = "ODBC Driver 17 for SQL Server";
  const encrypt = profile.encrypt ?? false;
  const trustServerCertificate = profile.trustServerCertificate ?? true;
  const parts = [];
  parts.push(`Driver={${driver}}`);
  parts.push(`Server=${server}`);
  parts.push(`Database=${database}`);
  if (profile.auth.kind === "windows") {
    parts.push("Trusted_Connection=Yes");
  } else {
    parts.push(`Uid=${profile.auth.user}`);
    parts.push(`Pwd=${profile.auth.password}`);
  }
  parts.push(`Encrypt=${encrypt ? "Yes" : "No"}`);
  parts.push(`TrustServerCertificate=${trustServerCertificate ? "Yes" : "No"}`);
  return { driver, connectionString: parts.join(";") + ";" };
}
function buildConfig(profile) {
  const raw = (profile.connectionString ?? "").trim();
  if (raw) {
    return {
      driver: "ODBC Driver 17 for SQL Server",
      connectionString: raw.endsWith(";") ? raw : raw + ";",
      options: {
        trustedConnection: profile.auth.kind === "windows"
      }
    };
  }
  const built = buildOdbcConnectionString(profile);
  return {
    driver: built.driver,
    connectionString: built.connectionString,
    options: {
      trustedConnection: profile.auth.kind === "windows"
    }
  };
}
async function openDb(profile) {
  await closeDb();
  const cfg = buildConfig(profile);
  console.log("[db] connecting with cfg:", {
    driver: cfg.driver,
    connectionString: cfg.connectionString ? "***" : ""
  });
  pool = await new import_msnodesqlv8.default.ConnectionPool(cfg).connect();
}
async function closeDb() {
  if (!pool) return;
  try {
    await pool.close();
  } finally {
    pool = null;
  }
}
async function query(sqlText, params) {
  if (!pool) throw new Error("No open connection.");
  const req = pool.request();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      req.input(k, v);
    }
  }
  const resp = await req.query(sqlText);
  const recordset = resp.recordset ?? [];
  const columns = recordset.length ? Object.keys(recordset[0]) : [];
  const rows = recordset.map((r) => columns.map((c) => r[c]));
  return { columns, rows, rowCount: resp.rowsAffected?.[0] ?? 0, recordset };
}
async function queryText(sqlText) {
  if (!pool) throw new Error("No open connection.");
  const resp = await pool.request().query(sqlText);
  const recordset = resp.recordset ?? [];
  const columns = recordset.length ? Object.keys(recordset[0]) : [];
  const rows = recordset.map((r) => columns.map((c) => r[c]));
  return { columns, rows, rowCount: resp.rowsAffected?.[0] ?? 0 };
}

// electron/main/db/queries.ts
function describeTableSql(_schema, _table) {
  return `
SELECT
  c.COLUMN_NAME AS [name],
  c.DATA_TYPE AS [dataType],
  CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS [isNullable],
  CASE WHEN c.CHARACTER_MAXIMUM_LENGTH IS NULL THEN NULL ELSE c.CHARACTER_MAXIMUM_LENGTH END AS [maxLength],
  CASE WHEN c.NUMERIC_PRECISION IS NULL THEN NULL ELSE c.NUMERIC_PRECISION END AS [numericPrecision],
  CASE WHEN c.NUMERIC_SCALE IS NULL THEN NULL ELSE c.NUMERIC_SCALE END AS [numericScale],
  CASE WHEN ic.column_id IS NULL THEN 0 ELSE 1 END AS [isIdentity]
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN sys.tables t ON t.name = c.TABLE_NAME
LEFT JOIN sys.schemas s ON s.schema_id = t.schema_id AND s.name = c.TABLE_SCHEMA
LEFT JOIN sys.columns sc ON sc.object_id = t.object_id AND sc.name = c.COLUMN_NAME
LEFT JOIN sys.identity_columns ic ON ic.object_id = t.object_id AND ic.column_id = sc.column_id
WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
ORDER BY c.ORDINAL_POSITION;
`.trim();
}
function primaryKeySql(_schema, _table) {
  return `
SELECT kcu.COLUMN_NAME AS [name]
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
  AND tc.TABLE_NAME = kcu.TABLE_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_SCHEMA = @schema
  AND tc.TABLE_NAME = @table
ORDER BY kcu.ORDINAL_POSITION;
`.trim();
}
var listDatabasesSql = `
SELECT name
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
`;
var listTablesSql = `
SELECT s.name + '.' + t.name AS [name]
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
ORDER BY s.name, t.name;
`;
var listViewsSql = `
SELECT s.name + '.' + v.name AS [name]
FROM sys.views v
JOIN sys.schemas s ON v.schema_id = s.schema_id
ORDER BY s.name, v.name;
`;

// electron/main/index.ts
var win = null;
function formatError(e) {
  if (!e) return "Unknown error (empty).";
  if (typeof e === "string") return e;
  const msg = e?.message ? String(e.message) : "";
  if (msg && msg !== "[object Object]") return msg;
  const nestedMsg = e?.originalError?.message ?? e?.cause?.message ?? e?.innerError?.message ?? e?.error?.message;
  if (nestedMsg) return String(nestedMsg);
  const bits = [
    e.code ? `code=${e.code}` : null,
    e.number ? `number=${e.number}` : null,
    e.state ? `state=${e.state}` : null,
    e.class ? `class=${e.class}` : null,
    e.serverName ? `server=${e.serverName}` : null,
    e.sqlstate ? `sqlstate=${e.sqlstate}` : null
  ].filter(Boolean);
  try {
    const dump = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
    return bits.length ? `${bits.join(", ")}
${dump}` : dump;
  } catch {
    return bits.length ? bits.join(", ") : String(e);
  }
}
function splitFullName(fullName) {
  const raw = (fullName ?? "").trim();
  const parts = raw.split(".");
  if (parts.length === 2) return { schema: parts[0], table: parts[1] };
  return { schema: "dbo", table: raw };
}
function isSafeIdent(s) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test((s ?? "").trim());
}
function qIdent(name) {
  const n = (name ?? "").trim();
  if (!isSafeIdent(n)) throw new Error(`Unsafe identifier: ${name}`);
  return `[${n}]`;
}
function qFullName(fullName) {
  const { schema, table } = splitFullName(fullName);
  if (!isSafeIdent(schema) || !isSafeIdent(table)) throw new Error(`Unsafe table name: ${fullName}`);
  return { schema, table, sql: `${qIdent(schema)}.${qIdent(table)}` };
}
async function createWindow() {
  win = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: import_path.default.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await win.loadURL(devUrl);
  else await win.loadFile(import_path.default.join(__dirname, "../../../reactui/dist/index.html"));
}
import_electron.app.whenReady().then(createWindow);
import_electron.app.on("window-all-closed", async () => {
  await closeDb();
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.ipcMain.handle("db:open", async (_evt, args) => {
  try {
    await openDb(args.profile);
    const used = (args.profile.connectionString ?? "").trim() || buildOdbcConnectionString(args.profile).connectionString;
    return { ok: true, connectionString: used };
  } catch (e) {
    console.error("db:open failed raw:", e);
    console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
    if (e?.originalError) console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
    if (e?.cause) console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:close", async () => {
  try {
    await closeDb();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:listDatabases", async () => {
  try {
    const r = await queryText(listDatabasesSql);
    const databases = r.rows.map((x) => String(x[0]));
    return { ok: true, databases };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:listTables", async () => {
  try {
    const r = await queryText(listTablesSql);
    const tables = r.rows.map((x) => String(x[0]));
    return { ok: true, tables };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:listViews", async () => {
  try {
    const r = await queryText(listViewsSql);
    const views = r.rows.map((x) => String(x[0]));
    return { ok: true, views };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:query", async (_evt, args) => {
  try {
    const r = await queryText(args.sql);
    return { ok: true, result: { columns: r.columns, rows: r.rows }, rowCount: r.rowCount };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:describeTable", async (_evt, args) => {
  try {
    const { schema, table } = splitFullName(args.fullName);
    if (!isSafeIdent(schema) || !isSafeIdent(table)) throw new Error(`Unsafe table name: ${args.fullName}`);
    const r = await query(describeTableSql(schema, table), { schema, table });
    const cols = (r.recordset ?? []).map((x) => ({
      name: String(x.name),
      dataType: String(x.dataType),
      isNullable: !!x.isNullable,
      maxLength: x.maxLength === null || x.maxLength === void 0 ? null : Number(x.maxLength),
      numericPrecision: x.numericPrecision === null || x.numericPrecision === void 0 ? null : Number(x.numericPrecision),
      numericScale: x.numericScale === null || x.numericScale === void 0 ? null : Number(x.numericScale),
      isIdentity: !!x.isIdentity
    }));
    return { ok: true, columns: cols };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:getPrimaryKey", async (_evt, args) => {
  try {
    const { schema, table } = splitFullName(args.fullName);
    if (!isSafeIdent(schema) || !isSafeIdent(table)) throw new Error(`Unsafe table name: ${args.fullName}`);
    const r = await query(primaryKeySql(schema, table), { schema, table });
    const pk = (r.recordset ?? []).map((x) => String(x.name));
    return { ok: true, primaryKey: pk };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:updateCell", async (_evt, args) => {
  try {
    const req = args.req;
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
    const params = { val: req.value };
    for (const k of pkKeys) params[`pk_${k}`] = req.pk[k];
    const r = await query(sqlText, params);
    return { ok: true, rowCount: r.rowCount };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:insertRow", async (_evt, args) => {
  try {
    const req = args.req;
    const { schema, table, sql: tableSql } = qFullName(req.fullName);
    const values = req.values ?? {};
    const keys = Object.keys(values);
    if (!keys.length) return { ok: false, error: "No values provided." };
    const meta = await query(describeTableSql(schema, table), { schema, table });
    const cols = (meta.recordset ?? []).map((x) => ({
      name: String(x.name),
      isIdentity: !!x.isIdentity
    }));
    const colMap = new Map(cols.map((c) => [c.name.toLowerCase(), c]));
    const safeKeys = [];
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
    const params = {};
    for (const k of safeKeys) params[`v_${k}`] = values[k];
    const r = await query(sqlText, params);
    return { ok: true, rowCount: r.rowCount };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
});
//# sourceMappingURL=index.js.map