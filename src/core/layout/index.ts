import type { Layout, ProductOptions, ProductSpec } from '../types';
import { layoutBasicThird } from './basicThird';
import { layoutFirstOne } from './firstOne';
import { layoutSecondHigh } from './secondHigh';

/**
 * Single source of truth for tile geometry. The on-screen renderer, the SVG /
 * DXF / PDF / 3D exporters all consume this output, so what you see is always
 * exactly what you export.
 *
 * The wall is tileable by construction: wrap-partner edge tiles share a cell
 * (see each layout module), so the seamless texture export just renders the
 * wall and crops to `torusPeriod`.
 */
export function computeLayout(
  product: ProductSpec,
  rows: number,
  cols: number,
  options: ProductOptions,
): Layout {
  switch (product.id) {
    case 'first-one':
      return layoutFirstOne(rows, cols);
    case 'second-high':
      return layoutSecondHigh(rows, cols);
    case 'basic-third':
      return layoutBasicThird(rows, cols, options);
  }
}
