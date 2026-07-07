import type { Schedule } from '../core/schedule';
import type { ProductSpec } from '../core/types';
import { STR } from '../strings';

/**
 * Quote-ready tile schedule: count, %, and weight per material, plus totals
 * and the wall area. Counts include cut edge tiles (see footnote).
 */
export function SchedulePanel({
  schedule,
  product,
}: {
  schedule: Schedule;
  product: ProductSpec;
}) {
  return (
    <div className="section">
      <h2>{STR.schedule}</h2>
      <table className="schedule">
        <thead>
          <tr>
            <th>{STR.material}</th>
            <th>{STR.count}</th>
            <th>%</th>
            <th>{STR.weightKg}</th>
          </tr>
        </thead>
        <tbody>
          {schedule.rows.map((r) => (
            <tr key={r.material.id}>
              <td>
                <span className="dot" style={{ background: r.material.hex }} />
                {r.material.name}
              </td>
              <td>{r.count}</td>
              <td>{r.pct.toFixed(1)}</td>
              <td>{r.weightKg.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{STR.total}</td>
            <td>{schedule.totalTiles}</td>
            <td>100</td>
            <td>{schedule.totalWeightKg.toFixed(1)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="readout" style={{ marginTop: 8 }}>
        {STR.area}: {schedule.areaM2.toFixed(2)} m² &nbsp;·&nbsp; {product.nominalTilesPerM2}{' '}
        {STR.tilesPerM2}
      </p>
      <p className="note">{STR.scheduleNote}</p>
    </div>
  );
}
