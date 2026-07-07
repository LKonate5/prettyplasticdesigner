import type { Order } from '../core/schedule';
import { STR } from '../strings';

/**
 * Order-ready quantities: waste allowance, per-colour amounts rounded up, and
 * (when a tiles-per-box figure is given) the number of boxes to order.
 */
export function QuotePanel({
  order,
  wastePct,
  tilesPerBox,
  onWaste,
  onTilesPerBox,
}: {
  order: Order;
  wastePct: number;
  tilesPerBox: number | null;
  onWaste: (pct: number) => void;
  onTilesPerBox: (n: number | null) => void;
}) {
  return (
    <div className="section">
      <h2>{STR.order}</h2>

      <div className="field">
        <label htmlFor="waste">
          {STR.waste}: {Math.round(wastePct * 100)}%
        </label>
        <input
          id="waste"
          type="range"
          min={0}
          max={0.25}
          step={0.01}
          value={wastePct}
          onChange={(e) => onWaste(Number(e.target.value))}
        />
      </div>

      <table className="schedule">
        <thead>
          <tr>
            <th>{STR.material}</th>
            <th>{STR.onWall}</th>
            <th>{STR.toOrder}</th>
          </tr>
        </thead>
        <tbody>
          {order.rows.map((r) => (
            <tr key={r.material.id}>
              <td>
                <span className="dot" style={{ background: r.material.hex }} />
                {r.material.name}
              </td>
              <td>{r.need}</td>
              <td>
                <strong>{r.order}</strong>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{STR.total}</td>
            <td>{order.totalNeed}</td>
            <td>
              <strong>{order.totalOrder}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="readout" style={{ marginTop: 8 }}>
        {order.areaToOrderM2.toFixed(1)} m² · {order.weightToOrderKg.toFixed(0)} kg
        {order.boxes !== null && (
          <>
            {' '}
            · <strong>{order.boxes}</strong> {STR.boxesNeeded}
          </>
        )}
      </p>

      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="perbox">{STR.tilesPerBox}</label>
        <input
          id="perbox"
          type="number"
          min={1}
          placeholder="—"
          value={tilesPerBox ?? ''}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onTilesPerBox(Number.isFinite(n) && n > 0 ? n : null);
          }}
        />
        <p className="note">{STR.tilesPerBoxHint}</p>
      </div>

      <p className="note">{STR.orderNote}</p>
    </div>
  );
}
