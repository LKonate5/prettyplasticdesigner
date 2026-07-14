import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../core/layout';
import { generatePattern } from '../core/pattern/generators';
import { defaultPattern } from '../core/state/reducer';
import { PRODUCTS } from '../data/products';
import type { MaterialId, ProductId } from '../core/types';
import { MATERIAL_IDS } from '../data/palette';
import { WallScene } from './WallScene';
import { textureKey, type TextureMap } from './textures';

/**
 * Headless render check: the WallScene is the SAME component the SVG/PNG
 * exports serialize, so asserting on its markup verifies both screen and
 * export geometry without a browser.
 */
function render(
  productId: ProductId,
  rows: number,
  cols: number,
  opts: { textures?: TextureMap; seed?: number; solid?: MaterialId } = {},
): string {
  const product = PRODUCTS[productId];
  const layout = computeLayout(product, rows, cols, { exposure: 450, bond: 'staggered' });
  const seed = opts.seed ?? 1;
  // A solid pattern puts ONE material on every tile — the only way to observe
  // how that material's photos are spread across a whole wall.
  const pattern = opts.solid
    ? {
        ...defaultPattern(seed),
        type: 'solid' as const,
        solidMaterial: opts.solid,
        toneVariation: 0, // otherwise shades drift and it isn't one material any more
      }
    : defaultPattern(seed);
  const cells = generatePattern(pattern, layout);
  return renderToStaticMarkup(
    <WallScene
      layout={layout}
      cells={cells}
      product={product}
      textures={opts.textures ?? new Map()}
      seed={seed}
    />,
  );
}

/** A stand-in photo manifest: `count` fake variants for every material. */
function fakeTextures(productId: ProductId, count: number): TextureMap {
  const map = new Map<string, readonly string[]>();
  for (const id of MATERIAL_IDS as MaterialId[]) {
    map.set(
      textureKey(productId, id),
      Array.from({ length: count }, (_, i) => `${id}-v${i}.jpg`),
    );
  }
  return map;
}

const countData = (svg: string): number => (svg.match(/data-cell=/g) ?? []).length;

describe('WallScene markup', () => {
  it('renders one group per tile with a true-mm viewBox', () => {
    const product = PRODUCTS['second-high'];
    const layout = computeLayout(product, 10, 10, { exposure: 450, bond: 'staggered' });
    const svg = render('second-high', 10, 10);
    expect(svg).toContain(`viewBox="0 0 ${layout.wallW} ${layout.wallH}"`);
    expect(countData(svg)).toBe(layout.cellCount);
    expect(svg).toContain('#26282b'); // wall background baked in (not a CSS var)
  });

  it('Second High carries the facet motif when it has no photo', () => {
    const svg = render('second-high', 6, 6);
    expect(svg).toContain('id="pp-facet"');
    expect(svg).toContain('href="#pp-facet"');
  });

  it('Basic Third carries relief bands and lap shadows', () => {
    const svg = render('basic-third', 5, 4);
    expect(svg).toContain('id="pp-bands"');
    expect(svg).toContain('rgba(0,0,0,0.18)'); // course shadow strips
  });

  it('First One draws diamonds with a lap shadow AND a lit lip, and clips edge tiles', () => {
    const svg = render('first-one', 8, 5);
    expect(svg).toContain('rgba(0,0,0,0.18)'); // cast shadow on the upper edges
    expect(svg).toContain('rgba(255,255,255,0.16)'); // lit lip on the lower edges
    expect(svg).toContain('clip-path="url(#pp-wall-clip)"'); // cut edge tiles
    expect(svg).toContain('id="pp-wall-clip"');
  });

  /**
   * The load-bearing invariant of the whole renderer. Every tile is directional
   * — First One hangs from a nose at its north vertex, Second High's wedge
   * protrudes one way — and the photos are lit from a single direction. Turning
   * or mirroring a tile turns its light with it and paints a wall that cannot
   * physically exist. See Cell in core/types.ts.
   */
  describe('tiles are never turned or mirrored', () => {
    for (const id of ['first-one', 'second-high', 'basic-third'] as ProductId[]) {
      it(`${id}: no rotate/scale/matrix transform, with photos or without`, () => {
        for (const textures of [new Map(), fakeTextures(id, 6)]) {
          const svg = render(id, 6, 6, { textures });
          expect(svg).not.toMatch(/rotate\(/);
          expect(svg).not.toMatch(/scale\(/);
          expect(svg).not.toMatch(/matrix\(/);
        }
      });
    }
  });

  describe('photo variety', () => {
    // The only thing distinguishing two same-coloured tiles now that nothing
    // rotates — so every photo of a colour has to actually reach the wall.
    // (variantFor's spread is unit-tested in textures.test.ts; this proves it
    // survives the whole render path into the markup.)
    it('a wall of one colour uses every photo that colour has', () => {
      const svg = render('second-high', 10, 10, {
        textures: fakeTextures('second-high', 6),
        solid: 'grey-dark',
      });
      const used = new Set(svg.match(/grey-dark-v\d\.jpg/g) ?? []);
      expect(used.size).toBe(6);
    });

    it('shuffling the seed reshuffles the photos', () => {
      const textures = fakeTextures('second-high', 6);
      const a = render('second-high', 8, 8, { textures, seed: 1, solid: 'grey-dark' });
      const b = render('second-high', 8, 8, { textures, seed: 2, solid: 'grey-dark' });
      expect(a).not.toEqual(b); // same colours, different photography
    });
  });

  it('no NaN or undefined leaks into coordinates', () => {
    for (const id of ['first-one', 'second-high', 'basic-third'] as ProductId[]) {
      const svg = render(id, 6, 5);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });
});
