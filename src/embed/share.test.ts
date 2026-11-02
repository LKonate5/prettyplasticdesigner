import { describe, expect, it } from 'vitest';
import { initialDesign } from '../core/state/reducer';
import { decodeDesign, encodeDesign } from './share';

describe('share encode/decode', () => {
  it('round-trips a freshly generated design exactly (no overrides)', () => {
    const design = initialDesign('first-one', 12345);
    const decoded = decodeDesign(encodeDesign(design));
    expect(decoded).toEqual(design);
  });

  it('round-trips hand-painted overrides', () => {
    const design = initialDesign('second-high', 999);
    // paint a few cells to differ from the generated pattern
    design.cells[0] = { material: 5 };
    design.cells[3] = { material: 11 };
    const decoded = decodeDesign(encodeDesign(design));
    expect(decoded).not.toBeNull();
    expect(decoded!.cells[0]).toEqual({ material: 5 });
    expect(decoded!.cells[3]).toEqual({ material: 11 });
    expect(decoded!.cells).toEqual(design.cells);
  });

  it('round-trips Second High rotation overrides', () => {
    const design = initialDesign('second-high', 123);
    design.cells[4] = { ...design.cells[4], rotation: 270 };
    const decoded = decodeDesign(encodeDesign(design));
    expect(decoded?.cells[4]).toEqual(design.cells[4]);
  });

  it('opens a legacy link carrying Second High rotations', () => {
    const legacy = {
      p: 'second-high',
      r: 10,
      c: 10,
      e: 450,
      b: 1,
      t: 'random',
      s: 999,
      tv: 0.35,
      sm: 0,
      am: [0, 1, 2],
      gd: 'vertical',
      sdir: 'horizontal',
      sw: 2,
      rr: 1,
      w: 0.1,
      o: [[0, 5, 90], [3, 11, 270]], // [cellIndex, material, rotation]
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(legacy))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const decoded = decodeDesign(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.productId).toBe('second-high');
    expect(decoded!.cells[0]).toEqual({ material: 5, rotation: 90 });
    expect(decoded!.cells[3]).toEqual({ material: 11, rotation: 270 });
  });

  it('reads a pre-flip link\'s gradient direction swapped, so it opens as priced', () => {
    // `gd` predates naming Direction for the bands it draws: back then
    // "vertical" meant the colour ran down the wall, which is what "horizontal"
    // means now. Quotes already sent carry links like this one.
    const legacy = {
      p: 'first-one',
      r: 10,
      c: 10,
      e: 450,
      b: 1,
      t: 'gradient',
      s: 7,
      tv: 0.3,
      sm: 0,
      am: [0, 1, 2],
      gd: 'vertical',
      sdir: 'horizontal',
      sw: 2,
      w: 0.1,
      o: [],
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(legacy))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeDesign(encoded)?.pattern.gradient.direction).toBe('horizontal');
  });

  it('carries product, size, options and pattern settings', () => {
    const design = initialDesign('basic-third', 42);
    design.options = { exposure: 380, bond: 'stacked' };
    design.pattern = { ...design.pattern, type: 'stripes', allowedMaterials: ['green-dark'] };
    const decoded = decodeDesign(encodeDesign(design))!;
    expect(decoded.productId).toBe('basic-third');
    expect(decoded.options).toEqual({ exposure: 380, bond: 'stacked' });
    expect(decoded.pattern.type).toBe('stripes');
    expect(decoded.pattern.allowedMaterials).toEqual(['green-dark']);
  });

  it('round-trips the share of each material exactly', () => {
    const design = initialDesign('first-one', 77);
    design.pattern = {
      ...design.pattern,
      weights: { ...Object.fromEntries(design.pattern.allowedMaterials.map((id) => [id, 0])), 'ochre-medium': 400, 'green-dark': 600 },
    };
    const decoded = decodeDesign(encodeDesign(design))!;
    expect(decoded.pattern.weights).toEqual(design.pattern.weights);
  });

  it('opens a link from before shares existed with the even mix', () => {
    const decoded = decodeDesign(encodeDesign(initialDesign('first-one', 5)))!;
    expect(decoded.pattern.weights).toBeUndefined();
  });

  it('a link with shares for materials the product does not offer still opens', () => {
    const legacy = {
      p: 'second-high',
      r: 10,
      c: 10,
      e: 450,
      b: 1,
      t: 'random',
      s: 3,
      tv: 0.35,
      sm: 0,
      am: [1, 14], // ochre-medium and blue-dark; Blue is First One only
      ws: [300, 700],
      gd: 'vertical',
      sdir: 'horizontal',
      sw: 2,
      w: 0.1,
      o: [],
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(legacy))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const decoded = decodeDesign(encoded)!;
    expect(decoded).not.toBeNull();
    const weights = decoded.pattern.weights ?? {};
    expect(Object.keys(weights)).toEqual(['ochre-medium']);
    expect(weights['ochre-medium']).toBe(1000);
  });

  it('returns null on garbage input', () => {
    expect(decodeDesign('not-valid-base64!!!')).toBeNull();
    expect(decodeDesign('')).toBeNull();
  });

  it('round-trips the repeat count, and a link without one means a single design', () => {
    const design = { ...initialDesign('first-one', 5), repeat: 12 };
    expect(decodeDesign(encodeDesign(design))?.repeat).toBe(12);
    const single = initialDesign('first-one', 5);
    expect(decodeDesign(encodeDesign(single))?.repeat).toBe(1);
    expect(atob(encodeDesign(single).replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('rp');
  });

  it('clamps a repeat count a link should not carry', () => {
    const wild = { ...initialDesign('first-one', 5), repeat: 1e9 };
    expect(decodeDesign(encodeDesign(wild))?.repeat).toBeLessThanOrEqual(200);
  });
});
