import { contextBridge, ipcRenderer } from "electron";
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
} from "../shared/types";


contextBridge.exposeInMainWorld("dbforge", {
  open: (profile: SqlServerConnectionProfile) =>
    ipcRenderer.invoke("db:open", { profile }) as Promise<DbOpenResponse>,

  // ✅ FIX: close returns DbOkResponse (not DbOpenResponse)
  close: () => ipcRenderer.invoke("db:close") as Promise<DbOkResponse>,

  listDatabases: () =>
    ipcRenderer.invoke("db:listDatabases") as Promise<DbListDatabasesResponse>,

  listTables: () =>
    ipcRenderer.invoke("db:listTables") as Promise<DbListTablesResponse>,

  listViews: () =>
    ipcRenderer.invoke("db:listViews") as Promise<DbListViewsResponse>,

  query: (sql: string) =>
    ipcRenderer.invoke("db:query", { sql }) as Promise<DbQueryResponse>,

  // ✅ Strong typing (no more implicit any)
  describeTable: (fullName: string) =>
    ipcRenderer.invoke("db:describeTable", { fullName }) as Promise<DbDescribeTableResponse>,

  getPrimaryKey: (fullName: string) =>
    ipcRenderer.invoke("db:getPrimaryKey", { fullName }) as Promise<DbPrimaryKeyResponse>,

  updateCell: (req: DbUpdateCellRequest) =>
    ipcRenderer.invoke("db:updateCell", { req }) as Promise<DbOkResponse & { rowCount?: number }>,

  insertRow: (req: DbInsertRowRequest) =>
    ipcRenderer.invoke("db:insertRow", { req }) as Promise<DbOkResponse & { rowCount?: number }>,
});

