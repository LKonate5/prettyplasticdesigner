import { useState } from 'react';
import { metresToGrid } from '../core/layout';
import type { Layout, ProductOptions, ProductSpec } from '../core/types';
import { STR } from '../strings';
import { DraftNumberInput } from './DraftNumberInput';

function formatM(mm: number): string {
  return (mm / 1000).toFixed(2);
}

/**
 * Wall sizing. The primary input is real-world metres (architects think that
 * way); it converts to rows × columns via the product geometry. Rows/columns
 * stay available underneath for precise control. Plus Basic Third's visible
 * row height + bond, and a live dimension readout.
 */
export function DimensionInputs({
  product,
  rows,
  cols,
  options,
  layout,
  onGrid,
  onOptions,
}: {
  product: ProductSpec;
  rows: number;
  cols: number;
  options: ProductOptions;
  layout: Layout;
  onGrid: (next: { rows?: number; cols?: number }) => void;
  onOptions: (next: Partial<ProductOptions>) => void;
}) {
  const areaM2 = (layout.wallW * layout.wallH) / 1_000_000;
  const [showGrid, setShowGrid] = useState(false);
  // Draft strings for the metre fields so typing "3." works; commit on change.
  const [wDraft, setWDraft] = useState<string | null>(null);
  const [hDraft, setHDraft] = useState<string | null>(null);
  const wVal = wDraft ?? formatM(layout.wallW);
  const hVal = hDraft ?? formatM(layout.wallH);

  const applyMetres = (widthM: number, heightM: number) => {
    onGrid(metresToGrid(product, options, widthM, heightM));
  };

  return (
    <div className="section">
      <h2>{STR.wallSize}</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="wm">{STR.widthM}</label>
          <input
            id="wm"
            type="number"
            min={0.3}
            step={0.1}
            value={wVal}
            onChange={(e) => {
              setWDraft(e.target.value);
              const w = parseFloat(e.target.value);
              if (Number.isFinite(w)) applyMetres(w, parseFloat(hVal));
            }}
            onBlur={() => setWDraft(null)}
          />
        </div>
        <div className="field">
          <label htmlFor="hm">{STR.heightM}</label>
          <input
            id="hm"
            type="number"
            min={0.3}
            step={0.1}
            value={hVal}
            onChange={(e) => {
              setHDraft(e.target.value);
              const h = parseFloat(e.target.value);
              if (Number.isFinite(h)) applyMetres(parseFloat(wVal), h);
            }}
            onBlur={() => setHDraft(null)}
          />
        </div>
      </div>

      <button
        className="btn"
        style={{ fontSize: 12, padding: '4px 8px' }}
        onClick={() => setShowGrid((s) => !s)}
      >
        {showGrid ? '▾ ' : '▸ '}
        {STR.advancedGrid}
      </button>

      {showGrid && (
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field">
            <label htmlFor="rows">{STR.rows}</label>
            <DraftNumberInput
              id="rows"
              min={1}
              max={80}
              value={rows}
              onCommit={(n) => onGrid({ rows: n })}
            />
          </div>
          <div className="field">
            <label htmlFor="cols">{STR.columns}</label>
            <DraftNumberInput
              id="cols"
              min={1}
              max={80}
              value={cols}
              onCommit={(n) => onGrid({ cols: n })}
            />
          </div>
        </div>
      )}

      {product.hasBond && (
        <div className="field">
          <label>{STR.bond}</label>
          <div className="seg">
            <button
              className={options.bond === 'stacked' ? 'active' : ''}
              onClick={() => onOptions({ bond: 'stacked' })}
            >
              {STR.stacked}
            </button>
            <button
              className={options.bond === 'staggered' ? 'active' : ''}
              onClick={() => onOptions({ bond: 'staggered' })}
            >
              {STR.staggered}
            </button>
          </div>
        </div>
      )}

      <p className="readout">
        {formatM(layout.wallW)} × {formatM(layout.wallH)} m &nbsp;·&nbsp; {areaM2.toFixed(2)} m²
        &nbsp;·&nbsp; {layout.cellCount} {STR.count.toLowerCase()}
      </p>
    </div>
  );
}
