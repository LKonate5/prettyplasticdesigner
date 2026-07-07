import type { ProductId } from '../core/types';
import { PRODUCT_LIST } from '../data/products';
import { STR } from '../strings';

export function ProductPicker({
  value,
  onChange,
}: {
  value: ProductId;
  onChange: (id: ProductId) => void;
}) {
  return (
    <div className="section">
      <h2>{STR.product}</h2>
      <div className="seg vertical">
        {PRODUCT_LIST.map((p) => (
          <button
            key={p.id}
            className={p.id === value ? 'active' : ''}
            onClick={() => onChange(p.id)}
          >
            {p.name}
            <small>
              {p.tile.w}×{p.tile.h}×{p.tile.d} mm · {p.nominalTilesPerM2} {STR.tilesPerM2}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
