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
import { openDb, closeDb, queryText } from "./db/sqlserver";
import { listDatabasesSql, listTablesSql, listViewsSql } from "./db/queries";

let win: BrowserWindow | null = null;

function formatError(e: any): string {
  if (!e) return "Unknown error (empty).";
  if (typeof e === "string") return e;

  // common shapes
  if (e.message) return String(e.message);
  if (e.originalError?.message) return String(e.originalError.message);

  // mssql/tedious/msnodesqlv8 sometimes use these
  if (e.code || e.number || e.state) {
    const bits = [
      e.code ? `code=${e.code}` : null,
      e.number ? `number=${e.number}` : null,
      e.state ? `state=${e.state}` : null,
      e.class ? `class=${e.class}` : null,
      e.serverName ? `server=${e.serverName}` : null,
    ].filter(Boolean);
    const details = bits.length ? ` (${bits.join(", ")})` : "";
    return `Database error${details}`;
  }

  // last resort: dump all enumerable + non-enumerable props
  try {
    return JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
  } catch {
    return String(e);
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
      return { ok: true };
    } catch (e: any) {
      console.error("db:open failed raw:", e);
      console.error("db:open failed formatted:", formatError(e));
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
    console.error("db:open failed formatted:", formatError(e));
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
      console.error("db:open failed formatted:", formatError(e));
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
    console.error("db:open failed formatted:", formatError(e));
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
    console.error("db:open failed formatted:", formatError(e));
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
      console.error("db:open failed formatted:", formatError(e));
      return { ok: false, error: formatError(e) };
    }
  },
);
