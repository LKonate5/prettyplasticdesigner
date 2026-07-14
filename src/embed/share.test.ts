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

  // Links minted before tile rotation was retired carry an `rr` flag and a
  // third element on each override. They must still reopen — the rotation is
  // simply dropped, since no tile is ever turned now.
  it('still opens a link from before rotation was retired', () => {
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
      rr: 1, // randomRotation — no longer a thing
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
    // the painted colours survive; the rotations are gone
    expect(decoded!.cells[0]).toEqual({ material: 5 });
    expect(decoded!.cells[3]).toEqual({ material: 11 });
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

  it('returns null on garbage input', () => {
    expect(decodeDesign('not-valid-base64!!!')).toBeNull();
    expect(decodeDesign('')).toBeNull();
  });
});
