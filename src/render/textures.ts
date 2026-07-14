import type { MaterialId, ProductId } from '../core/types';

/**
 * Real tile photos. scripts/import-textures.sh drops downscaled JPEGs at
 *   public/textures/{productId}/{colour}-{shade}-{NN}.jpg
 * plus manifest.json = { "productId/materialId": variantCount }.
 *
 * Each material maps to an ARRAY of photo variants so tiles of one colour can
 * vary naturally, like the real recycled product. The app loads the manifest
 * once at startup; products without photos (no manifest entries) fall back to
 * flat hex rendering and get a "rendered preview" disclaimer in the UI.
 */

export type TextureMap = ReadonlyMap<string, readonly string[]>; // "productId/materialId" → variant urls

export const textureKey = (productId: ProductId, materialId: MaterialId): string =>
  `${productId}/${materialId}`;

export async function loadTextures(): Promise<TextureMap> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}textures/manifest.json`);
    if (!res.ok) return new Map();
    const manifest: Record<string, number> = await res.json();
    const map = new Map<string, string[]>();
    for (const [key, count] of Object.entries(manifest)) {
      if (!Number.isFinite(count) || count < 1) continue;
      map.set(
        key,
        Array.from(
          { length: count },
          (_, i) =>
            `${import.meta.env.BASE_URL}textures/${key}-${String(i + 1).padStart(2, '0')}.jpg`,
        ),
      );
    }
    return map;
  } catch {
    return new Map(); // no manifest → hex fallback everywhere
  }
}

/**
 * Deterministic photo-variant pick for a tile. Keyed on the canonical pattern
 * position so wrap-partner tiles share the same photo — the wall stays
 * perfectly tileable even with natural variation.
 */
export function variantFor(
  urls: readonly string[],
  patternRow: number,
  patternCol: number,
): string {
  const h =
    (Math.imul(patternRow + 17, 73856093) ^ Math.imul(patternCol + 31, 19349663)) >>> 0;
  return urls[h % urls.length];
}

/**
 * Fetch the photo variants used by a design as data URLs, for inlining into
 * export SVGs. (SVG loaded as an image for PNG export runs in "secure static
 * mode": browsers block ALL external file references, even same-origin ones —
 * inlined data URLs are the only thing that renders.) Order is preserved so
 * the per-tile variant pick lands on the same photo in exports.
 */
const dataUrlCache = new Map<string, string>();

async function fetchDataUrl(url: string): Promise<string> {
  const cached = dataUrlCache.get(url);
  if (cached) return cached;
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  dataUrlCache.set(url, dataUrl);
  return dataUrl;
}

export async function texturesAsDataUrls(
  textures: TextureMap,
  productId: ProductId,
  materialIds: MaterialId[],
): Promise<Map<string, readonly string[]>> {
  const out = new Map<string, readonly string[]>();
  await Promise.all(
    materialIds.map(async (mid) => {
      const key = textureKey(productId, mid);
      const urls = textures.get(key);
      if (!urls || urls.length === 0) return;
      out.set(key, await Promise.all(urls.map(fetchDataUrl)));
    }),
  );
  return out;
}
