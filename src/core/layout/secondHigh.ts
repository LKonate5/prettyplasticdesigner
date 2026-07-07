import type { Layout, Pt, Tile } from '../types';

/**
 * SECOND HIGH — square faceted tile, 294 × 294 mm, on a 300 mm grid
 * (the published 11.1 tiles/m² ⇒ 1 / 0.3² pitch). The 6 mm gap between tiles
 * reads as a dark shadow joint over the wall background. No laps, no cuts —
 * the design comes from mixing per-tile rotations of the asymmetric facet
 * surface, so the renderer draws a rotatable facet motif on every tile.
 *
 * The plain grid is already exactly one seamless period, so patternRow/Col are
 * just the grid indices and there are no wrap partners.
 */

export const SH_PITCH = 300;
const TILE = 294;
const MARGIN = (SH_PITCH - TILE) / 2; // 3 mm each side

export function layoutSecondHigh(rows: number, cols: number): Layout {
  const wallW = cols * SH_PITCH;
  const wallH = rows * SH_PITCH;
  const tiles: Tile[] = [];

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
        cellIndex: row * cols + col,
        row,
        col,
        patternRow: row,
        patternCol: col,
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
    cellCount: rows * cols,
    patternRows: rows,
    patternCols: cols,
    torusPeriod: { w: wallW, h: wallH },
  };
}
