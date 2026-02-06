// File: electron/main/db/sqlserver.ts
import sql from "mssql/msnodesqlv8";
import { SqlServerConnectionProfile } from "../../shared/types";

let pool: sql.ConnectionPool | null = null;

function normalizeServer(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return ".";

  const lower = s.toLowerCase();
  if (s === "." || lower === "localhost" || lower === "(local)") return ".";

  return s;
}

export function buildOdbcConnectionString(profile: SqlServerConnectionProfile): {
  driver: string;
  connectionString: string;
} {
  const rawServer = (profile.server ?? ".").trim();
  const server = normalizeServer(rawServer);
  const database = profile.database ?? "master";

  // IMPORTANT: use an explicit ODBC driver (match what sqlcmd is using)
  const driver = "ODBC Driver 17 for SQL Server";

  const encrypt = profile.encrypt ?? false;
  const trustServerCertificate = profile.trustServerCertificate ?? true;

  const parts: string[] = [];
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

function buildConfig(profile: SqlServerConnectionProfile): sql.config {
  // If user provided a raw connection string, use it exactly.
  const raw = (profile.connectionString ?? "").trim();
  if (raw) {
    // Keep driver consistent with how msnodesqlv8 likes it.
    // If their raw string already includes Driver=... it’s fine.
    return {
      driver: "ODBC Driver 17 for SQL Server",
      connectionString: raw.endsWith(";") ? raw : raw + ";",
      options: {
        trustedConnection: profile.auth.kind === "windows",
      },
    } as any;
  }

  // Otherwise generate.
  const built = buildOdbcConnectionString(profile);
  return {
    driver: built.driver,
    connectionString: built.connectionString,
    options: {
      trustedConnection: profile.auth.kind === "windows",
    },
  } as any;
}

export async function openDb(profile: SqlServerConnectionProfile) {
  await closeDb();
  const cfg = buildConfig(profile);

  console.log("[db] connecting with cfg:", {
    driver: (cfg as any).driver,
    connectionString: (cfg as any).connectionString ? "<present>" : "<missing>",
  });

  pool = await new sql.ConnectionPool(cfg).connect();
}

export async function closeDb() {
  if (!pool) return;
  try {
    await pool.close();
  } finally {
    pool = null;
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
