import type { Layout, LayoutMode, Pt, Tile } from '../types';

/**
 * SECOND HIGH — square faceted tile, 294 × 294 mm, on a 300 mm grid
 * (the published 11.1 tiles/m² ⇒ 1 / 0.3² pitch). The 6 mm gap between tiles
 * reads as a dark shadow joint over the wall background. No laps, no cuts —
 * the design comes from mixing per-tile rotations of the asymmetric facet
 * surface, so the renderer draws a rotatable facet motif on every tile.
 */

export const SH_PITCH = 300;
const TILE = 294;
const MARGIN = (SH_PITCH - TILE) / 2; // 3 mm each side

export function layoutSecondHigh(rows: number, cols: number, _mode: LayoutMode): Layout {
  // Wall and torus layouts are identical: the grid already tiles the plane.
  const wallW = cols * SH_PITCH;
  const wallH = rows * SH_PITCH;
  const tiles: Tile[] = [];
  let cellIndex = 0;

  for (let row = 0; row < rows; row++) {
    const y = (rows - 1 - row) * SH_PITCH + MARGIN; // row 0 = bottom
    for (let col = 0; col < cols; col++) {
      const x = col * SH_PITCH + MARGIN;
      const polygon: Pt[] = [
        [x, y],
        [x + TILE, y],
        [x + TILE, y + TILE],
        [x, y + TILE],
      ];
      tiles.push({
        cellIndex: cellIndex++,
        row,
        col,
        polygon,
        clipped: null,
        exportPolygon: polygon,
        zIndex: row,
        cut: false,
        shadowStrips: [],
      });
    }
  }

  return {
    productId: 'second-high',
    wallW,
    wallH,
    rows,
    cols,
    tiles,
    cellCount: cellIndex,
    torusPeriod: { w: wallW, h: wallH },
  };
}
