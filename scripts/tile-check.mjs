import { writeFileSync, mkdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { computeLayout } from '../src/core/layout/index.ts';
import { generatePattern } from '../src/core/pattern/generators.ts';
import { defaultPattern } from '../src/core/state/reducer.ts';
import { PRODUCTS } from '../src/data/products.ts';
import { WallScene } from '../src/render/WallScene.tsx';

mkdirSync(new URL('../samples/', import.meta.url), { recursive: true });
for (const [id, product] of Object.entries(PRODUCTS)) {
  const grid = id === 'basic-third' ? [6, 5] : id === 'first-one' ? [8, 5] : [6, 6];
  const layout = computeLayout(product, grid[0], grid[1], { exposure: 450, bond: 'staggered' });
  const cells = generatePattern(defaultPattern(5), layout);
  // render ONE wall tile, then place it 2x2 to reveal any seam
  const one = renderToStaticMarkup(React.createElement(WallScene, {
    layout, cells, product, textures: new Map(),
  })).replace(/^<\?xml[^>]*>\n?/, '');
  const W = Math.round(layout.wallW), H = Math.round(layout.wallH);
  const cell = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${one.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
  const b64 = Buffer.from(cell).toString('base64');
  const grid2 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W*2}" height="${H*2}" viewBox="0 0 ${W*2} ${H*2}">
    <image href="data:image/svg+xml;base64,${b64}" x="0" y="0" width="${W}" height="${H}"/>
    <image href="data:image/svg+xml;base64,${b64}" x="${W}" y="0" width="${W}" height="${H}"/>
    <image href="data:image/svg+xml;base64,${b64}" x="0" y="${H}" width="${W}" height="${H}"/>
    <image href="data:image/svg+xml;base64,${b64}" x="${W}" y="${H}" width="${W}" height="${H}"/></svg>`;
  writeFileSync(new URL(`../samples/tile-${id}.svg`, import.meta.url), grid2);
  console.log(`tile-${id}: wall ${W}x${H}, ${layout.tiles.length} tiles, ${layout.cellCount} cells`);
}
