import type { Layout, ProductOptions, ProductSpec } from '../core/types';
import { EXPOSURE_MAX, EXPOSURE_MIN } from '../data/products';
import { STR } from '../strings';

function formatM(mm: number): string {
  return (mm / 1000).toFixed(2);
}

/**
 * Rows/Columns inputs plus Basic Third's exposure + bond, with a live
 * real-world dimension readout so architects see the wall size as they type.
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
  return (
    <div className="section">
      <h2>{STR.wall}</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="rows">{STR.rows}</label>
          <input
            id="rows"
            type="number"
            min={1}
            max={80}
            value={rows}
            onChange={(e) => onGrid({ rows: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="cols">{STR.columns}</label>
          <input
            id="cols"
            type="number"
            min={1}
            max={80}
            value={cols}
            onChange={(e) => onGrid({ cols: Number(e.target.value) })}
          />
        </div>
      </div>

      {product.hasExposure && (
        <div className="field">
          <label htmlFor="exposure">
            {STR.exposure}: {options.exposure} mm
          </label>
          <input
            id="exposure"
            type="range"
            min={EXPOSURE_MIN}
            max={EXPOSURE_MAX}
            step={5}
            value={options.exposure}
            onChange={(e) => onOptions({ exposure: Number(e.target.value) })}
          />
          <p className="note">{STR.exposureHint}</p>
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
