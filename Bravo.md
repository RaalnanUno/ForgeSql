Perfect. Next we’ll wire up:

1. **root build/dev scripts** (Electron + Vite + TS)
    
2. a **minimal SSMS-ish UI** (Connect dialog, Object Explorer, Query Editor, Results grid)
    
3. fix one **production path bug** in `electron/main/index.ts`
    

I’ll assume your repo root looks like:

```
ForgeSql/
  electron/...
  reactui/...
```

---

## 0) Quick fix in `electron/main/index.ts` (prod path)

In your file, change the `loadFile` path to go up **three** levels (not two):

**File:** `electron/main/index.ts`  
**Replace this:**

```ts
else await win.loadFile(path.join(__dirname, "../../reactui/dist/index.html"));
```

**With this:**

```ts
else await win.loadFile(path.join(__dirname, "../../../reactui/dist/index.html"));
```

Reason: when compiled, `__dirname` becomes `electron/dist/main`, so you need to back out to repo root.

---

## 1) Root `package.json` (Electron + UI dev workflow)

**File:** `package.json` (repo root)  
Create/replace with:

```json
{
  "name": "forgesql-studio",
  "private": true,
  "version": "0.0.1",
  "main": "electron/dist/main/index.js",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:ui\" \"npm:dev:electron\"",
    "dev:ui": "npm --prefix reactui run dev -- --host --port 5173",
    "dev:electron": "npm run build:electron -- --watch & wait-on http://127.0.0.1:5173 && cross-env VITE_DEV_SERVER_URL=http://127.0.0.1:5173 electron .",

    "build": "npm run build:ui && npm run build:electron",
    "build:ui": "npm --prefix reactui run build",
    "build:electron": "tsup",

    "start": "electron ."
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "cross-env": "^7.0.3",
    "electron": "^31.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "mssql": "^11.0.0"
  }
}
```

Then install deps at root:

```bash
npm install
```

---

## 2) `tsup` build for Electron (main + preload)

**File:** `tsup.config.ts` (repo root)  
Create:

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    name: "main",
    entry: ["electron/main/index.ts"],
    outDir: "electron/dist/main",
    format: ["cjs"],
    platform: "node",
    sourcemap: true,
    clean: true,
    target: "node18",
    external: ["electron"]
  },
  {
    name: "preload",
    entry: ["electron/preload/index.ts"],
    outDir: "electron/dist/preload",
    format: ["cjs"],
    platform: "node",
    sourcemap: true,
    clean: false,
    target: "node18",
    external: ["electron"]
  }
]);
```

---

## 3) `reactui/` setup (Bootstrap, TS, Vite)

### 3a) Install UI deps

From repo root:

```bash
npm --prefix reactui install bootstrap bootstrap-icons
```

### 3b) Add Bootstrap imports

**File:** `reactui/src/main.tsx`  
At the top, add:

```ts
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
```

---

## 4) Type the preload API in the UI

You already created `reactui/src/api/dbforge.ts`. Good.

We’ll now build the UI.

---

## 5) UI components (minimal SSMS layout)

### 5a) `reactui/src/App.tsx`

Replace with:

```tsx
import { useEffect, useMemo, useState } from "react";
import { dbforge } from "./api/dbforge";
import type { DbQueryResult, SqlServerConnectionProfile } from "../../electron/shared/types";
import ConnectionDialog from "./components/ConnectionDialog";
import ObjectExplorer from "./components/ObjectExplorer";
import QueryEditor from "./components/QueryEditor";
import ResultsGrid from "./components/ResultsGrid";

type ConnState = "disconnected" | "connected";

