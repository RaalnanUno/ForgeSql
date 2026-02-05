import type { DbQueryResult } from "../../../electron/shared/types";

type Props = {
  result: DbQueryResult | null;
};

export default function ResultsGrid({ result }: Props) {
  if (!result) return <div className="text-muted">No results yet.</div>;

  const { columns, rows } = result;

  if (!columns.length) return <div className="text-muted">Query ran, but returned no tabular results.</div>;

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped table-hover align-middle">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              {r.map((cell, cidx) => (
                <td key={cidx} className="text-nowrap">
                  {cell === null || cell === undefined ? "" : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
