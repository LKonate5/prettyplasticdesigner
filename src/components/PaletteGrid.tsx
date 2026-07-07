import { Fragment } from 'react';
import type { ColourId, MaterialId, ShadeId } from '../core/types';
import { MATERIALS } from '../data/palette';
import { STR } from '../strings';

const COLOURS: { id: ColourId; label: string }[] = [
  { id: 'ochre', label: STR.colourOchre },
  { id: 'terracotta', label: STR.colourTerracotta },
  { id: 'green', label: STR.colourGreen },
  { id: 'grey', label: STR.colourGrey },
];

const SHADES: { id: ShadeId; label: string }[] = [
  { id: 'light', label: STR.shadeLight },
  { id: 'medium', label: STR.shadeMedium },
  { id: 'dark', label: STR.shadeDark },
];

const materialFor = (colour: ColourId, shade: ShadeId) =>
  MATERIALS.find((m) => m.colour === colour && m.shade === shade)!;

/**
 * The palette laid out as a labelled grid — shades across the top (Light /
 * Medium / Dark), colours down the side — so every swatch reads as e.g.
 * "Medium Grey" without a hover. Clicking a swatch selects the paint brush;
 * the corner dot toggles whether that material is in the auto-generated mix.
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
  const brushName = MATERIALS.find((m) => m.id === brush)?.name ?? '';

  return (
    <div className="section">
      <h2>{STR.palette}</h2>
      <p className="readout" style={{ marginBottom: 8 }}>
        {STR.paintingWith}:{' '}
        <strong style={{ color: 'var(--pp-ink)' }}>
          <span className="dot" style={{ background: MATERIALS.find((m) => m.id === brush)?.hex }} />
          {brushName}
        </strong>
      </p>

      <div className="palette-grid">
        <div className="corner" />
        {SHADES.map((s) => (
          <div key={s.id} className="shade-head">
            {s.label}
          </div>
        ))}
        {COLOURS.map((colour) => (
          <Fragment key={colour.id}>
            <div className="colour-label">{colour.label}</div>
            {SHADES.map((shade) => {
              const m = materialFor(colour.id, shade.id);
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
                  title={`${m.name} — click to paint; dot toggles the mix`}
                  onClick={() => onBrush(m.id)}
                >
                  <span
                    className="allow"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAllowed(m.id);
                    }}
                  />
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      <p className="note">{STR.paletteHint}</p>
      <button className="btn" style={{ marginTop: 6 }} onClick={onAllowAll}>
        {STR.allowAll}
      </button>
    </div>
  );
}
