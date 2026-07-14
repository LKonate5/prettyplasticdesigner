import { describe, expect, it } from 'vitest';
import { polygonArea } from '../geometry';
import { FO_PITCH_X, FO_ROW_PITCH, layoutFirstOne } from './firstOne';

describe('First One layout', () => {
  it('derived row pitch reproduces the published 22.2 tiles/m² exactly', () => {
    const tilesPerM2 = 1_000_000 / (FO_PITCH_X * FO_ROW_PITCH);
    expect(tilesPerM2).toBeCloseTo(22.2, 6);
  });

  it('wall dimensions follow the pitch formulas', () => {
    const l = layoutFirstOne(6, 5);
    expect(l.wallW).toBeCloseTo(5 * 304, 6);
    expect(l.wallH).toBeCloseTo(6 * FO_ROW_PITCH, 6);
  });

  it('visible tiles cover the wall rectangle exactly (no gaps, no overlaps)', () => {
    const l = layoutFirstOne(8, 6);
    const covered = l.tiles.reduce((sum, t) => sum + polygonArea(t.exportPolygon), 0);
    expect(covered).toBeCloseTo(l.wallW * l.wallH, 1);
  });

  it('logical cell count is rows×cols (wrap partners collapse to one)', () => {
    const l = layoutFirstOne(4, 3);
    expect(l.cellCount).toBe(12);
    expect(l.patternRows).toBe(4);
    expect(l.patternCols).toBe(3);
    // more physical tiles than cells, because cut edge tiles are placed too
    expect(l.tiles.length).toBeGreaterThan(l.cellCount);
    // every tile's cellIndex is in range
    for (const t of l.tiles) expect(t.cellIndex).toBeLessThan(l.cellCount);
  });

  it('only edge tiles are cut', () => {
    const l = layoutFirstOne(6, 5);
    for (const t of l.tiles) {
      const touchesEdge = t.exportPolygon.some(
        ([x, y]) => x < 1e-6 || y < 1e-6 || x > l.wallW - 1e-6 || y > l.wallH - 1e-6,
      );
      if (t.cut) expect(touchesEdge).toBe(true);
    }
    expect(l.tiles.some((t) => t.cut)).toBe(true);
    expect(l.tiles.some((t) => !t.cut)).toBe(true);
  });

  it('draw order puts higher rows in front (ascending zIndex, bottom first)', () => {
    const l = layoutFirstOne(4, 3);
    for (let i = 1; i < l.tiles.length; i++) {
      expect(l.tiles[i].zIndex).toBeGreaterThanOrEqual(l.tiles[i - 1].zIndex);
    }
    const first = l.tiles[0];
    const last = l.tiles[l.tiles.length - 1];
    expect(first.polygon[0][1]).toBeGreaterThan(last.polygon[0][1]);
  });

  it('left/right edge half-diamonds on an aligned row share a cell (horizontal wrap)', () => {
    const l = layoutFirstOne(4, 3);
    // an aligned (odd-k) row has tiles at c=0 (left half) and c=cols (right half)
    const alignedRow = l.tiles.filter((t) => t.col === 3); // c = cols only exists on aligned rows
    expect(alignedRow.length).toBeGreaterThan(0);
    for (const rightEdge of alignedRow) {
      const leftEdge = l.tiles.find(
        (t) => t.row === rightEdge.row && t.col === 0,
      );
      expect(leftEdge).toBeDefined();
      expect(leftEdge!.cellIndex).toBe(rightEdge.cellIndex); // same cell → same colour
    }
  });

  it('torus period is available only for even rows', () => {
    expect(layoutFirstOne(4, 3).torusPeriod).toEqual({ w: 3 * 304, h: 4 * FO_ROW_PITCH });
    expect(layoutFirstOne(5, 3).torusPeriod).toBeNull();
  });

  it('interior tiles get 4 nested lap-shadow bands on each of their 2 upper edges', () => {
    const l = layoutFirstOne(8, 6);
    const interior = l.tiles.filter((t) => !t.cut);
    expect(interior.length).toBeGreaterThan(0);
    for (const t of interior) {
      expect(t.shadowStrips.length).toBe(8); // 4 depths × 2 edges, all uncut
      for (const strip of t.shadowStrips) expect(strip.length).toBe(4); // each band is a quad
    }
  });
});
