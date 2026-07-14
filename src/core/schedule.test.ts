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

  it('rounds area up to whole square metres and derives effective tiles/m²', () => {
    const layout = layoutSecondHigh(10, 10); // exactly 9 m²
    const cells: Cell[] = layout.tiles.map(() => ({ material: 0 }));
    const s = computeSchedule(PRODUCTS['second-high'], layout, cells);
    expect(s.roundedAreaM2).toBe(9);
    expect(s.effectiveTilesPerM2).toBeCloseTo(s.totalTiles / 9, 6);
  });

  it('a 9.1 m² wall rounds up to 10 m²', () => {
    const layout = layoutSecondHigh(11, 10); // 3.0 × 3.3 = 9.9 m²
    const cells: Cell[] = layout.tiles.map(() => ({ material: 0 }));
    const s = computeSchedule(PRODUCTS['second-high'], layout, cells);
    expect(s.roundedAreaM2).toBe(10);
  });

  it('a tiny wall (1-2 tiles) rounds up to 1 m²', () => {
    const layout = layoutSecondHigh(1, 1);
    const cells: Cell[] = layout.tiles.map(() => ({ material: 0 }));
    const s = computeSchedule(PRODUCTS['second-high'], layout, cells);
    expect(s.roundedAreaM2).toBe(1);
  });
});

describe('computeOrder', () => {
  const layout = layoutSecondHigh(10, 10); // 9 m² wall, 100 tiles
  const cells: Cell[] = layout.tiles.map((t) => ({ material: t.cellIndex < 30 ? 0 : 7 }));
  const schedule = computeSchedule(PRODUCTS['second-high'], layout, cells);

  it('rounds coverage and order UP to full square metres', () => {
    const order = computeOrder(PRODUCTS['second-high'], schedule, 0.1);
    expect(order.exactM2).toBeCloseTo(9, 6);
    expect(order.onWallM2).toBe(9); // exactly 9 already whole
    expect(order.toOrderM2).toBe(Math.ceil(9 * 1.1)); // ceil(9.9) = 10
  });

  it('onWallM2 is sourced from schedule.roundedAreaM2 (single source of truth)', () => {
    const order = computeOrder(PRODUCTS['second-high'], schedule, 0.1);
    expect(order.onWallM2).toBe(schedule.roundedAreaM2);
  });

  it('adds waste to the ROUNDED coverage (10 m² + 10% = 11)', () => {
    const l = layoutSecondHigh(11, 10); // 3.0 × 3.3 = 9.9 m² → on-wall 10
    const c: Cell[] = l.tiles.map(() => ({ material: 0 }));
    const s = computeSchedule(PRODUCTS['second-high'], l, c);
    const order = computeOrder(PRODUCTS['second-high'], s, 0.1);
    expect(order.onWallM2).toBe(10);
    expect(order.toOrderM2).toBe(11); // ceil(10 × 1.1), NOT ceil(9.9 × 1.1) = 11 either but from 10
  });

  it('rounds a fractional wall up (no halves)', () => {
    const l = layoutSecondHigh(11, 11); // 3.3×3.3 = 10.89 m²
    const c: Cell[] = l.tiles.map(() => ({ material: 0 }));
    const s = computeSchedule(PRODUCTS['second-high'], l, c);
    const order = computeOrder(PRODUCTS['second-high'], s, 0);
    expect(order.onWallM2).toBe(11); // ceil(10.89)
  });

  it('pallets = order m² ÷ pallet m², rounded up (30 m²/pallet for Second High)', () => {
    const order = computeOrder(PRODUCTS['second-high'], schedule, 0.1);
    expect(order.palletM2).toBe(30);
    expect(order.pallets).toBe(Math.ceil(order.toOrderM2 / 30)); // 1
  });

  it('per-product pallet sizes: First One 40, Basic Third 60', () => {
    expect(PRODUCTS['first-one'].palletM2).toBe(40);
    expect(PRODUCTS['basic-third'].palletM2).toBe(60);
  });
});
