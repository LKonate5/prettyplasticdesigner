import type { ProductId } from '../core/types';
import { downloadBlob } from './download';

/**
 * Pretty Plastic's own CAD documentation, offered as a per-product download.
 *
 * Everything else in this folder GENERATES a file from the user's design. This
 * one ships the manufacturer's real drawings untouched: the DWG details, the
 * dimension sheets (DWG + PDF) and the 3D models (SKP / STL / IFC). An architect
 * detailing a facade needs the actual tile — the window-head detail, the corner
 * detail, the true relief — not a wall we extruded from flat polygons.
 *
 * scripts/import-cad.sh builds the packs from the raw autocad/ folder (which
 * stays local and gitignored, like images/) into:
 *     public/cad/{productId}.zip
 *     public/cad/manifest.json = { productId: { bytes, files } }
 * Products with no pack in the manifest simply don't show the option.
 */

export interface CadPack {
  bytes: number;
  files: number;
}

export type CadManifest = ReadonlyMap<ProductId, CadPack>;

export async function loadCadManifest(): Promise<CadManifest> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}cad/manifest.json`);
    if (!res.ok) return new Map();
    const raw: Record<string, CadPack> = await res.json();
    const map = new Map<ProductId, CadPack>();
    for (const [id, pack] of Object.entries(raw)) {
      if (pack && Number.isFinite(pack.bytes) && pack.bytes > 0) map.set(id as ProductId, pack);
    }
    return map;
  } catch {
    return new Map(); // no packs → the CAD option just isn't offered
  }
}

/** Fetch the pack rather than linking to it, so the download shares the export flow. */
export async function downloadCadPack(productId: ProductId, filename: string): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}cad/${productId}.zip`);
  if (!res.ok) throw new Error(`CAD pack unavailable (${res.status})`);
  downloadBlob(await res.blob(), filename);
}

export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
