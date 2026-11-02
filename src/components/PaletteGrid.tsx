import { Fragment } from 'react';
import type { ColourId, MaterialId, ProductId, ShadeId } from '../core/types';
import { isColourAllowedFor, MATERIALS } from '../data/palette';
import { STR } from '../strings';

const ALL_COLOURS: { id: ColourId; label: string }[] = [
  { id: 'ochre', label: STR.colourOchre },
  { id: 'terracotta', label: STR.colourTerracotta },
  { id: 'green', label: STR.colourGreen },
  { id: 'grey', label: STR.colourGrey },
  { id: 'blue', label: STR.colourBlue },
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
 * "Medium Grey" without a hover. Clicking anywhere on a swatch
 * puts that material in or out of the auto-generated mix and makes it the paint
 * brush; the corner dot only shows which state it is in.
 */
export function PaletteGrid({
  productId,
  brush,
  allowed,
  onBrush,
  onToggleAllowed,
  onAllowAll,
  shares,
  solid,
  onShare,
}: {
  productId: ProductId;
  brush: MaterialId;
  allowed: MaterialId[];
  onBrush: (id: MaterialId) => void;
  onToggleAllowed: (id: MaterialId) => void;
  onAllowAll: () => void;
  /** Each allowed material's share of the design (fractions adding up to 1). */
  shares: Map<MaterialId, number>;
  /** A solid wall has no mix to share out. */
  solid: boolean;
  onShare: (id: MaterialId, share: number) => void;
}) {
  const COLOURS = ALL_COLOURS.filter((c) => isColourAllowedFor(c.id, productId));
  const allowedSet = new Set(allowed);
  const brushName = MATERIALS.find((m) => m.id === brush)?.name ?? '';
  const brushAllowed = allowedSet.has(brush);
  const onlyOne = allowed.length <= 1;
  const sharePct = brushAllowed ? Math.round((shares.get(brush) ?? 0) * 100) : 0;
  const shareNote = solid
    ? STR.tileShareSolid
    : !brushAllowed
      ? STR.tileShareExcluded
      : onlyOne
        ? STR.tileShareOnly
        : STR.tileShareHint;

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
                  title={`${m.name} — ${isAllowed ? STR.clickToRemove : STR.clickToAdd}`}
                  aria-pressed={isAllowed}
                  aria-label={`${m.name}: ${isAllowed ? STR.inMix : STR.outOfMix}`}
                  onClick={() => {
                    onBrush(m.id);
                    onToggleAllowed(m.id);
                  }}
                >
                  <span className="allow" aria-hidden="true" />
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="share">
        <label htmlFor="share">
          {STR.tileShare}
          {!solid && (
            <>
              :{' '}
              <strong>
                {brushName} {sharePct}%
              </strong>
            </>
          )}
        </label>
        <input
          id="share"
          type="range"
          min={0}
          max={100}
          step={1}
          value={solid ? 0 : sharePct}
          disabled={solid || !brushAllowed || onlyOne}
          onChange={(e) => onShare(brush, Number(e.target.value) / 100)}
        />
        <p className="note">{shareNote}</p>
      </div>

      <p className="note">{STR.paletteHint}</p>
      <button className="btn" style={{ marginTop: 6 }} onClick={onAllowAll}>
        {STR.allowAll}
      </button>
    </div>
  );
}
