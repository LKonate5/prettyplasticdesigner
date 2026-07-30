import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../../data/palette';
import { layoutFirstOne } from '../layout/firstOne';
import { layoutSecondHigh } from '../layout/secondHigh';
import type { Cell } from '../types';
import type { MaterialId, PatternConfig, PatternType } from '../types';
import { generatePattern } from './generators';

const base = (over: Partial<PatternConfig> = {}): PatternConfig => ({
  type: 'random',
  seed: 42,
  allowedMaterials: MATERIALS.map((m) => m.id),
  toneVariation: 0.5,
  solidMaterial: 'ochre-medium',
  gradient: { direction: 'vertical' },
  stripes: { direction: 'horizontal', width: 2 },
  ...over,
});

const ALL_TYPES: PatternType[] = ['solid', 'random', 'gradient', 'stripes', 'checker'];

const familyAt = (cell: Cell) => MATERIALS[cell.material].colour;

function familyGrid(cells: Cell[], rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => familyAt(cells[row * cols + col])),
  );
}

function hasFamilyRun(grid: string[][], length: number): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const family = grid[row][col];
      if (Array.from({ length }, (_, i) => grid[row][(col + i) % cols]).every((v) => v === family)) {
        return true;
      }
      if (Array.from({ length }, (_, i) => grid[(row + i) % rows][col]).every((v) => v === family)) {
        return true;
      }
    }
  }
  return false;
}

function hasFamilyBlock(grid: string[][]): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const family = grid[row][col];
      if (
        grid[row][(col + 1) % cols] === family &&
        grid[(row + 1) % rows][col] === family &&
        grid[(row + 1) % rows][(col + 1) % cols] === family
      ) {
        return true;
      }
    }
  }
  return false;
}

describe('pattern generators', () => {
  it('same seed → identical design; different seed → different design', () => {
    const layout = layoutSecondHigh(10, 10);
    const a = generatePattern(base(), layout);
    const b = generatePattern(base(), layout);
    const c = generatePattern(base({ seed: 43 }), layout);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('every generator respects the palette restriction', () => {
    const layout = layoutFirstOne(8, 6);
    const allowed: MaterialId[] = ['green-light', 'green-dark'];
    const allowedIdx = new Set(
      MATERIALS.map((m, i) => (allowed.includes(m.id) ? i : -1)).filter((i) => i >= 0),
    );
    for (const type of ALL_TYPES) {
      const cells = generatePattern(
        base({ type, allowedMaterials: allowed, toneVariation: 1 }),
        layout,
      );
      for (const cell of cells) expect(allowedIdx.has(cell.material)).toBe(true);
    }
  });

  it('wrap-partner tiles get the same colour (tileable by construction)', () => {
    // First One aligned rows: c=0 (left half) and c=cols (right half) share a cell
    const layout = layoutFirstOne(8, 6);
    const cells = generatePattern(base(), layout);
    const rightEdges = layout.tiles.filter((t) => t.col === 6);
    expect(rightEdges.length).toBeGreaterThan(0);
    for (const right of rightEdges) {
      const left = layout.tiles.find((t) => t.row === right.row && t.col === 0)!;
      expect(cells[left.cellIndex].material).toBe(cells[right.cellIndex].material);
    }
  });

  // No product generates a rotation: every tile is laid the same way up, so the
  // generator only ever decides a colour (see Cell in core/types.ts).
  it('generates colour and nothing else', () => {
    for (const layout of [layoutSecondHigh(10, 10), layoutFirstOne(6, 6)]) {
      for (const cell of generatePattern(base(), layout)) {
        expect(Object.keys(cell)).toEqual(['material']);
      }
    }
  });

  it('solid with toneVariation 0 is uniform; with tone > 0 it varies shade only', () => {
    const layout = layoutSecondHigh(8, 8);
    const flat = generatePattern(base({ type: 'solid', toneVariation: 0 }), layout);
    expect(new Set(flat.map((c) => c.material)).size).toBe(1);
    const varied = generatePattern(base({ type: 'solid', toneVariation: 0.8 }), layout);
    const colours = new Set(varied.map((c) => MATERIALS[c.material].colour));
    expect(colours.size).toBe(1); // shade may vary, colour never does
    expect(new Set(varied.map((c) => c.material)).size).toBeGreaterThan(1);
  });

  it('random mix avoids avoidable long colour-family runs', () => {
    const layout = layoutSecondHigh(14, 16);
    const cells = generatePattern(base({ seed: 107 }), layout);
    expect(hasFamilyRun(familyGrid(cells, layout.patternRows, layout.patternCols), 3)).toBe(false);
  });

  it('random mix avoids avoidable 2x2 colour-family blocks', () => {
    const layout = layoutSecondHigh(14, 16);
    const cells = generatePattern(base({ seed: 211 }), layout);
    expect(hasFamilyBlock(familyGrid(cells, layout.patternRows, layout.patternCols))).toBe(false);
  });

  it('random mix keeps colour families balanced on large walls', () => {
    const layout = layoutSecondHigh(20, 20);
    const cells = generatePattern(base({ seed: 309 }), layout);
    const counts = new Map<string, number>();
    for (const cell of cells) counts.set(familyAt(cell), (counts.get(familyAt(cell)) ?? 0) + 1);
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(4);
  });

  it('random mix degrades gracefully for a one-family palette', () => {
    const layout = layoutSecondHigh(10, 10);
    const allowed: MaterialId[] = ['green-light', 'green-medium', 'green-dark'];
    const cells = generatePattern(base({ allowedMaterials: allowed, seed: 991 }), layout);
    const allowedIdx = new Set(
      MATERIALS.map((m, i) => (allowed.includes(m.id) ? i : -1)).filter((i) => i >= 0),
    );
    expect(cells.every((cell) => allowedIdx.has(cell.material))).toBe(true);
    expect(new Set(cells.map((cell) => cell.material)).size).toBeGreaterThan(1);
  });
});
