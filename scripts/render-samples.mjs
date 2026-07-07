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
  const grid = id === 'basic-third' ? [7, 9] : id === 'first-one' ? [16, 8] : [10, 10];
  const layout = computeLayout(product, grid[0], grid[1], { exposure: 450, bond: 'staggered' });
  const cells = generatePattern(defaultPattern(7), layout);
  const svg = renderToStaticMarkup(React.createElement(WallScene, {
    layout, cells, product, textures: new Map(),
    width: Math.round(layout.wallW * 0.6), height: Math.round(layout.wallH * 0.6),
  }));
  writeFileSync(new URL(`../samples/${id}.svg`, import.meta.url), svg);
  console.log(`samples/${id}.svg — ${layout.cellCount} tiles, ${layout.wallW}x${layout.wallH}mm`);
}
