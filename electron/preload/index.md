import { contextBridge, ipcRenderer } from "electron";
import {
  DbListDatabasesResponse,
  DbListTablesResponse,
  DbListViewsResponse,
  DbOpenResponse,
  DbQueryResponse,
  SqlServerConnectionProfile,
} from "../shared/types";

contextBridge.exposeInMainWorld("dbforge", {
  open: (profile: SqlServerConnectionProfile) =>
    ipcRenderer.invoke("db:open", { profile }) as Promise<DbOpenResponse>,
  close: () => ipcRenderer.invoke("db:close") as Promise<DbOpenResponse>,
  listDatabases: () => ipcRenderer.invoke("db:listDatabases") as Promise<DbListDatabasesResponse>,
  listTables: () => ipcRenderer.invoke("db:listTables") as Promise<DbListTablesResponse>,
  listViews: () => ipcRenderer.invoke("db:listViews") as Promise<DbListViewsResponse>,
  query: (sql: string) => ipcRenderer.invoke("db:query", { sql }) as Promise<DbQueryResponse>,
});