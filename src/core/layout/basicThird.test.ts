import { describe, expect, it } from 'vitest';
import type { ProductOptions } from '../types';
import { polygonArea } from '../geometry';
import { BT_H, BT_W, layoutBasicThird } from './basicThird';

const opts = (exposure: number, bond: ProductOptions['bond']): ProductOptions => ({
  exposure,
  bond,
});

describe('Basic Third layout', () => {
  it('default 450 mm exposure lands on the published ~6.7 tiles/m²', () => {
    // exactly 6.7 would be 453.7 mm exposure; 450 gives 6.75 — the site says "~6.7"
    expect(Math.abs(1_000_000 / (BT_W * 450) - 6.7)).toBeLessThan(0.1);
  });

  it('wall height = full top tile + (rows-1) exposures', () => {
    const l = layoutBasicThird(5, 4, opts(450, 'stacked'), 'wall');
    expect(l.wallW).toBe(4 * BT_W);
    expect(l.wallH).toBe(BT_H + 4 * 450);
    const l2 = layoutBasicThird(5, 4, opts(320, 'stacked'), 'wall');
    expect(l2.wallH).toBe(BT_H + 4 * 320);
  });

  it('stacked = rows×cols tiles; staggered adds one cut tile per offset row', () => {
    expect(layoutBasicThird(5, 4, opts(450, 'stacked'), 'wall').tiles.length).toBe(20);
    expect(layoutBasicThird(5, 4, opts(450, 'staggered'), 'wall').tiles.length).toBe(22);
  });

  it('visible footprints cover the wall exactly, stacked and staggered', () => {
    for (const bond of ['stacked', 'staggered'] as const) {
      const l = layoutBasicThird(5, 4, opts(450, bond), 'wall');
      const covered = l.tiles.reduce((sum, t) => sum + polygonArea(t.exportPolygon), 0);
      expect(covered).toBeCloseTo(l.wallW * l.wallH, 1);
    }
  });

  it('lapped courses expose `exposure` mm; the top course shows all 569 mm', () => {
    const l = layoutBasicThird(3, 2, opts(400, 'stacked'), 'wall');
    const heights = l.tiles.map((t) => {
      const ys = t.exportPolygon.map(([, y]) => y);
      return Math.max(...ys) - Math.min(...ys);
    });
    expect(heights.filter((h) => Math.abs(h - 400) < 1e-6).length).toBe(4);
    expect(heights.filter((h) => Math.abs(h - BT_H) < 1e-6).length).toBe(2);
  });

  it('torus mode wraps: stacked always, staggered only with even rows', () => {
    expect(layoutBasicThird(5, 4, opts(450, 'stacked'), 'wall').torusPeriod).toEqual({
      w: 4 * BT_W,
      h: 5 * 450,
    });
    expect(layoutBasicThird(5, 4, opts(450, 'staggered'), 'wall').torusPeriod).toBeNull();
    expect(layoutBasicThird(4, 4, opts(450, 'staggered'), 'wall').torusPeriod).toEqual({
      w: 4 * BT_W,
      h: 4 * 450,
    });
    const torus = layoutBasicThird(4, 4, opts(450, 'staggered'), 'torus');
    expect(torus.tiles.length).toBe(16);
    // in torus mode every course is lapped (the wrap supplies the course above)
    const heights = torus.tiles.map((t) => {
      const ys = t.exportPolygon.map(([, y]) => y);
      return Math.max(...ys) - Math.min(...ys);
    });
    expect(heights.every((h) => Math.abs(h - 450) < 1e-6)).toBe(true);
  });
});
