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
    design.cells[0] = { material: 5, rotation: 90 };
    design.cells[3] = { material: 11, rotation: 0 };
    const decoded = decodeDesign(encodeDesign(design));
    expect(decoded).not.toBeNull();
    expect(decoded!.cells[0]).toEqual({ material: 5, rotation: 90 });
    expect(decoded!.cells[3]).toEqual({ material: 11, rotation: 0 });
    expect(decoded!.cells).toEqual(design.cells);
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
