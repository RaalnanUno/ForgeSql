// File: electron/shared/types.ts

export type DbColumnInfo = {
  name: string;
  dataType: string;
  isNullable: boolean;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  isIdentity: boolean;
};

export type DbDescribeTableResponse = {
  ok: boolean;
  error?: string;
  columns?: DbColumnInfo[];
};

export type DbPrimaryKeyResponse = {
  ok: boolean;
  error?: string;
  primaryKey?: string[];
};

export type DbUpdateCellRequest = {
  fullName: string;                 // dbo.Table
  pk: Record<string, any>;          // { Id: 123 } or composite
  column: string;                   // ColumnName
  value: any;                       // New value
};

export type DbInsertRowRequest = {
  fullName: string;
  values: Record<string, any>;      // { ColA: 1, ColB: "x" } (exclude identity)
};

export type DbOkResponse = { ok: boolean; error?: string };

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