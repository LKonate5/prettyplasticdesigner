import type { Layout, ProductOptions, Pt, Tile } from '../types';
import { clipPolygonToRect, polygonsDiffer } from '../geometry';

/**
 * BASIC THIRD — rectangular tile 329 mm wide × 569 mm tall, installed in
 * lapped courses. The site's "overlap between rows 30–50 cm" is the visible
 * course height (exposure): at 450 mm exposure the coverage is the published
 * ~6.7 tiles/m². Higher courses lap the lower ones; the top course shows its
 * full 569 mm. Bond is stacked (aligned columns) or staggered (half-tile
 * offset, cut halves at the wall ends).
 *
 * Tileability: staggered offset rows put a cut half-tile at each end; each
 * shares a cell with its opposite-end partner so the wall repeats horizontally.
 * (Vertically the pattern colour repeats by course; the full top course is kept
 * for a realistic wall, so vertical tiling isn't pixel-seamless — the
 * meaningful cladding repeat is horizontal.)
 */

export const BT_W = 329;
export const BT_H = 569;
const STAGGER = BT_W / 2;
const SHADOW_H = 8;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function layoutBasicThird(rows: number, cols: number, options: ProductOptions): Layout {
  const e = options.exposure;
  const staggered = options.bond === 'staggered';
  const wallW = cols * BT_W;
  const wallH = BT_H + (rows - 1) * e;
  const tiles: Tile[] = [];

  for (let row = 0; row < rows; row++) {
    // row 0 = bottom course. Draw ascending so higher courses lap lower ones.
    const yTop = wallH - BT_H - row * e;
    const offsetRow = staggered && row % 2 === 1;
    // Staggered offset rows place cols+1 tiles (cut halves at both ends).
    const count = offsetRow ? cols + 1 : cols;
    const lapped = row < rows - 1; // a course above laps this one
    for (let c = 0; c < count; c++) {
      const x = offsetRow ? c * BT_W - STAGGER : c * BT_W;
      const polygon: Pt[] = [
        [x, yTop],
        [x + BT_W, yTop],
        [x + BT_W, yTop + BT_H],
        [x, yTop + BT_H],
      ];
      const clip = clipPolygonToRect(polygon, 0, 0, wallW, wallH);
      if (clip.length < 3) continue;
      const cut = polygonsDiffer(polygon, clip);
      // Visible footprint: the bottom `exposure` mm when lapped, else full tile.
      const visTop = lapped ? yTop + BT_H - e : yTop;
      const visible: Pt[] = [
        [x, visTop],
        [x + BT_W, visTop],
        [x + BT_W, yTop + BT_H],
        [x, yTop + BT_H],
      ];
      const exportPolygon = clipPolygonToRect(visible, 0, 0, wallW, wallH);
      const shadowStrips: Pt[][] = [];
      if (lapped) {
        const strip: Pt[] = [
          [x, visTop],
          [x + BT_W, visTop],
          [x + BT_W, visTop + SHADOW_H],
          [x, visTop + SHADOW_H],
        ];
        const q = clipPolygonToRect(strip, 0, 0, wallW, wallH);
        if (q.length >= 3) shadowStrips.push(q);
      }
      const patternCol = mod(c, cols); // c = cols aliases onto c = 0 (edge wrap)
      tiles.push({
        cellIndex: row * cols + patternCol,
        row,
        col: c,
        patternRow: row,
        patternCol,
        polygon,
        clipped: cut ? clip : null,
        exportPolygon,
        zIndex: row,
        cut,
        shadowStrips,
        lipStrips: [], // course lap is drawn as a shadow only; no photos yet to match a lip to
      });
    }
  }

  const canWrap = !staggered || rows % 2 === 0;
  return {
    productId: 'basic-third',
    wallW,
    wallH,
    rows,
    cols,
    tiles,
    cellCount: rows * cols,
    patternRows: rows,
    patternCols: cols,
    torusPeriod: canWrap ? { w: wallW, h: wallH } : null,
  };
}
