import { cellRng } from '../core/pattern/prng';
import type { MaterialId, ProductId } from '../core/types';

/**
 * Real tile photos. scripts/import-textures.sh drops downscaled JPEGs at
 *   public/textures/{productId}/{colour}-{shade}-{NN}.jpg
 * plus manifest.json = { "productId/materialId": variantCount }.
 *
 * Each material maps to an ARRAY of photo variants so tiles of one colour can
 * vary naturally, like the real recycled product. Since tiles are never rotated
 * (see Cell in core/types.ts), the photo variant is the ONLY thing that keeps
 * same-coloured neighbours from being identical — so it has to spread well.
 *
 * The app loads the manifest once at startup; products without photos (no
 * manifest entries) fall back to flat hex rendering and get a "rendered
 * preview" disclaimer in the UI.
 */

export type TextureMap = ReadonlyMap<string, readonly string[]>; // "productId/materialId" → variant urls

export const textureKey = (productId: ProductId, materialId: MaterialId): string =>
  `${productId}/${materialId}`;

/**
 * Products that share Pretty Plastic's recycled-PVC material with another
 * product but do not have their own photography yet: fall back to the sibling
 * product's photos in the same colour/shade, so the preview shows the real
 * marble/flame finish instead of a flat swatch. Remove an entry here once that
 * product gets its own photos in the manifest (native photos always win).
 */
const PHOTO_FALLBACK: Partial<Record<ProductId, ProductId>> = {
  'basic-third': 'first-one',
};

export interface ResolvedTexture {
  urls: readonly string[];
  /** False when these are borrowed from PHOTO_FALLBACK rather than the product's own photos. */
  native: boolean;
}

export function resolveTexture(
  textures: TextureMap,
  productId: ProductId,
  materialId: MaterialId,
): ResolvedTexture | null {
  const own = textures.get(textureKey(productId, materialId));
  if (own && own.length > 0) return { urls: own, native: true };
  const fallbackProduct = PHOTO_FALLBACK[productId];
  if (fallbackProduct) {
    const borrowed = textures.get(textureKey(fallbackProduct, materialId));
    if (borrowed && borrowed.length > 0) return { urls: borrowed, native: false };
  }
  return null;
}

/** Whether `productId` currently shows its own photos, borrowed ones, or none (flat hex). */
export function productPhotoStatus(
  textures: TextureMap,
  productId: ProductId,
): 'native' | 'borrowed' | 'none' {
  const has = (id: ProductId) => [...textures.keys()].some((k) => k.startsWith(`${id}/`));
  if (has(productId)) return 'native';
  const fallback = PHOTO_FALLBACK[productId];
  if (fallback && has(fallback)) return 'borrowed';
  return 'none';
}

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

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Deterministic photo-variant pick for a tile.
 *
 * Each row walks its variants as an affine cycle: `(stride · col + offset) % n`,
 * with the stride drawn from the seed among the values COPRIME to n. That
 * coprimality is the whole trick — it makes the walk hit every variant before
 * it repeats, so a row of one colour shows all its photos and never puts the
 * same photo in two adjacent tiles. A plain random pick would clump: with only
 * 3 photos for some Second High colours, one neighbour in three would be a
 * visible duplicate.
 *
 * Stride and offset are redrawn per row, so there is no diagonal regularity
 * across the wall, and both come from the design seed — shuffling the seed
 * genuinely reshuffles the photography.
 *
 * Keyed on the CANONICAL pattern position, so wrap-partner tiles land on the
 * same photo and the wall stays perfectly tileable.
 */
export function variantFor(
  urls: readonly string[],
  seed: number,
  patternRow: number,
  patternCol: number,
): string {
  const n = urls.length;
  if (n <= 1) return urls[0];

  // Salt the seed so a row's photo walk is independent of its colour draw.
  const rng = cellRng(seed ^ 0x5bf03635, patternRow, 0);

  let coprimes = 0;
  for (let a = 1; a < n; a++) if (gcd(a, n) === 1) coprimes++;
  let pick = Math.floor(rng() * coprimes);
  let stride = 1;
  for (let a = 1; a < n; a++) {
    if (gcd(a, n) === 1 && pick-- === 0) {
      stride = a;
      break;
    }
  }
  const offset = Math.floor(rng() * n);

  const col = ((patternCol % n) + n) % n; // patternCol is never negative, but be safe
  return urls[(stride * col + offset) % n];
}

/**
 * A tiny per-tile brightness nudge, as an overlay alpha in [-1, 1] scaled by
 * TONE_JITTER in TileShape. Real recycled tiles vary in tone even within one
 * batch, and this keeps a wall alive where a material has very few photos —
 * Second High ochre-light currently ships just ONE, so without this every such
 * tile would be pixel-identical. It only moves lightness; it never moves the
 * light source or the relief, so the tile still reads exactly as photographed.
 */
export function toneJitterFor(seed: number, patternRow: number, patternCol: number): number {
  return cellRng(seed ^ 0x1b873593, patternRow, patternCol)() * 2 - 1;
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
