import { describe, expect, it } from 'vitest';
import { variantFor } from './textures';

/**
 * Since tiles are never rotated (see Cell in core/types.ts), the photo variant
 * is the ONLY thing keeping two same-coloured neighbours from being identical.
 * These are the properties that buys us.
 */

const urls = (n: number): string[] => Array.from({ length: n }, (_, i) => `v${i}`);
const row = (n: number, cols: number, seed = 7, r = 0): string[] =>
  Array.from({ length: cols }, (_, c) => variantFor(urls(n), seed, r, c));

describe('variantFor', () => {
  it('shows every photo of a colour once a row is long enough', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 9, 10]) {
      expect(new Set(row(n, n))).toHaveLength(n); // n consecutive tiles → all n photos
    }
  });

  it('never repeats a photo on two side-by-side tiles', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 9, 10]) {
      for (let r = 0; r < 12; r++) {
        const line = row(n, 24, 7, r);
        for (let c = 1; c < line.length; c++) expect(line[c]).not.toBe(line[c - 1]);
      }
    }
  });

  it('gives wrap partners the same photo, so the wall stays tileable', () => {
    // Wrap partners share (patternRow, patternCol) — that is the whole contract.
    expect(variantFor(urls(7), 42, 3, 5)).toBe(variantFor(urls(7), 42, 3, 5));
  });

  it('re-rolling the seed lands tiles on different photos', () => {
    const a = row(6, 20, 1);
    const b = row(6, 20, 2);
    expect(a).not.toEqual(b);
  });

  it('a colour with a single photo degrades gracefully', () => {
    // Second High ochre-light really does ship exactly one photo today.
    expect(row(1, 5)).toEqual(['v0', 'v0', 'v0', 'v0', 'v0']);
  });
});
