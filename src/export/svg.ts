import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type {
  Cell,
  Layout,
  MaterialId,
  PatternConfig,
  ProductOptions,
  ProductSpec,
} from '../core/types';
import { materialAt } from '../data/palette';
import { WallScene } from '../render/WallScene';
import type { TextureMap } from '../render/textures';
import { texturesAsDataUrls } from '../render/textures';

/**
 * Everything an exporter needs. Carries options + pattern so the seamless
 * exporter can rebuild the torus layout without reaching back into React state.
 */
export interface SceneInput {
  product: ProductSpec;
  layout: Layout;
  cells: readonly Cell[];
  textures: TextureMap;
  options: ProductOptions;
  pattern: PatternConfig;
}

/** Distinct materials actually used by the design (for texture inlining + DXF layers). */
export function usedMaterialIds(cells: readonly Cell[]): MaterialId[] {
  const seen = new Set<number>();
  for (const c of cells) seen.add(c.material);
  return [...seen].map((i) => materialAt(i).id);
}

/**
 * Build a standalone SVG string of the wall. Textures are inlined as data URLs
 * — an SVG loaded as an image for PNG export runs in secure static mode, where
 * browsers block ALL external file references (even same-origin). So the same
 * inlined SVG serves both the .svg download and the raster pipeline.
 *
 * 1 SVG user unit = 1 mm; width/height are set in mm so CAD/vector tools read
 * true real-world size.
 */
export async function buildSceneSvg(
  { product, layout, cells, textures }: SceneInput,
  opts: { mm?: boolean } = {},
): Promise<string> {
  const dataUrls = await texturesAsDataUrls(textures, product.id, usedMaterialIds(cells));
  const inlineTextures: TextureMap = dataUrls;
  const mm = opts.mm ?? true;

  const body = renderToStaticMarkup(
    createElement(WallScene, {
      layout,
      cells,
      product,
      textures: inlineTextures,
      width: mm ? `${round(layout.wallW)}mm` : undefined,
      height: mm ? `${round(layout.wallH)}mm` : undefined,
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
