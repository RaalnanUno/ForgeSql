import sql from "mssql/msnodesqlv8";

import { SqlServerConnectionProfile } from "../../shared/types";

let pool: sql.ConnectionPool | null = null;

type NormalizedServer = { host: string; instanceName?: string; port?: number };
type NodeSqlV8Config = {
  connectionString: string;
  options?: {
    // keep these optional; msnodesqlv8 uses connectionString primarily
    trustServerCertificate?: boolean;
    encrypt?: boolean;
  };
};

function normalizeServer(raw: string): NormalizedServer {
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
    return { host: s }; // might still be flaky; default instance is easier
  }

  if (s.startsWith(".\\")) {
    const instanceName = s.substring(2);
    return { host: "localhost", instanceName: instanceName || undefined };
  }

  const idx = s.indexOf("\\");
  if (idx > 0) {
    const host = s.substring(0, idx);
    const instanceName = s.substring(idx + 1);
    return { host, instanceName: instanceName || undefined };
  }
  
  if (s === ".") return { host: "(local)" };
  return { host: s || "localhost" };
}

function buildConfig(profile: SqlServerConnectionProfile): NodeSqlV8Config {
  const encrypt = profile.encrypt ?? false;
  const trustServerCertificate = profile.trustServerCertificate ?? true;

  const normalized = normalizeServer(profile.server);

  // Use "." by default (matches your sqlcmd success)
  const host =
    normalized.host === "." || normalized.host.toLowerCase() === "localhost" || normalized.host === "(local)"
      ? "."
      : normalized.host;

  const db = profile.database ?? "master";

  let serverPart = host;
  if (normalized.instanceName) serverPart = `${host}\\${normalized.instanceName}`;
  if (normalized.port) serverPart = `${host},${normalized.port}`;

  const parts: string[] = [];
  parts.push(`Server=${serverPart}`);
  parts.push(`Database=${db}`);

  if (profile.auth.kind === "sql") {
    parts.push(`Uid=${profile.auth.user}`);
    parts.push(`Pwd=${profile.auth.password}`);
  } else {
    // both work; SSMS/sqlcmd style is Trusted_Connection
    parts.push(`Trusted_Connection=Yes`);
  }

  if (trustServerCertificate) parts.push(`TrustServerCertificate=Yes`);
  if (encrypt) parts.push(`Encrypt=Yes`);

  return {
    connectionString: parts.join(";") + ";"
  };
}

export async function openDb(profile: SqlServerConnectionProfile) {
  await closeDb();
  const cfg = buildConfig(profile);
  pool = await new sql.ConnectionPool(cfg as any).connect();
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

export async function queryText(sqlText: string) {
  if (!pool) throw new Error("No open connection.");
  const resp = await pool.request().query(sqlText);

  const recordset = resp.recordset ?? [];
  const columns = recordset.length ? Object.keys(recordset[0]) : [];
  const rows = recordset.map((r: any) => columns.map((c) => r[c]));

  return { columns, rows, rowCount: resp.rowsAffected?.[0] ?? 0 };
}