export default function App() {
  const [connState, setConnState] = useState<ConnState>("disconnected");
  const [activeDb, setActiveDb] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [sqlText, setSqlText] = useState<string>("SELECT @@VERSION AS Version;");
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [status, setStatus] = useState<string>("Ready.");
  const [showConnect, setShowConnect] = useState<boolean>(true);

  const canQuery = useMemo(() => connState === "connected", [connState]);

  async function refreshExplorer() {
    setStatus("Refreshing object explorer...");
    const [dbs, tbls, vws] = await Promise.all([
      dbforge.listDatabases(),
      dbforge.listTables(),
      dbforge.listViews()
    ]);

    if (!dbs.ok) return setStatus(`Error: ${dbs.error}`);
    if (!tbls.ok) return setStatus(`Error: ${tbls.error}`);
    if (!vws.ok) return setStatus(`Error: ${vws.error}`);

    setDatabases(dbs.databases);
    setTables(tbls.tables);
    setViews(vws.views);
    setStatus("Ready.");
  }

  async function runQuery(sql: string) {
    if (!canQuery) return;
    setStatus("Running query...");
    const resp = await dbforge.query(sql);
    if (!resp.ok) {
      setStatus(`Error: ${resp.error}`);
      return;
    }
    setResult(resp.result);
    setStatus(`OK (${resp.rowCount} rows affected).`);
  }

  async function connect(profile: SqlServerConnectionProfile) {
    setStatus("Connecting...");
    const openResp = await dbforge.open(profile);
    if (!openResp.ok) {
      setStatus(`Connect failed: ${openResp.error}`);
      setConnState("disconnected");
      return;
    }

    setConnState("connected");
    setActiveDb(profile.database ?? "");
    setShowConnect(false);

    await refreshExplorer();
    await runQuery("SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName;");
  }

  async function disconnect() {
    setStatus("Disconnecting...");
    const closeResp = await dbforge.close();
    if (!closeResp.ok) {
      setStatus(`Disconnect failed: ${closeResp.error}`);
      return;
    }
    setConnState("disconnected");
    setTables([]);
    setViews([]);
    setDatabases([]);
    setResult(null);
    setStatus("Disconnected.");
    setShowConnect(true);
  }

  useEffect(() => {
    // Show connect dialog on first load
    setShowConnect(true);
  }, []);

  return (
    <div className="container-fluid vh-100 d-flex flex-column p-0">
      <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
        <span className="navbar-brand mb-0 h1">ForgeSQL Studio</span>

        <div className="ms-auto d-flex gap-2 align-items-center">
          <span className="text-light small">
            {connState === "connected" ? `Connected ${activeDb ? `(${activeDb})` : ""}` : "Disconnected"}
          </span>

          <button className="btn btn-sm btn-outline-light" onClick={() => setShowConnect(true)}>
            <i className="bi bi-plug me-1" />
            Connect
          </button>

          <button className="btn btn-sm btn-outline-warning" onClick={disconnect} disabled={connState !== "connected"}>
            <i className="bi bi-x-octagon me-1" />
            Disconnect
          </button>
        </div>
      </nav>

      <div className="flex-grow-1 d-flex" style={{ minHeight: 0 }}>
        {/* Left: Object Explorer */}
        <div className="border-end" style={{ width: 320, overflow: "auto" }}>
          <ObjectExplorer
            disabled={connState !== "connected"}
            databases={databases}
            tables={tables}
            views={views}
            onRefresh={refreshExplorer}
            onSelectTop={(fullName) => {
              const q = `SELECT TOP (100) * FROM ${fullName};`;
              setSqlText(q);
              runQuery(q);
            }}
          />
        </div>

        {/* Right: Editor + Results */}
        <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0, minHeight: 0 }}>
          <div className="p-2 border-bottom">
            <QueryEditor
              disabled={connState !== "connected"}
              sql={sqlText}
              onChange={setSqlText}
              onRun={() => runQuery(sqlText)}
            />
          </div>

          <div className="flex-grow-1 p-2" style={{ overflow: "auto", minHeight: 0 }}>
            <ResultsGrid result={result} />
          </div>
        </div>
      </div>

      <div className="bg-light border-top px-3 py-2 small text-muted">
        {status}
      </div>

      <ConnectionDialog
        show={showConnect}
        onClose={() => setShowConnect(false)}
        onConnect={connect}
      />
    </div>
  );
}
```

---

### 5b) `reactui/src/components/ConnectionDialog.tsx`

Create:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { SqlServerConnectionProfile } from "../../../electron/shared/types";

type Props = {
  show: boolean;
  onClose: () => void;
  onConnect: (profile: SqlServerConnectionProfile) => void;
};

const LS_KEY = "forgesql.lastProfile";

export default function ConnectionDialog({ show, onClose, onConnect }: Props) {
  const [name, setName] = useState("Local SQL Express");
  const [server, setServer] = useState<string>(".\\SQLEXPRESS");
  const [database, setDatabase] = useState<string>("master");
  const [authKind, setAuthKind] = useState<"windows" | "sql">("windows");
  const [user, setUser] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [encrypt, setEncrypt] = useState<boolean>(false);
  const [trustServerCertificate, setTrustServerCertificate] = useState<boolean>(true);

  const profile: SqlServerConnectionProfile = useMemo(() => {
    return {
      name,
      server,
      database: database || undefined,
      auth:
        authKind === "windows"
          ? { kind: "windows" }
          : { kind: "sql", user, password },
      encrypt,
      trustServerCertificate
    };
  }, [name, server, database, authKind, user, password, encrypt, trustServerCertificate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as SqlServerConnectionProfile;

      setName(p.name ?? "Local SQL Express");
      setServer(p.server ?? ".\\SQLEXPRESS");
      setDatabase(p.database ?? "master");
      setEncrypt(p.encrypt ?? false);
      setTrustServerCertificate(p.trustServerCertificate ?? true);

      if (p.auth?.kind === "sql") {
        setAuthKind("sql");
        setUser(p.auth.user ?? "");
        setPassword(p.auth.password ?? "");
      } else {
        setAuthKind("windows");
      }
    } catch {
      // ignore
    }
  }, []);

  function handleConnect() {
    localStorage.setItem(LS_KEY, JSON.stringify(profile));
    onConnect(profile);
  }

  if (!show) return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded shadow position-absolute top-50 start-50 translate-middle p-3" style={{ width: 520 }}>
        <div className="d-flex align-items-center mb-2">
          <h5 className="mb-0">Connect to SQL Server</h5>
          <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-2">
          <label className="form-label">Profile Name</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="mb-2">
          <label className="form-label">Server</label>
          <input
            className="form-control"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder=".\SQLEXPRESS or (localdb)\MSSQLLocalDB"
          />
          <div className="form-text">
            Try: <code>.\SQLEXPRESS</code>, <code>localhost\SQLEXPRESS</code>, <code>(localdb)\MSSQLLocalDB</code>
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label">Database</label>
          <input className="form-control" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="master" />
        </div>

        <div className="mb-2">
          <label className="form-label">Authentication</label>
          <select className="form-select" value={authKind} onChange={(e) => setAuthKind(e.target.value as any)}>
            <option value="windows">Windows (Trusted Connection)</option>
            <option value="sql">SQL Login (user/password)</option>
          </select>
        </div>

        {authKind === "sql" && (
          <div className="row g-2 mb-2">
            <div className="col-6">
              <label className="form-label">User</label>
              <input className="form-control" value={user} onChange={(e) => setUser(e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        )}

        <div className="row g-2 mb-3">
          <div className="col-6">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} id="chkEncrypt" />
              <label className="form-check-label" htmlFor="chkEncrypt">Encrypt</label>
            </div>
          </div>
          <div className="col-6">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" checked={trustServerCertificate} onChange={(e) => setTrustServerCertificate(e.target.checked)} id="chkTrust" />
              <label className="form-check-label" htmlFor="chkTrust">Trust Server Certificate</label>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={handleConnect}>
            <i className="bi bi-plug me-1" />
            Connect
          </button>
          <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

---

### 5c) `reactui/src/components/ObjectExplorer.tsx`

Create:

```tsx
type Props = {
  disabled: boolean;
  databases: string[];
  tables: string[];
  views: string[];
  onRefresh: () => void;
  onSelectTop: (fullName: string) => void;
};

