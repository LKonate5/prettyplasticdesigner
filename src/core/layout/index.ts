import type { Layout, ProductOptions, ProductSpec } from '../types';
import { BT_H, BT_W, layoutBasicThird } from './basicThird';
import { FO_PITCH_X, FO_ROW_PITCH, layoutFirstOne } from './firstOne';
import { layoutSecondHigh, SH_PITCH } from './secondHigh';

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

/**
 * Convert a real-world wall size (metres) into rows × columns for a product.
 * Architects think in metres, not tile counts. Rounds to the nearest whole
 * tile (min 1); the reducer then snaps offset products to an even row count.
 */
export function metresToGrid(
  product: ProductSpec,
  options: ProductOptions,
  widthM: number,
  heightM: number,
): { rows: number; cols: number } {
  const w = Math.max(0, widthM) * 1000;
  const h = Math.max(0, heightM) * 1000;
  const atLeast1 = (n: number) => Math.max(1, Math.round(n));
  switch (product.id) {
    case 'first-one':
      return { cols: atLeast1(w / FO_PITCH_X), rows: atLeast1(h / FO_ROW_PITCH) };
    case 'second-high':
      return { cols: atLeast1(w / SH_PITCH), rows: atLeast1(h / SH_PITCH) };
    case 'basic-third':
      // wallH = BT_H + (rows-1)·exposure  ⇒  rows = (h - BT_H)/exposure + 1
      return { cols: atLeast1(w / BT_W), rows: atLeast1((h - BT_H) / options.exposure + 1) };
  }
}

