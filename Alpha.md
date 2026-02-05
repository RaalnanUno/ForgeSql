Cool — let’s do it.

Below is a **working-name shortlist**, a **clean MVP scope**, and a **drop-in project skeleton** (Electron + Vite + React + TypeScript) that can:

- connect to **SQL Server Express** (including LocalDB if it exists)
    
- **list tables/views**
    
- run **ad-hoc queries** (query editor + results grid)
    
- basic **CRUD on tables** (phase 2)
    
- show **foreign keys** (phase 2)
    

And yes: **UI in TypeScript** and **folder name `reactui/`**.

---

## New name ideas (DBForge-ish but not “DBForge”)

Pick any — no dependencies on the name:

- **ForgeSQL**
    
- **SqlForge Desktop**
    
- **QueryForge**
    
- **TableForge**
    
- **LocalForge DB**
    
- **SteelQuery**
    
- **IronDB Studio**
    
- **ExpressWorks Studio**
    

If you want “SSMS vibes”: **ForgeSQL Studio** is probably the cleanest.

---

## Architecture (SSMS-like, but realistic)

**Electron app** with strict separation:

- **main process**: holds DB connections + executes SQL (using Node driver)
    
- **preload**: exposes a narrow IPC API to the UI
    
- **renderer**: React UI (Object Explorer left, Query Editor + Results right)
    

### SQL Server driver (Node)

Use `mssql` (popular, stable). It supports:

- Windows Auth (on-domain) or SQL Auth
    
- SQL Server Express
    
- LocalDB (often works if installed)
    

---

## Folder layout (you said `reactui/`)

```
ForgeSql/
  electron/
    main/
      index.ts
      db/
        sqlserver.ts
        queries.ts
    preload/
      index.ts
    shared/
      types.ts
  reactui/
    index.html
    src/
      main.tsx
      App.tsx
      api/dbforge.ts
      components/
        ObjectExplorer.tsx
        QueryEditor.tsx
        ResultsGrid.tsx
        ConnectionDialog.tsx
  package.json
  tsconfig.json
```

---

## MVP plan (what you can test quickly)

### Phase 1 (MVP) — “Does SQL Express even work here?”

✅ Connect / Disconnect  
✅ Run query in editor  
✅ Show results grid (columns + rows)  
✅ Object Explorer: list DBs, tables, views  
✅ “Select top 100” context action for a table

### Phase 2 — SSMS-ish features

- Table viewer with paging
    
- Table CRUD (insert/update/delete)
    
- Foreign keys viewer (table -> referenced)
    
- View definition viewer
    

### Phase 3 — Nice-to-have

- saved connections (encrypted at rest)
    
- query tabs, history
    
- export results (CSV/JSON)
    
- schema compare, scripting, etc.
    

---

# Code skeleton (enough to compile and test)

## 1) `electron/shared/types.ts`

```ts
export type SqlAuth =
  | { kind: "windows" } // (Trusted Connection)
  | { kind: "sql"; user: string; password: string };

export type SqlServerConnectionProfile = {
  name: string;
  server: string; // e.g. "localhost\\SQLEXPRESS" or "(localdb)\\MSSQLLocalDB"
  database?: string; // optional for initial connect
  auth: SqlAuth;
  encrypt?: boolean; // default false for local; true for Azure/remote
  trustServerCertificate?: boolean; // often true locally
};

export type DbOpenResponse = { ok: true } | { ok: false; error: string };

export type DbListDatabasesResponse =
  | { ok: true; databases: string[] }
  | { ok: false; error: string };

export type DbListTablesResponse =
  | { ok: true; tables: string[] }
  | { ok: false; error: string };

export type DbListViewsResponse =
  | { ok: true; views: string[] }
  | { ok: false; error: string };

export type DbQueryResult = {
  columns: string[];
  rows: any[][];
};

export type DbQueryResponse =
  | { ok: true; result: DbQueryResult; rowCount: number }
  | { ok: false; error: string };
```

---

## 2) `electron/main/db/sqlserver.ts`

```ts
import sql from "mssql";
import { SqlServerConnectionProfile } from "../../shared/types";

let pool: sql.ConnectionPool | null = null;

function buildConfig(profile: SqlServerConnectionProfile): sql.config {
  const encrypt = profile.encrypt ?? false;
  const trustServerCertificate = profile.trustServerCertificate ?? true;

  if (profile.auth.kind === "sql") {
    return {
      user: profile.auth.user,
      password: profile.auth.password,
      server: profile.server,
      database: profile.database,
      options: { encrypt, trustServerCertificate },
    };
  }

  // Windows Auth (Trusted Connection). This works best if the environment supports it.
  // Some org setups may require additional drivers/config.
  return {
    server: profile.server,
    database: profile.database,
    options: { encrypt, trustServerCertificate },
    // NOTE: mssql Windows auth can be environment-dependent.
    // If this fails in your org, you can still test SQL Auth.
  } as sql.config;
}

export async function openDb(profile: SqlServerConnectionProfile) {
  await closeDb();
  const cfg = buildConfig(profile);
  pool = await new sql.ConnectionPool(cfg).connect();
}

export async function closeDb() {
  if (pool) {
    try {
      await pool.close();
    } finally {
      pool = null;
    }
  }
}

export function isOpen() {
  return !!pool;
}

export async function queryText(sqlText: string) {
  if (!pool) throw new Error("No open connection.");
  const resp = await pool.request().query(sqlText);

  const recordset = resp.recordset ?? [];
  const columns = recordset.length ? Object.keys(recordset[0]) : [];
  const rows = recordset.map((r: any) => columns.map((c) => r[c]));

  return { columns, rows, rowCount: resp.rowsAffected?.[0] ?? 0 };
}
```

