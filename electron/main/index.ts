import util from "util";

import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import {
  DbListDatabasesResponse,
  DbListTablesResponse,
  DbListViewsResponse,
  DbOpenResponse,
  DbQueryResponse,
  SqlServerConnectionProfile,
} from "../shared/types";

import { openDb, closeDb, queryText, buildOdbcConnectionString } from "./db/sqlserver";

import { listDatabasesSql, listTablesSql, listViewsSql } from "./db/queries";

let win: BrowserWindow | null = null;

function formatError(e: any): string {
  if (!e) return "Unknown error (empty).";
  if (typeof e === "string") return e;

  const msg = e?.message ? String(e.message) : "";
  if (msg && msg !== "[object Object]") return msg;

  // common nested shapes
  const nestedMsg =
    e?.originalError?.message ??
    e?.cause?.message ??
    e?.innerError?.message ??
    e?.error?.message;

  if (nestedMsg) return String(nestedMsg);

  // mssql/msnodesqlv8 sometimes stores details on these fields
  const bits = [
    e.code ? `code=${e.code}` : null,
    e.number ? `number=${e.number}` : null,
    e.state ? `state=${e.state}` : null,
    e.class ? `class=${e.class}` : null,
    e.serverName ? `server=${e.serverName}` : null,
    e.sqlstate ? `sqlstate=${e.sqlstate}` : null,
  ].filter(Boolean);

  // last resort: dump everything we can
  try {
    const dump = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
    return bits.length ? `${bits.join(", ")}\n${dump}` : dump;
  } catch {
    return bits.length ? bits.join(", ") : String(e);
  }
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

  // Vite dev server or built file:
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await win.loadURL(devUrl);
  else
    await win.loadFile(
      path.join(__dirname, "../../../reactui/dist/index.html"),
    );
}

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await closeDb();
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle(
  "db:open",
  async (
    _evt,
    args: { profile: SqlServerConnectionProfile },
  ): Promise<DbOpenResponse> => {
    try {
await openDb(args.profile);

// return the exact connection string used
const used =
  (args.profile.connectionString ?? "").trim() ||
  buildOdbcConnectionString(args.profile).connectionString;

return { ok: true, connectionString: used };

} catch (e: any) {
  console.error("db:open failed raw:", e);
  console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));

  // also inspect nested fields commonly used by mssql/msnodesqlv8
  if (e?.originalError) {
    console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
  }
  if (e?.cause) {
    console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
  }

  return { ok: false, error: formatError(e) };
}

  },
);

ipcMain.handle("db:close", async (): Promise<DbOpenResponse> => {
  try {
    await closeDb();
    return { ok: true };
} catch (e: any) {
  console.error("db:open failed raw:", e);
  console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));

  // also inspect nested fields commonly used by mssql/msnodesqlv8
  if (e?.originalError) {
    console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
  }
  if (e?.cause) {
    console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
  }

  return { ok: false, error: formatError(e) };
}

});

ipcMain.handle(
  "db:listDatabases",
  async (): Promise<DbListDatabasesResponse> => {
    try {
      const r = await queryText(listDatabasesSql);
      const databases = r.rows.map((x) => String(x[0]));
      return { ok: true, databases };
} catch (e: any) {
  console.error("db:open failed raw:", e);
  console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));

  // also inspect nested fields commonly used by mssql/msnodesqlv8
  if (e?.originalError) {
    console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
  }
  if (e?.cause) {
    console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
  }

  return { ok: false, error: formatError(e) };
}

  },
);

ipcMain.handle("db:listTables", async (): Promise<DbListTablesResponse> => {
  try {
    const r = await queryText(listTablesSql);
    const tables = r.rows.map((x) => String(x[0]));
    return { ok: true, tables };
} catch (e: any) {
  console.error("db:open failed raw:", e);
  console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));

  // also inspect nested fields commonly used by mssql/msnodesqlv8
  if (e?.originalError) {
    console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
  }
  if (e?.cause) {
    console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
  }

  return { ok: false, error: formatError(e) };
}

});

ipcMain.handle("db:listViews", async (): Promise<DbListViewsResponse> => {
  try {
    const r = await queryText(listViewsSql);
    const views = r.rows.map((x) => String(x[0]));
    return { ok: true, views };
} catch (e: any) {
  console.error("db:open failed raw:", e);
  console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));

  // also inspect nested fields commonly used by mssql/msnodesqlv8
  if (e?.originalError) {
    console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
  }
  if (e?.cause) {
    console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
  }

  return { ok: false, error: formatError(e) };
}

});

ipcMain.handle(
  "db:query",
  async (_evt, args: { sql: string }): Promise<DbQueryResponse> => {
    try {
      const r = await queryText(args.sql);
      return {
        ok: true,
        result: { columns: r.columns, rows: r.rows },
        rowCount: r.rowCount,
      };
} catch (e: any) {
  console.error("db:open failed raw:", e);
  console.error("db:open failed inspect:", util.inspect(e, { depth: 10, colors: false, showHidden: true }));

  // also inspect nested fields commonly used by mssql/msnodesqlv8
  if (e?.originalError) {
    console.error("db:open originalError inspect:", util.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
  }
  if (e?.cause) {
    console.error("db:open cause inspect:", util.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
  }

  return { ok: false, error: formatError(e) };
}

  },
);
