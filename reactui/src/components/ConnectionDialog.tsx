import { useMemo, useState } from "react";
import type { SqlServerConnectionProfile } from "../../../electron/shared/types";

type Props = {
  show: boolean;
  onClose: () => void;
  onConnect: (profile: SqlServerConnectionProfile) => void;
};

// bump the key when you want to invalidate old saved profiles
const LS_KEY = "forgesql.lastProfile.v2";

const DEFAULT_PROFILE: SqlServerConnectionProfile = {
  name: "Local SQL Server",
  server: "localhost",
  database: "master",
  auth: { kind: "windows" },
  encrypt: false,
  trustServerCertificate: true
};

function loadProfileFromStorage(): SqlServerConnectionProfile {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PROFILE;

    const parsed = JSON.parse(raw) as SqlServerConnectionProfile;

    // Lightweight “defensive defaults” so a bad saved value won’t break the dialog
    return {
      name: parsed.name ?? DEFAULT_PROFILE.name,
      server: parsed.server ?? DEFAULT_PROFILE.server,
      database: parsed.database ?? DEFAULT_PROFILE.database,
      auth:
        parsed.auth?.kind === "sql"
          ? { kind: "sql", user: parsed.auth.user ?? "", password: parsed.auth.password ?? "" }
          : { kind: "windows" },
      encrypt: parsed.encrypt ?? DEFAULT_PROFILE.encrypt,
      trustServerCertificate: parsed.trustServerCertificate ?? DEFAULT_PROFILE.trustServerCertificate
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

type AuthKind = "windows" | "sql";

export default function ConnectionDialog({ show, onClose, onConnect }: Props) {
  // Initialize from localStorage *once*, no effect needed.
  const [initial] = useState(() => loadProfileFromStorage());

  const [name, setName] = useState(initial.name);
  const [server, setServer] = useState(initial.server);
  const [database, setDatabase] = useState(initial.database ?? "master");
  const [authKind, setAuthKind] = useState<AuthKind>(initial.auth.kind === "sql" ? "sql" : "windows");
  const [user, setUser] = useState(initial.auth.kind === "sql" ? initial.auth.user : "");
  const [password, setPassword] = useState(initial.auth.kind === "sql" ? initial.auth.password : "");
  const [encrypt, setEncrypt] = useState<boolean>(initial.encrypt ?? false);
  const [trustServerCertificate, setTrustServerCertificate] = useState<boolean>(initial.trustServerCertificate ?? true);

  const profile: SqlServerConnectionProfile = useMemo(() => {
    return {
      name,
      server,
      database: database || undefined,
      auth: authKind === "windows" ? { kind: "windows" } : { kind: "sql", user, password },
      encrypt,
      trustServerCertificate
    };
  }, [name, server, database, authKind, user, password, encrypt, trustServerCertificate]);

  function handleConnect() {
    localStorage.setItem(LS_KEY, JSON.stringify(profile));
    onConnect(profile);
  }

  if (!show) return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded shadow position-absolute top-50 start-50 translate-middle p-3" style={{ width: 520 }}>
        <div className="d-flex align-items-center mb-2">
          <h5 className="mb-0">Connect to SQL Server</h5>
          <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-2">
          <label className="form-label">Profile Name</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="mb-2">
          <label className="form-label">Server</label>
          <input
            className="form-control"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="localhost  |  .  |  localhost\\INSTANCE  |  localhost,1433"
          />
          <div className="form-text">
            Default instance: <code>localhost</code> or <code>.</code> <br />
            Named instance: <code>localhost\SQLEXPRESS</code> <br />
            Port: <code>localhost,1433</code>
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label">Database</label>
          <input className="form-control" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="master" />
        </div>

        <div className="mb-2">
          <label className="form-label">Authentication</label>
          <select
            className="form-select"
            value={authKind}
            onChange={(e) => setAuthKind(e.target.value === "sql" ? "sql" : "windows")}
          >
            <option value="windows">Windows (Trusted Connection)</option>
            <option value="sql">SQL Login (user/password)</option>
          </select>
        </div>

        {authKind === "sql" && (
          <div className="row g-2 mb-2">
            <div className="col-6">
              <label className="form-label">User</label>
              <input className="form-control" value={user} onChange={(e) => setUser(e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        )}

        <div className="row g-2 mb-3">
          <div className="col-6">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} id="chkEncrypt" />
              <label className="form-check-label" htmlFor="chkEncrypt">
                Encrypt
              </label>
            </div>
          </div>
          <div className="col-6">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={trustServerCertificate}
                onChange={(e) => setTrustServerCertificate(e.target.checked)}
                id="chkTrust"
              />
              <label className="form-check-label" htmlFor="chkTrust">
                Trust Server Certificate
              </label>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={handleConnect}>
            <i className="bi bi-plug me-1" />
            Connect
          </button>
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
