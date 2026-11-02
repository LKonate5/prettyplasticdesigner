import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../../data/palette';
import type { MaterialId, PatternConfig } from '../types';
import {
  WEIGHT_TOTAL,
  cumulativeShares,
  effectiveShares,
  evenColourShares,
  quotas,
  reconcileWeights,
  setShare,
  shareCycle,
} from './shares';

const ALL = MATERIALS.map((m) => m.id) as MaterialId[];
const sum = (values: Iterable<number>) => [...values].reduce((a, b) => a + b, 0);

const pattern = (over: Partial<PatternConfig> = {}): PatternConfig => ({
  type: 'random',
  seed: 1,
  allowedMaterials: ALL,
  toneVariation: 0.5,
  solidMaterial: 'ochre-medium',
  gradient: { direction: 'vertical' },
  stripes: { direction: 'horizontal', width: 2 },
  ...over,
});

describe('tile shares', () => {
  it('the even random mix gives every colour the same share, split between its shades', () => {
    const ids: MaterialId[] = ['ochre-light', 'ochre-medium', 'ochre-dark', 'green-medium'];
    const shares = evenColourShares(ids);
    expect(shares.get('green-medium')).toBeCloseTo(0.5);
    expect(shares.get('ochre-light')).toBeCloseTo(1 / 6);
    expect(sum(shares.values())).toBeCloseTo(1);
  });

  it('other types start with every material equal', () => {
    const shares = effectiveShares(pattern({ type: 'stripes' }), ALL);
    for (const id of ALL) expect(shares.get(id)).toBeCloseTo(1 / ALL.length);
  });

  it('quotas are whole tiles that add up to the wall exactly', () => {
    for (const total of [1, 7, 100, 432, 1001]) {
      const counts = quotas(effectiveShares(pattern(), ALL), total);
      expect(sum(counts.values())).toBe(total);
    }
  });

  it('setShare puts the chosen material on its share and keeps the weights at 1000', () => {
    for (const share of [0, 0.01, 0.333, 0.4, 0.5, 0.99, 1]) {
      const weights = setShare(pattern(), ALL, 'ochre-medium', share);
      expect(sum(Object.values(weights))).toBe(WEIGHT_TOTAL);
      expect(weights['ochre-medium']).toBe(Math.round(share * WEIGHT_TOTAL));
    }
  });

  it('setShare scales the others in proportion to what they had', () => {
    const start = pattern({ weights: { 'ochre-light': 600, 'ochre-medium': 200, 'green-dark': 200 } });
    const ids: MaterialId[] = ['ochre-light', 'ochre-medium', 'green-dark'];
    const weights = setShare(start, ids, 'ochre-medium', 0.6);
    expect(weights['ochre-medium']).toBe(600);
    // the other two shared 800 in a 3:1 ratio and now share 400
    expect(weights['ochre-light']).toBe(300);
    expect(weights['green-dark']).toBe(100);
  });

  it('setShare to 0 and back keeps the others in their old proportions', () => {
    const ids: MaterialId[] = ['ochre-light', 'ochre-medium', 'green-dark'];
    const start = pattern({ weights: { 'ochre-light': 600, 'ochre-medium': 200, 'green-dark': 200 } });
    const off = setShare(start, ids, 'ochre-medium', 0);
    expect(off['ochre-medium']).toBe(0);
    expect(off['ochre-light']).toBe(750);
    expect(off['green-dark']).toBe(250);
  });

  it('a lone material owns the whole wall', () => {
    expect(setShare(pattern(), ['grey-dark'], 'grey-dark', 0.2)).toEqual({ 'grey-dark': WEIGHT_TOTAL });
  });

  it('reconcileWeights leaves no weights as no weights', () => {
    expect(reconcileWeights(undefined, ALL)).toBeUndefined();
    expect(reconcileWeights({}, ALL)).toBeUndefined();
  });

  it('reconcileWeights is stable when nothing changed', () => {
    const ids: MaterialId[] = ['ochre-light', 'ochre-medium', 'green-dark'];
    const weights = { 'ochre-light': 500, 'ochre-medium': 300, 'green-dark': 200 };
    expect(reconcileWeights(weights, ids)).toEqual(weights);
  });

  it('reconcileWeights drops removed materials and refills the wall', () => {
    const ids: MaterialId[] = ['ochre-light', 'green-dark'];
    const weights = reconcileWeights(
      { 'ochre-light': 500, 'ochre-medium': 300, 'green-dark': 200 },
      ids,
    )!;
    expect(Object.keys(weights).sort()).toEqual(['green-dark', 'ochre-light']);
    expect(sum(Object.values(weights))).toBe(WEIGHT_TOTAL);
    expect(weights['ochre-light']).toBeGreaterThan(weights['green-dark']!);
  });

  it('reconcileWeights gives a material that joined an even share', () => {
    const ids: MaterialId[] = ['ochre-light', 'green-dark', 'grey-dark', 'blue-dark'];
    const weights = reconcileWeights({ 'ochre-light': 700, 'green-dark': 300 }, ids)!;
    expect(sum(Object.values(weights))).toBe(WEIGHT_TOTAL);
    expect(weights['grey-dark']).toBe(250);
    expect(weights['blue-dark']).toBe(250);
    // the two that were already there keep their 7:3 ratio inside what is left
    expect(weights['ochre-light']! / weights['green-dark']!).toBeCloseTo(7 / 3, 1);
  });

  it('shareCycle follows the shares and always has something to lay', () => {
    const list: MaterialId[] = ['ochre-light', 'green-dark', 'grey-dark'];
    const shares = new Map<MaterialId, number>([
      ['ochre-light', 0.5],
      ['green-dark', 0.3],
      ['grey-dark', 0.2],
    ]);
    const cycle = shareCycle(list, shares, 20);
    expect(cycle).toHaveLength(20);
    expect(cycle.filter((id) => id === 'ochre-light')).toHaveLength(10);
    expect(cycle.filter((id) => id === 'green-dark')).toHaveLength(6);
    expect(cycle.filter((id) => id === 'grey-dark')).toHaveLength(4);
    // spread out, not three solid blocks
    expect(cycle.slice(0, 4)).toContain('green-dark');
  });

  it('cumulativeShares ends at 1', () => {
    const list: MaterialId[] = ['ochre-light', 'green-dark', 'grey-dark'];
    const bounds = cumulativeShares(
      list,
      new Map<MaterialId, number>([
        ['ochre-light', 0.5],
        ['green-dark', 0.3],
        ['grey-dark', 0.2],
      ]),
    );
    expect(bounds[0]).toBeCloseTo(0.5);
    expect(bounds[2]).toBeCloseTo(1);
  });
});
