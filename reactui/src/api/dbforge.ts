import type {
  DbListDatabasesResponse,
  DbListTablesResponse,
  DbListViewsResponse,
  DbOpenResponse,
  DbQueryResponse,
  SqlServerConnectionProfile,
} from "../../../electron/shared/types";

declare global {
  interface Window {
    dbforge: {
      open: (profile: SqlServerConnectionProfile) => Promise<DbOpenResponse>;
      close: () => Promise<DbOpenResponse>;
      listDatabases: () => Promise<DbListDatabasesResponse>;
      listTables: () => Promise<DbListTablesResponse>;
      listViews: () => Promise<DbListViewsResponse>;
      query: (sql: string) => Promise<DbQueryResponse>;
    };
  }
}

export const dbforge = window.dbforge;
