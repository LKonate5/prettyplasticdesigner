import type { MaterialId } from '../core/types';
import { MATERIALS } from '../data/palette';
import { STR } from '../strings';

/**
 * The 4×3 colour/shade grid. Clicking a swatch selects it as the paint brush;
 * the little top-right dot toggles whether that material is allowed in
 * generated patterns (palette restriction).
 */
export function PaletteGrid({
  brush,
  allowed,
  onBrush,
  onToggleAllowed,
  onAllowAll,
}: {
  brush: MaterialId;
  allowed: MaterialId[];
  onBrush: (id: MaterialId) => void;
  onToggleAllowed: (id: MaterialId) => void;
  onAllowAll: () => void;
}) {
  const allowedSet = new Set(allowed);
  return (
    <div className="section">
      <h2>{STR.palette}</h2>
      <div className="swatches">
        {MATERIALS.map((m) => {
          const isAllowed = allowedSet.has(m.id);
          const classes = [
            'swatch',
            m.id === brush ? 'brush' : '',
            isAllowed ? 'allowed' : 'excluded',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={m.id}
              className={classes}
              style={{ background: m.hex }}
              title={m.name}
              onClick={() => onBrush(m.id)}
            >
              <span
                className="allow"
                title={isAllowed ? 'In pattern mix' : 'Excluded from mix'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAllowed(m.id);
                }}
              />
            </button>
          );
        })}
      </div>
      <p className="note">{STR.paletteHint}</p>
      <button className="btn" style={{ marginTop: 6 }} onClick={onAllowAll}>
        {STR.allowAll}
      </button>
    </div>
  );
}
