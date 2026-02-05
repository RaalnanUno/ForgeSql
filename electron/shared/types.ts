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