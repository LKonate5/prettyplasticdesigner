import { describe, expect, it } from 'vitest';
import { polygonArea } from '../geometry';
import { FO_PITCH_X, FO_ROW_PITCH, layoutFirstOne } from './firstOne';

describe('First One layout', () => {
  it('derived row pitch reproduces the published 22.2 tiles/m² exactly', () => {
    const tilesPerM2 = 1_000_000 / (FO_PITCH_X * FO_ROW_PITCH);
    expect(tilesPerM2).toBeCloseTo(22.2, 6);
  });

  it('wall dimensions follow the pitch formulas', () => {
    const l = layoutFirstOne(6, 5, 'wall');
    expect(l.wallW).toBeCloseTo(5 * 304, 6);
    expect(l.wallH).toBeCloseTo(7 * FO_ROW_PITCH, 6);
  });

  it('visible tiles cover the wall rectangle exactly (no gaps, no overlaps)', () => {
    const l = layoutFirstOne(8, 6, 'wall');
    const covered = l.tiles.reduce((sum, t) => sum + polygonArea(t.exportPolygon), 0);
    expect(covered).toBeCloseTo(l.wallW * l.wallH, 1);
  });

  it('places rows+2 rows with an extra cut tile on offset rows', () => {
    // rows=4, cols=3: k = 0..5; even k rows carry 3 tiles, odd k rows 4.
    const l = layoutFirstOne(4, 3, 'wall');
    expect(l.tiles.length).toBe(3 * 3 + 3 * 4);
    expect(l.cellCount).toBe(l.tiles.length);
    // cellIndex must equal array position (exporters and painting rely on it)
    l.tiles.forEach((t, i) => expect(t.cellIndex).toBe(i));
  });

  it('only edge tiles are cut', () => {
    const l = layoutFirstOne(6, 5, 'wall');
    for (const t of l.tiles) {
      const touchesEdge = t.exportPolygon.some(
        ([x, y]) =>
          x < 1e-6 || y < 1e-6 || x > l.wallW - 1e-6 || y > l.wallH - 1e-6,
      );
      if (t.cut) expect(touchesEdge).toBe(true);
    }
    expect(l.tiles.some((t) => t.cut)).toBe(true);
    expect(l.tiles.some((t) => !t.cut)).toBe(true);
  });

  it('draw order puts higher rows in front (ascending zIndex, bottom first)', () => {
    const l = layoutFirstOne(4, 3, 'wall');
    for (let i = 1; i < l.tiles.length; i++) {
      expect(l.tiles[i].zIndex).toBeGreaterThanOrEqual(l.tiles[i - 1].zIndex);
    }
    // bottom row (drawn first) sits lower on the wall (larger y)
    const first = l.tiles[0];
    const last = l.tiles[l.tiles.length - 1];
    expect(first.polygon[0][1]).toBeGreaterThan(last.polygon[0][1]);
  });

  it('torus mode: rows×cols uncut tiles, every one mapping to a wall cell', () => {
    const wall = layoutFirstOne(4, 3, 'wall');
    const torus = layoutFirstOne(4, 3, 'torus');
    expect(torus.tiles.length).toBe(4 * 3);
    expect(torus.tiles.every((t) => !t.cut && t.clipped === null)).toBe(true);
    expect(torus.torusPeriod).toEqual({ w: 3 * 304, h: 4 * FO_ROW_PITCH });
    const wallKeys = new Set(wall.tiles.map((t) => `${t.row}:${t.col}`));
    for (const t of torus.tiles) {
      expect(wallKeys.has(`${t.row + 1}:${t.col}`)).toBe(true);
    }
  });

  it('torus period is unavailable for odd row counts', () => {
    expect(layoutFirstOne(5, 3, 'wall').torusPeriod).toBeNull();
  });
});
