import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../../data/palette';
import { layoutFirstOne } from '../layout/firstOne';
import { layoutSecondHigh } from '../layout/secondHigh';
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
  randomRotation: false,
  ...over,
});

const ALL_TYPES: PatternType[] = ['solid', 'random', 'gradient', 'stripes', 'checker'];

describe('pattern generators', () => {
  it('same seed → identical design; different seed → different design', () => {
    const layout = layoutSecondHigh(10, 10, 'wall');
    const a = generatePattern(base(), layout);
    const b = generatePattern(base(), layout);
    const c = generatePattern(base({ seed: 43 }), layout);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('every generator respects the palette restriction', () => {
    const layout = layoutFirstOne(8, 6, 'wall');
    const allowed: MaterialId[] = ['green-light', 'green-dark'];
    const allowedIdx = new Set(
      MATERIALS.map((m, i) => (allowed.includes(m.id) ? i : -1)).filter((i) => i >= 0),
    );
    for (const type of ALL_TYPES) {
      // solidMaterial is deliberately outside the restriction → must fall back
      const cells = generatePattern(
        base({ type, allowedMaterials: allowed, toneVariation: 1 }),
        layout,
      );
      for (const cell of cells) expect(allowedIdx.has(cell.material)).toBe(true);
    }
  });

  it('random pattern is position-stable: resizing keeps existing cells', () => {
    const small = layoutFirstOne(6, 6, 'wall');
    const big = layoutFirstOne(10, 9, 'wall');
    const cfg = base();
    const smallCells = generatePattern(cfg, small);
    const bigCells = generatePattern(cfg, big);
    const bigByPos = new Map(
      big.tiles.map((t) => [`${t.row}:${t.col}`, bigCells[t.cellIndex]]),
    );
    for (const t of small.tiles) {
      expect(bigByPos.get(`${t.row}:${t.col}`)).toEqual(smallCells[t.cellIndex]);
    }
  });

  it('random rotation applies only to Second High', () => {
    const sh = generatePattern(
      base({ randomRotation: true }),
      layoutSecondHigh(10, 10, 'wall'),
    );
    const rotations = new Set(sh.map((c) => c.rotation));
    expect([...rotations].every((r) => [0, 90, 180, 270].includes(r))).toBe(true);
    expect(rotations.size).toBeGreaterThan(1);
    const fo = generatePattern(
      base({ randomRotation: true }),
      layoutFirstOne(6, 6, 'wall'),
    );
    expect(fo.every((c) => c.rotation === 0)).toBe(true);
  });

  it('solid with toneVariation 0 is uniform; with tone > 0 it varies shade only', () => {
    const layout = layoutSecondHigh(8, 8, 'wall');
    const flat = generatePattern(base({ type: 'solid', toneVariation: 0 }), layout);
    expect(new Set(flat.map((c) => c.material)).size).toBe(1);
    const varied = generatePattern(base({ type: 'solid', toneVariation: 0.8 }), layout);
    const colours = new Set(varied.map((c) => MATERIALS[c.material].colour));
    expect(colours.size).toBe(1); // shade may vary, colour never does
    expect(new Set(varied.map((c) => c.material)).size).toBeGreaterThan(1);
  });
});
