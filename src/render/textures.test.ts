import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTextures, variantFor } from './textures';

/**
 * Since tiles are never rotated (see Cell in core/types.ts), the photo variant
 * is the ONLY thing keeping two same-coloured neighbours from being identical.
 * These are the properties that buys us.
 */

const urls = (n: number): string[] => Array.from({ length: n }, (_, i) => `v${i}`);
const row = (n: number, cols: number, seed = 7, r = 0): string[] =>
  Array.from({ length: cols }, (_, c) => variantFor(urls(n), seed, r, c));

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('loadTextures', () => {
  it('loads manifest entries into product/material photo URL arrays', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        'first-one/ochre-light': 2,
        'second-high/green-dark': 1,
        'first-one/grey-medium': 0,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const textures = await loadTextures();

    expect(fetchMock).toHaveBeenCalledWith('/textures/manifest.json');
    expect(textures.get('first-one/ochre-light')).toEqual([
      '/textures/first-one/ochre-light-01.jpg',
      '/textures/first-one/ochre-light-02.jpg',
    ]);
    expect(textures.get('second-high/green-dark')).toEqual([
      '/textures/second-high/green-dark-01.jpg',
    ]);
    expect(textures.has('first-one/grey-medium')).toBe(false);
  });

  it('returns an empty map when the manifest is missing or unreadable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await loadTextures()).toEqual(new Map());

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await loadTextures()).toEqual(new Map());
  });
});
