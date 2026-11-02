import type { Schedule } from '../core/schedule';
import { STR } from '../strings';

/**
 * Quote-ready tile schedule: count, %, and weight per material, plus totals
 * and the wall area. Counts include cut edge tiles (see footnote).
 */
export function SchedulePanel({ schedule, repeat = 1 }: { schedule: Schedule; repeat?: number }) {
  const area = schedule.areaM2 * repeat;
  const roundedArea = repeat === 1 ? schedule.roundedAreaM2 : Math.ceil(area - 1e-9);
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
              <td>{r.count * repeat}</td>
              <td>{r.pct.toFixed(1)}</td>
              <td>{(r.weightKg * repeat).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{STR.total}</td>
            <td>{schedule.totalTiles * repeat}</td>
            <td>100</td>
            <td>{(schedule.totalWeightKg * repeat).toFixed(1)}</td>
          </tr>
          <tr>
            <td>{STR.squareMetres} *</td>
            <td colSpan={3} style={{ textAlign: 'right' }}>
              {roundedArea} m²
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="readout" style={{ marginTop: 8 }}>
        {STR.area}: {area.toFixed(2)} m² &nbsp;·&nbsp; {schedule.effectiveTilesPerM2.toFixed(1)}{' '}
        {STR.tilesPerM2}
      </p>
      {repeat > 1 && <p className="note">{STR.repeatScheduleNote(repeat)}</p>}
      <p className="note">{STR.scheduleNote}</p>
      <p className="note">{STR.fullSqmNote}</p>
    </div>
  );
}
