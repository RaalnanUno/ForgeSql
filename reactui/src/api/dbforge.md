// File: reactui/src/api/dbforge.ts
import type {
  DbListDatabasesResponse,
  DbListTablesResponse,
  DbListViewsResponse,
  DbOpenResponse,
  DbOkResponse,
  DbQueryResponse,
  DbDescribeTableResponse,
  DbPrimaryKeyResponse,
  DbUpdateCellRequest,
  DbInsertRowRequest,
  SqlServerConnectionProfile,
} from "../../../electron/shared/types";

declare global {
  interface Window {
    dbforge: {
      open: (profile: SqlServerConnectionProfile) => Promise<DbOpenResponse>;
      close: () => Promise<DbOkResponse>;

      listDatabases: () => Promise<DbListDatabasesResponse>;
      listTables: () => Promise<DbListTablesResponse>;
      listViews: () => Promise<DbListViewsResponse>;

      query: (sql: string) => Promise<DbQueryResponse>;

      describeTable: (fullName: string) => Promise<DbDescribeTableResponse>;
      getPrimaryKey: (fullName: string) => Promise<DbPrimaryKeyResponse>;

      updateCell: (req: DbUpdateCellRequest) => Promise<DbOkResponse & { rowCount?: number }>;
      insertRow: (req: DbInsertRowRequest) => Promise<DbOkResponse & { rowCount?: number }>;
    };
  }
}

export const dbforge = window.dbforge;
