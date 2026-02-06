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
    connectionString: cfg.connectionString ? "<present>" : "<missing>"
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
async function queryText(sqlText) {
  if (!pool) throw new Error("No open connection.");
  const resp = await pool.request().query(sqlText);
  const recordset = resp.recordset ?? [];
  const columns = recordset.length ? Object.keys(recordset[0]) : [];
  const rows = recordset.map((r) => columns.map((c) => r[c]));
  return { columns, rows, rowCount: resp.rowsAffected?.[0] ?? 0 };
}

// electron/main/db/queries.ts
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
  else
    await win.loadFile(
      import_path.default.join(__dirname, "../../../reactui/dist/index.html")
    );
}
import_electron.app.whenReady().then(createWindow);
import_electron.app.on("window-all-closed", async () => {
  await closeDb();
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.ipcMain.handle(
  "db:open",
  async (_evt, args) => {
    try {
      await openDb(args.profile);
      const used = (args.profile.connectionString ?? "").trim() || buildOdbcConnectionString(args.profile).connectionString;
      return { ok: true, connectionString: used };
    } catch (e) {
      console.error("db:open failed raw:", e);
      console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
      if (e?.originalError) {
        console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
      }
      if (e?.cause) {
        console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
      }
      return { ok: false, error: formatError(e) };
    }
  }
);
import_electron.ipcMain.handle("db:close", async () => {
  try {
    await closeDb();
    return { ok: true };
  } catch (e) {
    console.error("db:open failed raw:", e);
    console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
    if (e?.originalError) {
      console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
    }
    if (e?.cause) {
      console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
    }
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle(
  "db:listDatabases",
  async () => {
    try {
      const r = await queryText(listDatabasesSql);
      const databases = r.rows.map((x) => String(x[0]));
      return { ok: true, databases };
    } catch (e) {
      console.error("db:open failed raw:", e);
      console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
      if (e?.originalError) {
        console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
      }
      if (e?.cause) {
        console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
      }
      return { ok: false, error: formatError(e) };
    }
  }
);
import_electron.ipcMain.handle("db:listTables", async () => {
  try {
    const r = await queryText(listTablesSql);
    const tables = r.rows.map((x) => String(x[0]));
    return { ok: true, tables };
  } catch (e) {
    console.error("db:open failed raw:", e);
    console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
    if (e?.originalError) {
      console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
    }
    if (e?.cause) {
      console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
    }
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle("db:listViews", async () => {
  try {
    const r = await queryText(listViewsSql);
    const views = r.rows.map((x) => String(x[0]));
    return { ok: true, views };
  } catch (e) {
    console.error("db:open failed raw:", e);
    console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
    if (e?.originalError) {
      console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
    }
    if (e?.cause) {
      console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
    }
    return { ok: false, error: formatError(e) };
  }
});
import_electron.ipcMain.handle(
  "db:query",
  async (_evt, args) => {
    try {
      const r = await queryText(args.sql);
      return {
        ok: true,
        result: { columns: r.columns, rows: r.rows },
        rowCount: r.rowCount
      };
    } catch (e) {
      console.error("db:open failed raw:", e);
      console.error("db:open failed inspect:", import_util.default.inspect(e, { depth: 10, colors: false, showHidden: true }));
      if (e?.originalError) {
        console.error("db:open originalError inspect:", import_util.default.inspect(e.originalError, { depth: 10, colors: false, showHidden: true }));
      }
      if (e?.cause) {
        console.error("db:open cause inspect:", import_util.default.inspect(e.cause, { depth: 10, colors: false, showHidden: true }));
      }
      return { ok: false, error: formatError(e) };
    }
  }
);
//# sourceMappingURL=index.js.map