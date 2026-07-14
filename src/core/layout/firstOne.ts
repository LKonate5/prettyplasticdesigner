import type { Layout, Pt, Tile } from '../types';
import { clipPolygonToRect, insetQuad, polygonsDiffer } from '../geometry';

/**
 * FIRST ONE — diamond tile, 304 mm wide × 400 mm tall physical, installed in
 * overlapping rows (higher rows lap the lower ones, fish-scale style).
 *
 * The physical 400 mm tile shows only ~296.4 mm: with a horizontal pitch of
 * 304 mm, the row pitch that yields the published 22.2 tiles/m² is
 *   ROW_PITCH = 1e6 / (22.2 × 304) ≈ 148.17 mm  (half the visible diamond).
 * The visible faces then tile the plane exactly as 304 × 296.4 rhombi; the
 * hidden ~104 mm head lap shows up as relief on the two edges it affects.
 *
 * Reading the lap. Row k+1 sits ON TOP of row k, so at every shared edge the
 * upper tile's face is raised one tile thickness (29 mm) above the lower one.
 * That step is drawn from BOTH sides, which is what sells the depth:
 *   - the lower tile gets a cast shadow inside its two UPPER edges;
 *   - the upper tile gets a lit lip inside its two LOWER edges — its own
 *     thickness, seen face-on and catching the light.
 * The two land either side of the same line, giving the crisp dark/light seam a
 * real fish-scale wall has. Drawing only the shadow (as this once did) reads
 * flat, because nothing marks the raised edge.
 *
 * Tileability: the wall is a clean rectangle with cut half-diamonds at every
 * edge. Each cut tile shares a cell with its wrap partner (the matching half on
 * the opposite edge), so the whole wall is one seamless repeat. Requires an
 * even row count so the offset/aligned row parity matches across the top/bottom
 * wrap — the reducer snaps rows to even for this product.
 */

export const FO_PITCH_X = 304;
export const FO_ROW_PITCH = 1_000_000 / (22.2 * FO_PITCH_X); // ≈ 148.174 mm
const HALF = FO_PITCH_X / 2;
// Nested bands of the SAME translucent fill, narrowest closest to the true lap
// edge: rendered stacked, alpha compositing turns this into a soft falloff
// (a single flat 7 mm stripe read as too thin/flat once real photos landed).
const SHADOW_DEPTHS = [12, 8, 5, 2];
// The lit lip is the tile's 29 mm edge seen face-on, so it is narrow and hard —
// one band, no falloff. Widening it turns the seam into a painted stripe.
const LIP_DEPTH = 3.5;

function diamond(cx: number, cy: number): Pt[] {
  return [
    [cx, cy - FO_ROW_PITCH],
    [cx + HALF, cy],
    [cx, cy + FO_ROW_PITCH],
    [cx - HALF, cy],
  ];
}

/** The nested lap-shadow bands along one edge (see SHADOW_DEPTHS). */
function lapShadowBands(a: Pt, b: Pt, towards: Pt): Pt[][] {
  return SHADOW_DEPTHS.map((depth) => insetQuad(a, b, depth, towards));
}

/** Column x-centres for a diamond row: alternate rows are offset by half a tile. */
function rowColumns(k: number, cols: number): { count: number; cx: (c: number) => number } {
  if (k % 2 === 1) {
    // Aligned on grid lines: ends are half-diamonds (c = 0 and c = cols).
    return { count: cols + 1, cx: (c) => c * FO_PITCH_X };
  }
  return { count: cols, cx: (c) => c * FO_PITCH_X + HALF };
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function layoutFirstOne(rows: number, cols: number): Layout {
  const RP = FO_ROW_PITCH;
  const wallW = cols * FO_PITCH_X;
  // Wall height is an exact multiple of the row pitch so the top and bottom
  // half-diamond rows have the same offset parity — that's what lets them merge
  // (and share a colour) into whole diamonds when the wall is tiled vertically.
  const wallH = rows * RP;
  const tiles: Tile[] = [];

  // Diamond centres at cy = k·RP for k = 0 (top half-row) .. rows (bottom
  // half-row). Draw ascending row index (bottom first) so higher rows lap lower.
  for (let k = rows; k >= 0; k--) {
    const cy = k * RP;
    const { count, cx } = rowColumns(k, cols);
    const rowIdx = rows - k; // 0 = bottom
    // Canonical wrapped row: k=0 (top) and k=rows (bottom) both map to 0, so
    // the two half-rows share a cell and merge seamlessly across the wrap.
    const patternRow = mod(k, rows);
    for (let c = 0; c < count; c++) {
      const polygon = diamond(cx(c), cy);
      const clip = clipPolygonToRect(polygon, 0, 0, wallW, wallH);
      if (clip.length < 3) continue;
      const cut = polygonsDiffer(polygon, clip);
      const patternCol = mod(c, cols); // c = cols aliases onto c = 0 (edge wrap)
      // Every diamond is lapped by the row above it in the tessellated field
      // (the top row's shadow lands on its clipped-away upper half, so it's
      // harmless there and keeps the shadow tileable).
      const centre: Pt = [cx(c), cy];
      const left: Pt = [cx(c) - HALF, cy];
      const top: Pt = [cx(c), cy - RP];
      const right: Pt = [cx(c) + HALF, cy];
      const bottom: Pt = [cx(c), cy + RP];
      const shadowStrips: Pt[][] = [];
      for (const quad of [...lapShadowBands(left, top, centre), ...lapShadowBands(top, right, centre)]) {
        const q = clipPolygonToRect(quad, 0, 0, wallW, wallH);
        if (q.length >= 3) shadowStrips.push(q);
      }
      // Lit lip on the two LOWER edges — this tile's own raised thickness. (The
      // bottom row's lip falls on its clipped-away lower half, so it costs
      // nothing there and keeps the relief tileable, like the shadow above.)
      const lipStrips: Pt[][] = [];
      for (const edge of [
        insetQuad(left, bottom, LIP_DEPTH, centre),
        insetQuad(bottom, right, LIP_DEPTH, centre),
      ]) {
        const q = clipPolygonToRect(edge, 0, 0, wallW, wallH);
        if (q.length >= 3) lipStrips.push(q);
      }
      tiles.push({
        cellIndex: patternRow * cols + patternCol,
        row: rowIdx,
        col: c,
        patternRow,
        patternCol,
        polygon,
        clipped: cut ? clip : null,
        exportPolygon: cut ? clip : polygon,
        zIndex: rowIdx,
        cut,
        shadowStrips,
        lipStrips,
      });
    }
  }

  return {
    productId: 'first-one',
    wallW,
    wallH,
    rows,
    cols,
    tiles,
    cellCount: rows * cols,
    patternRows: rows,
    patternCols: cols,
    torusPeriod: rows % 2 === 0 ? { w: wallW, h: wallH } : null,
  };
}
