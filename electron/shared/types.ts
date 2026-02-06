// File: electron/shared/types.ts

export type SqlServerAuth =
  | { kind: "windows" }
  | { kind: "sql"; user: string; password: string };

export type SqlServerConnectionProfile = {
  name: string;
  server?: string;
  database?: string;
  auth: SqlServerAuth;
  encrypt?: boolean;
  trustServerCertificate?: boolean;

  /**
   * Optional raw ODBC connection string.
   * If provided, ForgeSQL will use this EXACT string to connect.
   */
  connectionString?: string;
};

export type DbOpenResponse = {
  ok: boolean;
  error?: string;

  /**
   * The actual connection string ForgeSQL used (raw if provided, generated otherwise).
   */
  connectionString?: string;
};

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