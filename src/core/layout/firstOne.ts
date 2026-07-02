import type { Layout, LayoutMode, Pt, Tile } from '../types';
import { clipPolygonToRect, insetQuad, polygonsDiffer } from '../geometry';

/**
 * FIRST ONE — diamond tile, 304 mm wide × 400 mm tall physical, installed in
 * overlapping rows (higher rows lap the lower ones, fish-scale style).
 *
 * The physical 400 mm tile shows only ~296.4 mm: with a horizontal pitch of
 * 304 mm, the row pitch that yields the published 22.2 tiles/m² is
 *   ROW_PITCH = 1e6 / (22.2 × 304) ≈ 148.17 mm  (half the visible diamond).
 * The visible faces then tile the plane exactly as 304 × 296.4 rhombi; the
 * hidden ~104 mm head lap is rendered only as a shadow strip on each tile's
 * two upper edges.
 *
 * Wall mode: the user's `rows` counts full diamond rows. Two extra cut rows
 * (half-diamonds) fill the straight top and bottom edges, and offset rows get
 * an extra cut tile at each end — cut tiles count as full tiles in the
 * schedule, because installers cut them from full tiles.
 */

export const FO_PITCH_X = 304;
export const FO_ROW_PITCH = 1_000_000 / (22.2 * FO_PITCH_X); // ≈ 148.174 mm
const HALF = FO_PITCH_X / 2;
const SHADOW_W = 7;

function diamond(cx: number, cy: number): Pt[] {
  return [
    [cx, cy - FO_ROW_PITCH],
    [cx + HALF, cy],
    [cx, cy + FO_ROW_PITCH],
    [cx - HALF, cy],
  ];
}

/** Column x-centres for a row: offset parity alternates row by row. */
function rowColumns(k: number, cols: number, torus: boolean): { count: number; cx: (c: number) => number } {
  const odd = k % 2 === 1;
  if (odd) {
    // Row aligned on grid lines: ends are half-diamonds. In torus mode the
    // right-end half is dropped — it is the same physical tile as c = 0,
    // wrapped around.
    return { count: torus ? cols : cols + 1, cx: (c) => c * FO_PITCH_X };
  }
  return { count: cols, cx: (c) => c * FO_PITCH_X + HALF };
}

export function layoutFirstOne(rows: number, cols: number, mode: LayoutMode): Layout {
  const RP = FO_ROW_PITCH;
  const wallW = cols * FO_PITCH_X;
  const torus = mode === 'torus';
  const tiles: Tile[] = [];
  let cellIndex = 0;

  // Wall mode: diamond centres at cy = k·RP for k = 0..rows+1 (k = 0 is the
  // top cut row, k = rows+1 the bottom cut row). Torus mode: rows even, no cut
  // rows; row r (bottom-up) matches wall row r+1's parity so painted cells
  // transfer 1:1 into the seamless export.
  const kTop = torus ? 1 : 0;
  const kBottom = torus ? rows : rows + 1;
  const wallH = torus ? rows * RP : (rows + 1) * RP;
  const yOffset = torus ? -RP : 0; // shift torus rows into [0, wallH)

  for (let k = kBottom; k >= kTop; k--) {
    const cy = k * RP + yOffset;
    const { count, cx } = rowColumns(k, cols, torus);
    const rowIdx = kBottom - k; // bottom-up
    for (let c = 0; c < count; c++) {
      const polygon = diamond(cx(c), cy);
      let clipped: Pt[] | null = null;
      let cut = false;
      if (!torus) {
        const clip = clipPolygonToRect(polygon, 0, 0, wallW, wallH);
        if (clip.length < 3) continue;
        cut = polygonsDiffer(polygon, clip);
        clipped = cut ? clip : null;
      }
      const shadowStrips: Pt[][] = [];
      if (torus || k > kTop) {
        // A row above laps this tile: shade its two upper edges.
        const centre: Pt = [cx(c), cy];
        const left: Pt = [cx(c) - HALF, cy];
        const top: Pt = [cx(c), cy - RP];
        const right: Pt = [cx(c) + HALF, cy];
        for (const quad of [
          insetQuad(left, top, SHADOW_W, centre),
          insetQuad(top, right, SHADOW_W, centre),
        ]) {
          const q = torus ? quad : clipPolygonToRect(quad, 0, 0, wallW, wallH);
          if (q.length >= 3) shadowStrips.push(q);
        }
      }
      tiles.push({
        cellIndex: cellIndex++,
        row: rowIdx,
        col: c,
        polygon,
        clipped,
        exportPolygon: clipped ?? polygon,
        zIndex: rowIdx,
        cut,
        shadowStrips,
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
    cellCount: cellIndex,
    torusPeriod: rows % 2 === 0 ? { w: cols * FO_PITCH_X, h: rows * RP } : null,
  };
}
