import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../data/palette';
import { DEFAULT_OPTIONS, PRODUCTS } from '../data/products';
import { buildLayingPlan, columnLabel, materialCode } from './laying';
import { computeLayout } from './layout';
import type { Cell, ProductId } from './types';

// Every third cell is turned 90°, whatever the product: only Second High may show it.
const cellsFor = (count: number): Cell[] =>
  Array.from({ length: count }, (_, i) => ({
    material: i % 12,
    ...(i % 3 === 0 ? { rotation: 90 as const } : {}),
  }));

function planFor(productId: ProductId, rows: number, cols: number, options = DEFAULT_OPTIONS) {
  const layout = computeLayout(PRODUCTS[productId], rows, cols, options);
  return { layout, plan: buildLayingPlan(layout, cellsFor(layout.cellCount)) };
}

describe('columnLabel', () => {
  it('runs A–Z without I and O, then AA, AB …', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(7)).toBe('H');
    expect(columnLabel(8)).toBe('J');
    expect(columnLabel(12)).toBe('N');
    expect(columnLabel(13)).toBe('P');
    expect(columnLabel(23)).toBe('Z');
    expect(columnLabel(24)).toBe('AA');
    expect(columnLabel(25)).toBe('AB');
    expect(columnLabel(48)).toBe('BA');
  });

  it('never repeats a label', () => {
    const labels = new Set(Array.from({ length: 700 }, (_, i) => columnLabel(i)));
    expect(labels.size).toBe(700);
  });
});

describe('materialCode', () => {
  it('is colour letter + shade digit, unique for every material', () => {
    const codes = MATERIALS.map(materialCode);
    expect(new Set(codes).size).toBe(MATERIALS.length);
    expect(codes).toContain('Y2'); // ochre medium
    expect(codes).toContain('T3'); // terracotta dark
    expect(codes).toContain('S1'); // grey light
    expect(codes).toContain('B2'); // blue medium
  });

  it('never uses the letter O', () => {
    expect(MATERIALS.map(materialCode).some((c) => c.includes('O'))).toBe(false);
  });
});

describe('buildLayingPlan', () => {
  it('First One 8×8: 17 courses, columns A–S, course 01 is the cut half-height row', () => {
    const { layout, plan } = planFor('first-one', 8, 8);
    expect(plan.tiles.length).toBe(layout.tiles.length);
    expect(plan.courses.length).toBe(17);
    expect(plan.columnCount).toBe(17); // half-columns: 2 × 8 + 1
    const first = plan.courses[0];
    expect(first.length).toBe(8);
    expect(first.every((t) => t.cutEdges.includes('bottom'))).toBe(true);
    // Course 01 sits on the odd half-columns, course 02 on the even ones.
    expect(first[0].id).toBe('B01');
    const second = plan.courses[1];
    expect(second.length).toBe(9);
    expect(second[0].id).toBe('A02');
    expect(second[0].cutEdges).toEqual(['left']);
    expect(second[8].cutEdges).toEqual(['right']);
    // Top course is the cut half-diamonds again.
    expect(plan.courses[16].every((t) => t.cutEdges.includes('top'))).toBe(true);
  });

  it('every coordinate is unique and every tile is placed exactly once', () => {
    const cases: Array<[ProductId, number, number]> = [
      ['first-one', 8, 8],
      ['first-one', 3, 11],
      ['second-high', 6, 9],
      ['basic-third', 8, 9],
      ['basic-third', 7, 4],
    ];
    for (const [productId, rows, cols] of cases) {
      const { layout, plan } = planFor(productId, rows, cols);
      expect(new Set(plan.tiles.map((t) => t.id)).size, `${productId} ${rows}×${cols}`).toBe(layout.tiles.length);
      expect(new Set(plan.tiles.map((t) => t.tile)).size).toBe(layout.tiles.length);
    }
  });

  it('flags a tile as cut exactly when the layout does', () => {
    for (const productId of ['first-one', 'second-high', 'basic-third'] as const) {
      const { plan } = planFor(productId, 6, 7);
      for (const t of plan.tiles) {
        expect(t.cutEdges.length > 0, `${t.id} (${productId})`).toBe(t.tile.cut);
      }
    }
  });

  it('lists each course left to right', () => {
    const { plan } = planFor('first-one', 5, 6);
    for (const course of plan.courses) {
      const xs = course.map((t) => t.cx);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    }
  });

  it('Second High: plain grid, column per tile, rotation carried through', () => {
    const { plan } = planFor('second-high', 4, 5);
    expect(plan.columnCount).toBe(5);
    expect(plan.courses.length).toBe(4);
    expect(plan.courses[0].map((t) => t.id)).toEqual(['A01', 'B01', 'C01', 'D01', 'E01']);
    expect(plan.tiles.every((t) => t.cutEdges.length === 0)).toBe(true);
    expect(plan.tiles.some((t) => t.rotation === 90)).toBe(true);
    expect(plan.tiles.some((t) => t.rotation === 0)).toBe(true);
  });

  it('only Second High ever reports a rotation', () => {
    for (const productId of ['first-one', 'basic-third'] as const) {
      const { plan } = planFor(productId, 4, 4);
      expect(plan.tiles.every((t) => t.rotation === 0), productId).toBe(true);
    }
  });

  it('Basic Third staggered: offset courses have a cut half tile at each end, on the other letters', () => {
    const { plan } = planFor('basic-third', 4, 3, { ...DEFAULT_OPTIONS, bond: 'staggered' });
    expect(plan.courses[0].length).toBe(3);
    expect(plan.courses[1].length).toBe(4);
    expect(plan.courses[1][0].cutEdges).toEqual(['left']);
    expect(plan.courses[1][3].cutEdges).toEqual(['right']);
    const rowA = new Set(plan.courses[0].map((t) => t.columnIndex % 2));
    const rowB = new Set(plan.courses[1].map((t) => t.columnIndex % 2));
    expect(rowA.size).toBe(1);
    expect(rowB.size).toBe(1);
    expect([...rowA][0]).not.toBe([...rowB][0]);
  });

  it('Basic Third stacked: whole tiles in plain columns', () => {
    const { plan } = planFor('basic-third', 4, 3, { ...DEFAULT_OPTIONS, bond: 'stacked' });
    expect(plan.columnCount).toBe(3);
    expect(plan.tiles.every((t) => t.cutEdges.length === 0)).toBe(true);
  });

  it('a one-column wall still works', () => {
    for (const productId of ['first-one', 'second-high', 'basic-third'] as const) {
      const { layout, plan } = planFor(productId, 2, 1);
      expect(plan.tiles.length).toBe(layout.tiles.length);
      expect(plan.columnX.length).toBe(plan.columnCount);
    }
  });

  it('the codes add up to the schedule', () => {
    const { layout, plan } = planFor('first-one', 8, 8);
    const byCode = new Map<string, number>();
    for (const t of plan.tiles) byCode.set(t.code, (byCode.get(t.code) ?? 0) + 1);
    expect([...byCode.values()].reduce((a, b) => a + b, 0)).toBe(layout.tiles.length);
  });
});