---

## 3) `electron/main/db/queries.ts` (tables/views/dbs/fks later)

```ts
export const listDatabasesSql = `
SELECT name
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
`;

export const listTablesSql = `
SELECT s.name + '.' + t.name AS [name]
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
ORDER BY s.name, t.name;
`;

export const listViewsSql = `
SELECT s.name + '.' + v.name AS [name]
FROM sys.views v
JOIN sys.schemas s ON v.schema_id = s.schema_id
ORDER BY s.name, v.name;
`;

export function selectTopSql(fullName: string, top = 100) {
  return `SELECT TOP (${top}) * FROM ${fullName};`;
}
```

---

## 4) `electron/main/index.ts` (IPC endpoints)

```ts
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
  else await win.loadFile(path.join(__dirname, "../../reactui/dist/index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await closeDb();
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("db:open", async (_evt, args: { profile: SqlServerConnectionProfile }): Promise<DbOpenResponse> => {
  try {
    await openDb(args.profile);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("db:close", async (): Promise<DbOpenResponse> => {
  try {
    await closeDb();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("db:listDatabases", async (): Promise<DbListDatabasesResponse> => {
  try {
    const r = await queryText(listDatabasesSql);
    const databases = r.rows.map((x) => String(x[0]));
    return { ok: true, databases };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("db:listTables", async (): Promise<DbListTablesResponse> => {
  try {
    const r = await queryText(listTablesSql);
    const tables = r.rows.map((x) => String(x[0]));
    return { ok: true, tables };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("db:listViews", async (): Promise<DbListViewsResponse> => {
  try {
    const r = await queryText(listViewsSql);
    const views = r.rows.map((x) => String(x[0]));
    return { ok: true, views };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

ipcMain.handle("db:query", async (_evt, args: { sql: string }): Promise<DbQueryResponse> => {
  try {
    const r = await queryText(args.sql);
    return { ok: true, result: { columns: r.columns, rows: r.rows }, rowCount: r.rowCount };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});
```

---

## 5) `electron/preload/index.ts` (typed bridge)

```ts
import { contextBridge, ipcRenderer } from "electron";
import {
  DbListDatabasesResponse,
  DbListTablesResponse,
  DbListViewsResponse,
  DbOpenResponse,
  DbQueryResponse,
  SqlServerConnectionProfile,
} from "../shared/types";

contextBridge.exposeInMainWorld("dbforge", {
  open: (profile: SqlServerConnectionProfile) =>
    ipcRenderer.invoke("db:open", { profile }) as Promise<DbOpenResponse>,
  close: () => ipcRenderer.invoke("db:close") as Promise<DbOpenResponse>,
  listDatabases: () => ipcRenderer.invoke("db:listDatabases") as Promise<DbListDatabasesResponse>,
  listTables: () => ipcRenderer.invoke("db:listTables") as Promise<DbListTablesResponse>,
  listViews: () => ipcRenderer.invoke("db:listViews") as Promise<DbListViewsResponse>,
  query: (sql: string) => ipcRenderer.invoke("db:query", { sql }) as Promise<DbQueryResponse>,
});
```

---

## 6) `reactui/src/api/dbforge.ts` (window typing)

```ts
import type {
  DbListDatabasesResponse,
  DbListTablesResponse,
  DbListViewsResponse,
  DbOpenResponse,
  DbQueryResponse,
  SqlServerConnectionProfile,
} from "../../../electron/shared/types";

declare global {
  interface Window {
    dbforge: {
      open: (profile: SqlServerConnectionProfile) => Promise<DbOpenResponse>;
      close: () => Promise<DbOpenResponse>;
      listDatabases: () => Promise<DbListDatabasesResponse>;
      listTables: () => Promise<DbListTablesResponse>;
      listViews: () => Promise<DbListViewsResponse>;
      query: (sql: string) => Promise<DbQueryResponse>;
    };
  }
}

export const dbforge = window.dbforge;
```

---

## 7) Minimal UI idea (SSMS layout)

- Left: Object Explorer (databases/tables/views)
    
- Right top: Query Editor (textarea for now, Monaco later)
    
- Right bottom: Results grid (simple table)
    

I won’t dump a ton of UI code unless you want it — but this IPC layer is the “hard part” you’ll reuse forever.

---

# What you can test immediately (connection strings)

Try these in the Connection dialog you’ll make:

### SQL Server Express

- `localhost\SQLEXPRESS`
    
- `.\SQLEXPRESS`
    

### LocalDB (if present)

- `(localdb)\MSSQLLocalDB`
    

If LocalDB isn’t installed/allowed, it’ll fail fast — and that’s the whole point of this “probe app”.

---

## Next step (your call, but I’ll make the best move)

If you say “go”, I’ll give you:

1. **package.json + scripts** for Electron + Vite TS build
    
2. a simple **ConnectionDialog.tsx** (server/db/auth)
    
3. **ObjectExplorer.tsx** + **QueryEditor.tsx** + **ResultsGrid.tsx** wired up
    
4. a “Select Top 100” action when you click a table
    

Just tell me which UI baseline you want:

- **Bootstrap** (fast, simple)
    
- **MUI** (nice layout + DataGrid)
    
- **Plain** (minimal CSS)
    

(Any is fine — all TypeScript.)