export default function ObjectExplorer({ disabled, databases, tables, views, onRefresh, onSelectTop }: Props) {
  return (
    <div className="p-2">
      <div className="d-flex align-items-center mb-2">
        <strong>Object Explorer</strong>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={onRefresh} disabled={disabled}>
          <i className="bi bi-arrow-clockwise me-1" />
          Refresh
        </button>
      </div>

      <div className="mb-3">
        <div className="text-muted small mb-1">Databases</div>
        <ul className="list-group">
          {databases.map((d) => (
            <li key={d} className="list-group-item py-1">{d}</li>
          ))}
          {!databases.length && <li className="list-group-item py-1 text-muted">None</li>}
        </ul>
      </div>

      <div className="mb-3">
        <div className="text-muted small mb-1">Tables</div>
        <ul className="list-group">
          {tables.map((t) => (
            <li key={t} className="list-group-item py-1 d-flex align-items-center">
              <span className="text-truncate" title={t}>{t}</span>
              <button
                className="btn btn-sm btn-outline-primary ms-auto"
                onClick={() => onSelectTop(t)}
                disabled={disabled}
                title="Select Top 100"
              >
                Top 100
              </button>
            </li>
          ))}
          {!tables.length && <li className="list-group-item py-1 text-muted">None</li>}
        </ul>
      </div>

      <div>
        <div className="text-muted small mb-1">Views</div>
        <ul className="list-group">
          {views.map((v) => (
            <li key={v} className="list-group-item py-1">{v}</li>
          ))}
          {!views.length && <li className="list-group-item py-1 text-muted">None</li>}
        </ul>
      </div>
    </div>
  );
}
```

---

### 5d) `reactui/src/components/QueryEditor.tsx`

Create:

```tsx
type Props = {
  disabled: boolean;
  sql: string;
  onChange: (sql: string) => void;
  onRun: () => void;
};

