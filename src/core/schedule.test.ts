import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../data/palette';
import { PRODUCTS } from '../data/products';
import { layoutSecondHigh } from './layout/secondHigh';
import { computeOrder, computeSchedule } from './schedule';
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

describe('computeOrder', () => {
  const layout = layoutSecondHigh(10, 10);
  const cells: Cell[] = layout.tiles.map((t) => ({ material: t.cellIndex < 30 ? 0 : 7, rotation: 0 }));
  const schedule = computeSchedule(PRODUCTS['second-high'], layout, cells);

  it('rounds each colour up and adds the waste allowance', () => {
    const order = computeOrder(PRODUCTS['second-high'], schedule, 0.1, null);
    // 30 → ceil(33) = 33; 70 → ceil(77) = 77
    expect(order.rows.map((r) => r.order)).toEqual([33, 77]);
    expect(order.totalOrder).toBe(110);
    expect(order.totalNeed).toBe(100);
    expect(order.boxes).toBeNull();
  });

  it('computes boxes from tiles-per-box (rounding up)', () => {
    const order = computeOrder(PRODUCTS['second-high'], schedule, 0.1, 24);
    expect(order.tilesPerBox).toBe(24);
    expect(order.boxes).toBe(Math.ceil(110 / 24)); // 5
    expect(order.weightToOrderKg).toBeCloseTo(110 * 1.2, 6);
  });

  it('zero waste orders exactly the wall count', () => {
    const order = computeOrder(PRODUCTS['second-high'], schedule, 0, null);
    expect(order.totalOrder).toBe(100);
  });
});
