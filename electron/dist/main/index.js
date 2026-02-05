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
var import_electron = require("electron");
var import_path = __toESM(require("path"));

// electron/main/db/sqlserver.ts
var import_msnodesqlv8 = __toESM(require("mssql/msnodesqlv8"));
var pool = null;
function normalizeServer(raw) {
  const s0 = (raw ?? "").trim();
  const s = s0.replace(/^tcp:/i, "");
  const comma = s.lastIndexOf(",");
  if (comma > 0) {
    const host = s.substring(0, comma).trim();
    const portStr = s.substring(comma + 1).trim();
    const port = Number(portStr);
    if (Number.isFinite(port) && port > 0) return { host, port };
  }
  if (s.toLowerCase().startsWith("(localdb)\\")) {
    return { host: s };
  }
  if (s.startsWith(".\\")) {
    const instanceName = s.substring(2);
    return { host: "localhost", instanceName: instanceName || void 0 };
  }
  const idx = s.indexOf("\\");
  if (idx > 0) {
    const host = s.substring(0, idx);
    const instanceName = s.substring(idx + 1);
    return { host, instanceName: instanceName || void 0 };
  }
  if (s === ".") return { host: "(local)" };
  return { host: s || "localhost" };
}
function buildConfig(profile) {
  const encrypt = profile.encrypt ?? false;
  const trustServerCertificate = profile.trustServerCertificate ?? true;
  const normalized = normalizeServer(profile.server);
  const host = normalized.host === "." || normalized.host.toLowerCase() === "localhost" || normalized.host === "(local)" ? "." : normalized.host;
  const db = profile.database ?? "master";
  let serverPart = host;
  if (normalized.instanceName) serverPart = `${host}\\${normalized.instanceName}`;
  if (normalized.port) serverPart = `${host},${normalized.port}`;
  const parts = [];
  parts.push(`Server=${serverPart}`);
  parts.push(`Database=${db}`);
  if (profile.auth.kind === "sql") {
    parts.push(`Uid=${profile.auth.user}`);
    parts.push(`Pwd=${profile.auth.password}`);
  } else {
    parts.push(`Trusted_Connection=Yes`);
  }
  if (trustServerCertificate) parts.push(`TrustServerCertificate=Yes`);
  if (encrypt) parts.push(`Encrypt=Yes`);
  return {
    connectionString: parts.join(";") + ";"
  };
}
async function openDb(profile) {
  await closeDb();
  const cfg = buildConfig(profile);
  pool = await new import_msnodesqlv8.default.ConnectionPool(cfg).connect();
}
async function closeDb() {
  if (pool) {
    try {
      await pool.close();
    } finally {
      pool = null;
    }
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
  if (e.message) return String(e.message);
  if (e.originalError?.message) return String(e.originalError.message);
  if (e.code || e.number || e.state) {
    const bits = [
      e.code ? `code=${e.code}` : null,
      e.number ? `number=${e.number}` : null,
      e.state ? `state=${e.state}` : null,
      e.class ? `class=${e.class}` : null,
      e.serverName ? `server=${e.serverName}` : null
    ].filter(Boolean);
    const details = bits.length ? ` (${bits.join(", ")})` : "";
    return `Database error${details}`;
  }
  try {
    return JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
  } catch {
    return String(e);
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
      return { ok: true };
    } catch (e) {
      console.error("db:open failed raw:", e);
      console.error("db:open failed formatted:", formatError(e));
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
    console.error("db:open failed formatted:", formatError(e));
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
      console.error("db:open failed formatted:", formatError(e));
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
    console.error("db:open failed formatted:", formatError(e));
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
    console.error("db:open failed formatted:", formatError(e));
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
      console.error("db:open failed formatted:", formatError(e));
      return { ok: false, error: formatError(e) };
    }
  }
);
//# sourceMappingURL=index.js.map