import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../../data/products';
import { computeLayout, metresToGrid } from './index';

const opts = { exposure: 450, bond: 'staggered' as const };

describe('metresToGrid', () => {
  it('a requested wall size lands within a tile of the target (all products)', () => {
    for (const product of Object.values(PRODUCTS)) {
      const { rows, cols } = metresToGrid(product, opts, 4, 3);
      const layout = computeLayout(product, rows, cols, opts);
      // within one tile pitch of 4×3 m
      expect(Math.abs(layout.wallW - 4000)).toBeLessThan(product.tile.w + 1);
      expect(Math.abs(layout.wallH - 3000)).toBeLessThan(
        Math.max(product.tile.h, opts.exposure) + 1,
      );
    }
  });

  it('never returns less than one row/column', () => {
    for (const product of Object.values(PRODUCTS)) {
      const g = metresToGrid(product, opts, 0.01, 0.01);
      expect(g.rows).toBeGreaterThanOrEqual(1);
      expect(g.cols).toBeGreaterThanOrEqual(1);
    }
  });

  it('First One uses physical rows in both size directions', () => {
    const product = PRODUCTS['first-one'];
    const grid = metresToGrid(product, opts, 3, 3);
    expect(grid).toEqual({ rows: 10, cols: 10 });
    const layout = computeLayout(product, grid.rows, grid.cols, opts);
    expect(layout.wallW).toBeCloseTo(3040, 6);
    expect(layout.wallH).toBeCloseTo(20 * (1_000_000 / (22.2 * 304)), 6);
  });
});
