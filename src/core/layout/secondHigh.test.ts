import { describe, expect, it } from 'vitest';
import { polygonArea } from '../geometry';
import { layoutSecondHigh, SH_PITCH } from './secondHigh';

describe('Second High layout', () => {
  it('grid pitch reproduces the published 11.1 tiles/m²', () => {
    expect(1_000_000 / (SH_PITCH * SH_PITCH)).toBeCloseTo(11.1, 1);
  });

  it('10×10 wall is 3×3 m with 100 uncut tiles of 294 mm', () => {
    const l = layoutSecondHigh(10, 10);
    expect(l.wallW).toBe(3000);
    expect(l.wallH).toBe(3000);
    expect(l.tiles.length).toBe(100);
    expect(l.cellCount).toBe(100);
    expect(l.tiles.every((t) => !t.cut)).toBe(true);
    expect(polygonArea(l.tiles[0].polygon)).toBeCloseTo(294 * 294, 6);
    // plain grid: one cell per physical tile, cellIndex == array position
    l.tiles.forEach((t, i) => expect(t.cellIndex).toBe(i));
  });

  it('always has a torus period (plain grid wraps by construction)', () => {
    expect(layoutSecondHigh(3, 5).torusPeriod).toEqual({ w: 1500, h: 900 });
  });
});