export default function QueryEditor({ disabled, sql, onChange, onRun }: Props) {
  return (
    <div>
      <div className="d-flex align-items-center mb-2">
        <strong>Query</strong>
        <button className="btn btn-sm btn-success ms-auto" onClick={onRun} disabled={disabled}>
          <i className="bi bi-play-fill me-1" />
          Run
        </button>
      </div>

      <textarea
        className="form-control font-monospace"
        rows={7}
        value={sql}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
      />
      <div className="form-text">
        Tip: try <code>SELECT name FROM sys.tables;</code>
      </div>
    </div>
  );
}
```

---

### 5e) `reactui/src/components/ResultsGrid.tsx`

Create:

```tsx
import type { DbQueryResult } from "../../../electron/shared/types";

type Props = {
  result: DbQueryResult | null;
};

export default function ResultsGrid({ result }: Props) {
  if (!result) return <div className="text-muted">No results yet.</div>;

  const { columns, rows } = result;

  if (!columns.length) return <div className="text-muted">Query ran, but returned no tabular results.</div>;

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped table-hover align-middle">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              {r.map((cell, cidx) => (
                <td key={cidx} className="text-nowrap">
                  {cell === null || cell === undefined ? "" : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 6) Run it

From repo root:

```bash
npm run dev
```

Then in the Connect dialog, try:

- **SQL Express**: `.\SQLEXPRESS` or `localhost\SQLEXPRESS`
    
- **LocalDB**: `(localdb)\MSSQLLocalDB`
    

If it connects: you’ll immediately see tables/views + you can run queries.

---

## Next: Views + Foreign Keys + CRUD

We’ve already got listing views (done) and table “Top 100”.

Next I’d implement in this order:

1. **View definition viewer** (select view ➜ `sp_helptext` or sys.sql_modules)
    
2. **Foreign key graph** for a selected table
    
3. **Table CRUD** (start with Insert + Delete, then Update)
    

If you tell me which one you want first, I’ll drop the exact SQL + UI wiring for it (same style: “file + where to paste”).