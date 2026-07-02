import type { Layout, LayoutMode, ProductOptions, Pt, Tile } from '../types';
import { clipPolygonToRect, polygonsDiffer } from '../geometry';

/**
 * BASIC THIRD — rectangular tile 329 mm wide × 569 mm tall, installed in
 * lapped courses. The site's "overlap between rows 30–50 cm" is the visible
 * course height (exposure): at 450 mm exposure the coverage is the published
 * ~6.7 tiles/m². Higher courses lap the lower ones; the top course shows its
 * full 569 mm. Bond is stacked (aligned columns) or staggered (half-tile
 * offset, cut halves at the wall ends).
 */

export const BT_W = 329;
export const BT_H = 569;
const STAGGER = BT_W / 2;
const SHADOW_H = 8;

export function layoutBasicThird(
  rows: number,
  cols: number,
  options: ProductOptions,
  mode: LayoutMode,
): Layout {
  const e = options.exposure;
  const staggered = options.bond === 'staggered';
  const torus = mode === 'torus';
  const wallW = cols * BT_W;
  const wallH = torus ? rows * e : BT_H + (rows - 1) * e;
  const tiles: Tile[] = [];
  let cellIndex = 0;

  for (let row = 0; row < rows; row++) {
    // row 0 = bottom course. Draw ascending so higher courses lap lower ones.
    const yTop = wallH - BT_H - row * e;
    const offsetRow = staggered && row % 2 === 1;
    // Staggered offset rows: wall mode places cols+1 tiles (cut halves at both
    // ends); torus mode places cols, with c = 0 straddling the wrap seam.
    const count = offsetRow && !torus ? cols + 1 : cols;
    const lapped = torus || row < rows - 1; // a course above laps this one
    for (let c = 0; c < count; c++) {
      const x = offsetRow ? c * BT_W - STAGGER : c * BT_W;
      const polygon: Pt[] = [
        [x, yTop],
        [x + BT_W, yTop],
        [x + BT_W, yTop + BT_H],
        [x, yTop + BT_H],
      ];
      let clipped: Pt[] | null = null;
      let cut = false;
      if (!torus) {
        const clip = clipPolygonToRect(polygon, 0, 0, wallW, wallH);
        if (clip.length < 3) continue;
        cut = polygonsDiffer(polygon, clip);
        clipped = cut ? clip : null;
      }
      // Visible footprint: the bottom `exposure` mm when lapped, else full tile.
      const visTop = lapped ? yTop + BT_H - e : yTop;
      const visible: Pt[] = [
        [x, visTop],
        [x + BT_W, visTop],
        [x + BT_W, yTop + BT_H],
        [x, yTop + BT_H],
      ];
      const exportPolygon = torus ? visible : clipPolygonToRect(visible, 0, 0, wallW, wallH);
      const shadowStrips: Pt[][] = [];
      if (lapped) {
        const strip: Pt[] = [
          [x, visTop],
          [x + BT_W, visTop],
          [x + BT_W, visTop + SHADOW_H],
          [x, visTop + SHADOW_H],
        ];
        const q = torus ? strip : clipPolygonToRect(strip, 0, 0, wallW, wallH);
        if (q.length >= 3) shadowStrips.push(q);
      }
      tiles.push({
        cellIndex: cellIndex++,
        row,
        col: c,
        polygon,
        clipped,
        exportPolygon,
        zIndex: row,
        cut,
        shadowStrips,
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
    cellCount: cellIndex,
    torusPeriod: canWrap ? { w: wallW, h: rows * e } : null,
  };
}
