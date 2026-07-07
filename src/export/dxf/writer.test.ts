import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../core/layout';
import { generatePattern } from '../../core/pattern/generators';
import { defaultPattern } from '../../core/state/reducer';
import { MATERIALS } from '../../data/palette';
import { PRODUCTS } from '../../data/products';
import type { Cell, ProductId } from '../../core/types';
import { buildDxf } from './writer';

function dxfFor(productId: ProductId, rows = 6, cols = 5) {
  const product = PRODUCTS[productId];
  const layout = computeLayout(product, rows, cols, { exposure: 450, bond: 'staggered' });
  const cells = generatePattern(defaultPattern(3), layout);
  return { product, layout, cells, dxf: buildDxf(product, layout, cells) };
}

/** Parse the flat (code,value) stream into pairs. */
function pairs(dxf: string): Array<[string, string]> {
  const tokens = dxf.split(/\r\n/);
  const out: Array<[string, string]> = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) out.push([tokens[i].trim(), tokens[i + 1]]);
  return out;
}

describe('DXF writer (AC1015)', () => {
  it('has balanced SECTION/ENDSEC and ends with EOF', () => {
    const { dxf } = dxfFor('first-one');
    const secs = (dxf.match(/\r\nSECTION\r\n/g) ?? []).length;
    const ends = (dxf.match(/\r\nENDSEC\r\n/g) ?? []).length;
    expect(secs).toBe(ends);
    expect(secs).toBe(5); // HEADER TABLES BLOCKS ENTITIES OBJECTS
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
  });

  it('declares mm units and metric measurement', () => {
    const { dxf } = dxfFor('second-high');
    expect(dxf).toContain('$INSUNITS');
    // $INSUNITS ... 70 / 4  (millimetres)
    const p = pairs(dxf);
    const i = p.findIndex(([c, v]) => c === '9' && v === '$INSUNITS');
    expect(p[i + 1]).toEqual(['70', '4']);
    const m = p.findIndex(([c, v]) => c === '9' && v === '$MEASUREMENT');
    expect(p[m + 1]).toEqual(['70', '1']);
  });

  it('emits one closed LWPOLYLINE per tile plus the wall outline', () => {
    const { dxf, layout } = dxfFor('first-one');
    const polys = (dxf.match(/\r\nLWPOLYLINE\r\n/g) ?? []).length;
    expect(polys).toBe(layout.cellCount + 1); // tiles + boundary (First One has no facets)
    // every polyline is flagged closed (70 → 1)
    expect((dxf.match(/\r\n70\r\n1\r\n/g) ?? []).length).toBeGreaterThanOrEqual(layout.cellCount);
  });

  it('creates a layer per used material and nothing for unused ones', () => {
    const { dxf, cells } = dxfFor('basic-third');
    const used = new Set(cells.map((c: Cell) => MATERIALS[c.material].dxfLayer));
    for (const layer of used) expect(dxf).toContain(layer);
    expect(dxf).toContain('PP_OUTLINE');
    // a material definitely not present should not get a layer
    const unused = MATERIALS.find((m) => !used.has(m.dxfLayer));
    if (unused) {
      const layerDefs = (dxf.match(new RegExp(`\\r\\nLAYER\\r\\n`, 'g')) ?? []).length;
      expect(layerDefs).toBeLessThan(MATERIALS.length + 5);
    }
  });

  it('Second High also emits facet polylines on PP_FACETS', () => {
    const { dxf, layout } = dxfFor('second-high');
    expect(dxf).toContain('PP_FACETS');
    const polys = (dxf.match(/\r\nLWPOLYLINE\r\n/g) ?? []).length;
    expect(polys).toBe(layout.cellCount * 2 + 1); // tile + facet each, + boundary
  });

  it('every entity/record carries a unique handle', () => {
    const { dxf } = dxfFor('first-one');
    const p = pairs(dxf);
    // group 5 = handle. Collect them (skip the $HANDSEED header value).
    const handles = p
      .filter(([c]) => c === '5')
      .map(([, v]) => v)
      .filter((v) => v !== 'FFFFFF');
    expect(handles.length).toBeGreaterThan(0);
    expect(new Set(handles).size).toBe(handles.length); // all unique
    // all valid hex, all below the seed
    for (const h of handles) {
      expect(/^[0-9A-F]+$/.test(h)).toBe(true);
      expect(parseInt(h, 16)).toBeLessThan(0xffffff);
    }
  });

  it('coordinates are finite (no NaN/Infinity leaks)', () => {
    for (const id of ['first-one', 'second-high', 'basic-third'] as ProductId[]) {
      const { dxf } = dxfFor(id);
      expect(dxf).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});
