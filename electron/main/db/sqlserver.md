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



function buildConfig(profile: SqlServerConnectionProfile): sql.config {
  const rawServer = (profile.server ?? ".").trim();
  const server = normalizeServer(rawServer);
  const database = profile.database ?? "master";

  // IMPORTANT: use an explicit ODBC driver (match what sqlcmd is using)
  const driver = "ODBC Driver 17 for SQL Server";

  const encrypt = profile.encrypt ?? false;
  const trustServerCertificate = profile.trustServerCertificate ?? true;

  // Build an ODBC connection string (this is the most reliable for msnodesqlv8)
  const parts: string[] = [];
  parts.push(`Driver={${driver}}`);
  parts.push(`Server=${server}`);
  parts.push(`Database=${database}`);

  if (profile.auth.kind === "windows") {
    parts.push(`Trusted_Connection=Yes`);
  } else {
    parts.push(`Uid=${profile.auth.user}`);
    parts.push(`Pwd=${profile.auth.password}`);
  }

  // TLS / cert behavior (keep aligned with your UI toggles)
  // Note: TrustServerCertificate is typically required when Encrypt=Yes on local/self-signed.
  parts.push(`Encrypt=${encrypt ? "Yes" : "No"}`);
  parts.push(`TrustServerCertificate=${trustServerCertificate ? "Yes" : "No"}`);

  const connectionString = parts.join(";") + ";";

  // mssql/msnodesqlv8 expects this shape when using connectionString:
  return {
    driver,
    connectionString,
    options: {
      // still okay to include; connectionString is what matters
      trustedConnection: profile.auth.kind === "windows",
    },
  } as any;
}



export async function openDb(profile: SqlServerConnectionProfile) {
  await closeDb();
  const cfg = buildConfig(profile);

console.log("[db] connecting with cfg:", {
  server: (cfg as any).server,
  database: (cfg as any).database,
  trustedConnection: (cfg as any).options?.trustedConnection,
  user: (cfg as any).user ? "<set>" : "<none>",
  driver: (cfg as any).driver,
  connectionString: (cfg as any).connectionString ? "<set>" : "<none>",
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
