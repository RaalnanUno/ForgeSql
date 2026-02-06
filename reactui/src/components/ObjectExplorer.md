// File: reactui/src/components/ObjectExplorer.tsx

type Props = {
  disabled: boolean;
  views: string[];
  onRefresh: () => void;
  onSelectTop: (fullName: string) => void;
};

export default function ObjectExplorer({ disabled, views, onRefresh, onSelectTop }: Props) {
  return (
    <div className="p-2">
      <div className="d-flex align-items-center mb-2">
        <div className="fw-semibold">Object Explorer</div>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={onRefresh} disabled={disabled}>
          <i className="bi bi-arrow-clockwise me-1" />
          Refresh
        </button>
      </div>

      {/* Databases... unchanged */}

      <div>
        <div className="text-muted small mb-1">Views</div>
        <ul className="list-group">
          {views.map((v) => (
            <li key={v} className="list-group-item py-1 d-flex align-items-center">
              <span className="text-truncate" title={v}>
                {v}
              </span>
              <button
                className="btn btn-sm btn-outline-success ms-auto"
                onClick={() => onSelectTop(v)}
                disabled={disabled}
                title="Select Top 100"
              >
                Open
              </button>
            </li>
          ))}
          {!views.length && <li className="list-group-item py-1 text-muted">None</li>}
        </ul>
      </div>
    </div>
  );
}
