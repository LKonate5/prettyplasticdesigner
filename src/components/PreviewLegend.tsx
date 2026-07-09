import type { Schedule } from '../core/schedule';
import { STR } from '../strings';

/**
 * Compact colour legend shown in the corner of the live preview: the mix of
 * colours on the wall with counts, plus the total and area. pointer-events are
 * off so it never blocks painting underneath. The same legend is baked into
 * the raster export (see export/legend.ts).
 */
export function PreviewLegend({ schedule }: { schedule: Schedule }) {
  return (
    <div className="legend">
      <div className="legend-title">
        {STR.schedule} · {schedule.totalTiles} · {schedule.areaM2.toFixed(1)} m²
      </div>
      {schedule.rows.map((r) => (
        <div className="legend-row" key={r.material.id}>
          <span className="dot" style={{ background: r.material.hex }} />
          <span className="legend-name">{r.material.name}</span>
          <span className="legend-count">
            {r.count} · {r.pct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
