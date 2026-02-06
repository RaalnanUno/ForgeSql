// File: reactui/src/App.tsx
import { useMemo, useState } from "react";
import { dbforge } from "./api/dbforge";
import type { DbQueryResult, SqlServerConnectionProfile } from "../../electron/shared/types";
import ConnectionDialog from "./components/ConnectionDialog";
import ObjectExplorer from "./components/ObjectExplorer";
import QueryEditor from "./components/QueryEditor";
import ResultsGrid from "./components/ResultsGrid";
import TableEditor from "./components/TableEditor";

type ConnState = "disconnected" | "connected";

export default function App() {
  const [connState, setConnState] = useState<ConnState>("disconnected");
  const [activeDb, setActiveDb] = useState<string>("");

  const [tables, setTables] = useState<string[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);

  const [sqlText, setSqlText] = useState<string>("SELECT @@VERSION AS Version;");
  const [result, setResult] = useState<DbQueryResult | null>(null);

  const [status, setStatus] = useState<string>("Ready.");
  const [showConnect, setShowConnect] = useState<boolean>(true);

  // When set, the Results pane will prefer the TableEditor.
  const [activeTable, setActiveTable] = useState<string | null>(null);

  const canQuery = useMemo(() => connState === "connected", [connState]);

  async function refreshExplorer() {
    setStatus("Refreshing object explorer...");
    const [dbs, tbls, vws] = await Promise.all([dbforge.listDatabases(), dbforge.listTables(), dbforge.listViews()]);

    if (!dbs.ok) return setStatus(`Error: ${dbs.error}`);
    if (!tbls.ok) return setStatus(`Error: ${tbls.error}`);
    if (!vws.ok) return setStatus(`Error: ${vws.error}`);

    setDatabases(dbs.databases);
    setTables(tbls.tables);
    setViews(vws.views);
    setStatus("Ready.");
  }

  async function runQuery(sql: string) {
    if (!canQuery) return;
    setStatus("Running query...");
    const resp = await dbforge.query(sql);
    if (!resp.ok) {
      setStatus(`Error: ${resp.error}`);
      return;
    }
    setResult(resp.result);
    setStatus(`OK (${resp.rowCount} rows affected).`);
  }

  async function connect(profile: SqlServerConnectionProfile) {
    setStatus("Connecting...");

    const openResp = await dbforge.open(profile);
    if (!openResp.ok) {
      setStatus(`Connect failed: ${openResp.error}`);
      setConnState("disconnected");
      return;
    }

    if (openResp.connectionString) {
      setStatus("Connected. Connection string available in Connect dialog.");
    }

    setConnState("connected");
    setActiveDb(profile.database ?? "");
    setShowConnect(false);

    // reset view state
    setActiveTable(null);

    await refreshExplorer();
    await runQuery("SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName;");
  }

  async function disconnect() {
    setStatus("Disconnecting...");
    const closeResp = await dbforge.close();
    if (!closeResp.ok) {
      setStatus(`Disconnect failed: ${closeResp.error}`);
      return;
    }

    setConnState("disconnected");
    setActiveDb("");

    setTables([]);
    setViews([]);
    setDatabases([]);

    setResult(null);
    setActiveTable(null);

    setStatus("Disconnected.");
    setShowConnect(true);
  }

  return (
    <div className="container-fluid vh-100 d-flex flex-column p-0">
      <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
        <span className="navbar-brand mb-0 h1">ForgeSQL Studio</span>

        <div className="ms-auto d-flex gap-2 align-items-center">
          <span className="text-light small">
            {connState === "connected" ? `Connected${activeDb ? ` (${activeDb})` : ""}` : "Disconnected"}
          </span>

          <button className="btn btn-sm btn-outline-light" onClick={() => setShowConnect(true)}>
            <i className="bi bi-plug me-1" />
            Connect
          </button>

          <button className="btn btn-sm btn-outline-warning" onClick={disconnect} disabled={connState !== "connected"}>
            <i className="bi bi-x-octagon me-1" />
            Disconnect
          </button>
        </div>
      </nav>

      <div className="flex-grow-1 d-flex" style={{ minHeight: 0, overflow: "hidden" }}>
        {/* LEFT PANE */}
        <div style={{ flex: "0 0 320px", minWidth: 320, maxWidth: 320, overflow: "hidden" }}>
          <div className="h-100 p-2">
            <div className="card h-100">
              <div className="card-header d-flex align-items-center justify-content-between py-2">
                <span className="fw-semibold">Object Explorer</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={refreshExplorer} disabled={connState !== "connected"}>
                  <i className="bi bi-arrow-clockwise me-1" />
                  Refresh
                </button>
              </div>

              <div className="card-body p-2" style={{ overflow: "auto" }}>
                <ObjectExplorer
                  disabled={connState !== "connected"}
                  databases={databases}
                  tables={tables}
                  views={views}
                  onRefresh={refreshExplorer}
                  onSelectTop={(fullName) => {
                    setActiveTable(fullName);
                    const q = `SELECT TOP (100) * FROM ${fullName};`;
                    setSqlText(q);
                    runQuery(q);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div className="p-2">
            <div className="card">
              <div className="card-header py-2 fw-semibold">Query</div>
              <div className="card-body p-2">
                <QueryEditor
                  disabled={connState !== "connected"}
                  sql={sqlText}
                  onChange={(s) => {
                    // If they start writing manual SQL, switch out of TableEditor mode
                    setSqlText(s);
                    setActiveTable(null);
                  }}
                  onRun={() => {
                    setActiveTable(null);
                    runQuery(sqlText);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex-grow-1 p-2" style={{ overflow: "hidden", minHeight: 0 }}>
            <div className="card h-100">
              <div className="card-header py-2 fw-semibold">
                Results
                {activeTable ? <span className="text-muted ms-2 small">({activeTable})</span> : null}
              </div>

              <div className="card-body p-2" style={{ overflow: "auto", minHeight: 0 }}>
                {activeTable && result ? (
                  <TableEditor
                    fullName={activeTable}
                    columns={result.columns}
                    rows={result.rows}
                    onStatus={setStatus}
                  />
                ) : (
                  <ResultsGrid result={result} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-light border-top px-3 py-2 small text-muted">{status}</div>

      <ConnectionDialog show={showConnect} onClose={() => setShowConnect(false)} onConnect={connect} />
    </div>
  );
}
