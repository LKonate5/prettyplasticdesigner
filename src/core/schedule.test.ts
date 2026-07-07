import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../data/palette';
import { PRODUCTS } from '../data/products';
import { layoutSecondHigh } from './layout/secondHigh';
import { computeSchedule } from './schedule';
import type { Cell } from './types';

describe('schedule', () => {
  it('10×10 Second High: 9 m², 100 tiles, 120 kg (hand-checked)', () => {
    const layout = layoutSecondHigh(10, 10);
    const cells: Cell[] = layout.tiles.map((t) => ({
      material: t.cellIndex % 2 === 0 ? 0 : 7,
      rotation: 0,
    }));
    const s = computeSchedule(PRODUCTS['second-high'], layout, cells);
    expect(s.areaM2).toBeCloseTo(9, 6);
    expect(s.totalTiles).toBe(100);
    expect(s.totalWeightKg).toBeCloseTo(120, 6);
    expect(s.rows.length).toBe(2);
    expect(s.rows.map((r) => r.material)).toEqual([MATERIALS[0], MATERIALS[7]]);
    expect(s.rows.reduce((sum, r) => sum + r.count, 0)).toBe(100);
    expect(s.rows.reduce((sum, r) => sum + r.pct, 0)).toBeCloseTo(100, 6);
    expect(s.rows.reduce((sum, r) => sum + r.weightKg, 0)).toBeCloseTo(120, 6);
  });
});
