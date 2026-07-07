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
    expect(Math.abs(1_000_000 / (BT_W * 450) - 6.7)).toBeLessThan(0.1);
  });

  it('wall height = full top tile + (rows-1) exposures', () => {
    const l = layoutBasicThird(6, 4, opts(450, 'stacked'));
    expect(l.wallW).toBe(4 * BT_W);
    expect(l.wallH).toBe(BT_H + 5 * 450);
    const l2 = layoutBasicThird(6, 4, opts(320, 'stacked'));
    expect(l2.wallH).toBe(BT_H + 5 * 320);
  });

  it('stacked = rows×cols tiles; staggered adds one cut tile per offset row', () => {
    expect(layoutBasicThird(6, 4, opts(450, 'stacked')).tiles.length).toBe(24);
    // 6 rows staggered → 3 offset rows, each +1 tile
    expect(layoutBasicThird(6, 4, opts(450, 'staggered')).tiles.length).toBe(24 + 3);
  });

  it('cell count is rows×cols for both bonds', () => {
    expect(layoutBasicThird(6, 4, opts(450, 'stacked')).cellCount).toBe(24);
    expect(layoutBasicThird(6, 4, opts(450, 'staggered')).cellCount).toBe(24);
  });

  it('visible footprints cover the wall exactly, stacked and staggered', () => {
    for (const bond of ['stacked', 'staggered'] as const) {
      const l = layoutBasicThird(6, 4, opts(450, bond));
      const covered = l.tiles.reduce((sum, t) => sum + polygonArea(t.exportPolygon), 0);
      expect(covered).toBeCloseTo(l.wallW * l.wallH, 1);
    }
  });

  it('lapped courses expose `exposure` mm; the top course shows all 569 mm', () => {
    const l = layoutBasicThird(3, 2, opts(400, 'stacked'));
    const heights = l.tiles.map((t) => {
      const ys = t.exportPolygon.map(([, y]) => y);
      return Math.max(...ys) - Math.min(...ys);
    });
    expect(heights.filter((h) => Math.abs(h - 400) < 1e-6).length).toBe(4);
    expect(heights.filter((h) => Math.abs(h - BT_H) < 1e-6).length).toBe(2);
  });

  it('staggered end half-tiles share a cell (horizontal wrap)', () => {
    const l = layoutBasicThird(6, 4, opts(450, 'staggered'));
    const rightEdges = l.tiles.filter((t) => t.col === 4); // c=cols exists only on offset rows
    expect(rightEdges.length).toBe(3);
    for (const rightEdge of rightEdges) {
      const leftEdge = l.tiles.find((t) => t.row === rightEdge.row && t.col === 0);
      expect(leftEdge!.cellIndex).toBe(rightEdge.cellIndex);
    }
  });

  it('torus period: stacked always, staggered only with even rows', () => {
    expect(layoutBasicThird(6, 4, opts(450, 'stacked')).torusPeriod).toEqual({
      w: 4 * BT_W,
      h: BT_H + 5 * 450,
    });
    expect(layoutBasicThird(5, 4, opts(450, 'staggered')).torusPeriod).toBeNull();
    expect(layoutBasicThird(6, 4, opts(450, 'staggered')).torusPeriod).not.toBeNull();
  });
});
