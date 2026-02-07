// electron/preload/index.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("dbforge", {
  open: (profile) => import_electron.ipcRenderer.invoke("db:open", { profile }),
  // ✅ FIX: close returns DbOkResponse (not DbOpenResponse)
  close: () => import_electron.ipcRenderer.invoke("db:close"),
  listDatabases: () => import_electron.ipcRenderer.invoke("db:listDatabases"),
  listTables: () => import_electron.ipcRenderer.invoke("db:listTables"),
  listViews: () => import_electron.ipcRenderer.invoke("db:listViews"),
  query: (sql) => import_electron.ipcRenderer.invoke("db:query", { sql }),
  // ✅ Strong typing (no more implicit any)
  describeTable: (fullName) => import_electron.ipcRenderer.invoke("db:describeTable", { fullName }),
  getPrimaryKey: (fullName) => import_electron.ipcRenderer.invoke("db:getPrimaryKey", { fullName }),
  updateCell: (req) => import_electron.ipcRenderer.invoke("db:updateCell", { req }),
  insertRow: (req) => import_electron.ipcRenderer.invoke("db:insertRow", { req })
});
//# sourceMappingURL=index.js.map