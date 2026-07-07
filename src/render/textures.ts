import { MATERIAL_IDS } from '../data/palette';
import { PRODUCT_LIST } from '../data/products';
import type { MaterialId, ProductId } from '../core/types';

/**
 * Real tile texture PNGs are drop-in: put them at
 *   public/textures/{productId}/{colour}-{shade}.png
 * and reload — this module probes all 36 possible files at startup and the
 * renderer uses whichever exist, falling back to flat hex for the rest.
 * (Missing files just 404 quietly during the probe; that's expected.)
 */

export type TextureMap = ReadonlyMap<string, string>; // "productId/materialId" → url

export const textureKey = (productId: ProductId, materialId: MaterialId): string =>
  `${productId}/${materialId}`;

export function textureUrl(productId: ProductId, materialId: MaterialId): string {
  return `${import.meta.env.BASE_URL}textures/${productId}/${materialId}.png`;
}

export async function probeTextures(): Promise<TextureMap> {
  const map = new Map<string, string>();
  const probes: Promise<void>[] = [];
  for (const product of PRODUCT_LIST) {
    for (const materialId of MATERIAL_IDS) {
      probes.push(
        new Promise((resolve) => {
          const url = textureUrl(product.id, materialId);
          const img = new Image();
          img.onload = () => {
            map.set(textureKey(product.id, materialId), url);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
      );
    }
  }
  await Promise.all(probes);
  return map;
}

/**
 * Fetch the textures used by a design and return them as data URLs, for
 * inlining into export SVGs. (SVG loaded as an image for PNG export runs in
 * "secure static mode": browsers block ALL external file references, even
 * same-origin ones — inlined data URLs are the only thing that renders.)
 */
const dataUrlCache = new Map<string, string>();

export async function texturesAsDataUrls(
  textures: TextureMap,
  productId: ProductId,
  materialIds: MaterialId[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    materialIds.map(async (mid) => {
      const key = textureKey(productId, mid);
      const url = textures.get(key);
      if (!url) return;
      let dataUrl = dataUrlCache.get(key);
      if (!dataUrl) {
        const blob = await (await fetch(url)).blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        dataUrlCache.set(key, dataUrl);
      }
      out.set(key, dataUrl);
    }),
  );
  return out;
}
