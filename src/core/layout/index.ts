import type { Layout, LayoutMode, ProductOptions, ProductSpec } from '../types';
import { layoutBasicThird } from './basicThird';
import { layoutFirstOne } from './firstOne';
import { layoutSecondHigh } from './secondHigh';

/**
 * Single source of truth for tile geometry. The on-screen renderer, the SVG /
 * DXF / PDF exporters and the future 3D extrusion all consume this output, so
 * what you see is always exactly what you export.
 */
export function computeLayout(
  product: ProductSpec,
  rows: number,
  cols: number,
  options: ProductOptions,
  mode: LayoutMode = 'wall',
): Layout {
  switch (product.id) {
    case 'first-one':
      return layoutFirstOne(rows, cols, mode);
    case 'second-high':
      return layoutSecondHigh(rows, cols, mode);
    case 'basic-third':
      return layoutBasicThird(rows, cols, options, mode);
  }
}

/**
 * Carry the current design's cells onto a torus-mode layout for the seamless
 * export: tiles are matched by (row, col). First One's torus rows sit one row
 * higher (the wall's bottom cut row falls away); everything else maps 1:1.
 * Cells with no wall counterpart (shouldn't happen) fall back to cell 0.
 */
export function mapCellsToTorus<T>(
  wall: Layout,
  torusLayout: Layout,
  cells: readonly T[],
): T[] {
  const byPos = new Map<string, T>();
  for (const tile of wall.tiles) byPos.set(`${tile.row}:${tile.col}`, cells[tile.cellIndex]);
  const rowShift = wall.productId === 'first-one' ? 1 : 0;
  return torusLayout.tiles.map(
    (tile) => byPos.get(`${tile.row + rowShift}:${tile.col}`) ?? cells[0],
  );
}
