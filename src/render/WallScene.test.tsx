import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../core/layout';
import { generatePattern } from '../core/pattern/generators';
import { defaultPattern } from '../core/state/reducer';
import { PRODUCTS } from '../data/products';
import type { ProductId } from '../core/types';
import { WallScene } from './WallScene';

/**
 * Headless render check: the WallScene is the SAME component the SVG/PNG
 * exports serialize, so asserting on its markup verifies both screen and
 * export geometry without a browser.
 */
function render(productId: ProductId, rows: number, cols: number): string {
  const product = PRODUCTS[productId];
  const layout = computeLayout(product, rows, cols, { exposure: 450, bond: 'staggered' });
  const cells = generatePattern(defaultPattern(1), layout);
  return renderToStaticMarkup(
    <WallScene layout={layout} cells={cells} product={product} textures={new Map()} />,
  );
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

  it('Second High carries the rotatable facet motif and rotates tiles', () => {
    const svg = render('second-high', 6, 6);
    expect(svg).toContain('id="pp-facet"');
    expect(svg).toContain('href="#pp-facet"');
    // random-rotation default → at least one tile is rotated
    expect(/rotate\((90|180|270)/.test(svg)).toBe(true);
  });

  it('Basic Third carries relief bands and lap shadows', () => {
    const svg = render('basic-third', 5, 4);
    expect(svg).toContain('id="pp-bands"');
    expect(svg).toContain('rgba(0,0,0,0.18)'); // course shadow strips
  });

  it('First One draws diamonds with lap shadows and clips edge tiles', () => {
    const svg = render('first-one', 8, 5);
    expect(svg).toContain('rgba(0,0,0,0.18)');
    expect(svg).toContain('clip-path="url(#pp-wall-clip)"'); // cut edge tiles
    expect(svg).toContain('id="pp-wall-clip"');
  });

  it('no NaN or undefined leaks into coordinates', () => {
    for (const id of ['first-one', 'second-high', 'basic-third'] as ProductId[]) {
      const svg = render(id, 6, 5);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });
});
