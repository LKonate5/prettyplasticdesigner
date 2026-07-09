import type { Order } from '../core/schedule';
import { STR } from '../strings';

/**
 * Order-ready quantities in FULL square metres (Pretty Plastic ships no halves)
 * plus the number of europallets. Per-colour detail lives in the tile schedule
 * above; here it's the total to order.
 */
export function QuotePanel({
  order,
  wastePct,
  onWaste,
}: {
  order: Order;
  wastePct: number;
  onWaste: (pct: number) => void;
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
        <tbody>
          <tr>
            <td>{STR.onWall}</td>
            <td style={{ textAlign: 'right' }}>{order.onWallM2} m²</td>
          </tr>
          <tr>
            <td>
              {STR.toOrder} <span className="readout">(+{Math.round(wastePct * 100)}%)</span>
            </td>
            <td style={{ textAlign: 'right' }}>
              <strong>{order.toOrderM2} m²</strong>
            </td>
          </tr>
          <tr>
            <td>{STR.pallets}</td>
            <td style={{ textAlign: 'right' }}>
              <strong>{order.pallets}</strong>
            </td>
          </tr>
          <tr>
            <td>{STR.weight}</td>
            <td style={{ textAlign: 'right' }}>≈ {order.weightKg} kg</td>
          </tr>
        </tbody>
      </table>

      <p className="note">
        {STR.palletNote(order.palletM2)}
      </p>
    </div>
  );
}
