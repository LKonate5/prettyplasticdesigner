import type { ColourId, Material, MaterialId, ProductId, ShadeId } from '../core/types';

/**
 * The shared palette: 5 colours × 3 shades = 15 materials. Blue is currently
 * First One only (no photography yet for the other two products) — see
 * COLOUR_PRODUCT_LOCK below, which every product-aware caller must go
 * through instead of MATERIALS/MATERIAL_IDS directly.
 *
 * hex values are sampled from the real tile texture photos.
 * To use real textures, drop PNGs at:
 *   public/textures/{productId}/{colour}-{shade}.png   e.g. textures/first-one/ochre-light.png
 * — no code changes needed; the app probes for them at startup.
 *
 * aci = nearest AutoCAD Color Index, a display approximation for old CAD
 * viewers. The DXF export also writes the exact hex as a true-colour value,
 * which modern viewers prefer.
 */

function m(colour: ColourId, shade: ShadeId, hex: string, aci: number): Material {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    id: `${colour}-${shade}`,
    colour,
    shade,
    name: `${cap(colour)} ${cap(shade)}`,
    hex,
    dxfLayer: `PP_${colour.toUpperCase()}_${shade.toUpperCase()}`,
    aci,
  };
}

export const MATERIALS: readonly Material[] = [
  m('ochre', 'light', '#98896E', 41),
  m('ochre', 'medium', '#A38A62', 40),
  m('ochre', 'dark', '#B18754', 44),
  m('terracotta', 'light', '#948079', 31),
  m('terracotta', 'medium', '#9C6F65', 30),
  m('terracotta', 'dark', '#995F53', 34),
  m('green', 'light', '#8B8975', 81),
  m('green', 'medium', '#7B7D5B', 84),
  m('green', 'dark', '#6E744E', 86),
  m('grey', 'light', '#928E89', 254),
  m('grey', 'medium', '#575757', 8),
  m('grey', 'dark', '#38383C', 250),
  // Blue: new colour, First One only (see COLOUR_PRODUCT_LOCK) — appended
  // rather than inserted so existing share links' material indices (0–11)
  // stay stable.
  m('blue', 'light', '#72869E', 150),
  m('blue', 'medium', '#5485B1', 160),
  m('blue', 'dark', '#3A5B79', 170),
];

export const MATERIAL_IDS: readonly MaterialId[] = MATERIALS.map((mat) => mat.id);

/**
 * Colours restricted to one product because only that product has real
 * photography for them yet (e.g. blue → First One, added 2026-08-27). Every
 * product-aware caller (palette UI, brush, pattern generation defaults, share
 * links) must go through the helpers below rather than MATERIALS/MATERIAL_IDS
 * directly. Remove an entry here once that colour's photos land elsewhere.
 */
const COLOUR_PRODUCT_LOCK: Partial<Record<ColourId, ProductId>> = {
  blue: 'first-one',
};

export function isColourAllowedFor(colour: ColourId, productId: ProductId): boolean {
  const lock = COLOUR_PRODUCT_LOCK[colour];
  return !lock || lock === productId;
}

export function materialsFor(productId: ProductId): readonly Material[] {
  return MATERIALS.filter((mat) => isColourAllowedFor(mat.colour, productId));
}

export function materialIdsFor(productId: ProductId): readonly MaterialId[] {
  return materialsFor(productId).map((mat) => mat.id);
}

const INDEX_BY_ID = new Map<MaterialId, number>(MATERIALS.map((mat, i) => [mat.id, i]));

export function materialIndex(id: MaterialId): number {
  return INDEX_BY_ID.get(id) ?? 0;
}

export function materialAt(index: number): Material {
  return MATERIALS[index] ?? MATERIALS[0];
}

/** Step a material's shade by ±1 within its colour; returns null when out of range. */
export function stepShade(id: MaterialId, dir: 1 | -1): MaterialId | null {
  const order: ShadeId[] = ['light', 'medium', 'dark'];
  const mat = MATERIALS[materialIndex(id)];
  const next = order[order.indexOf(mat.shade) + dir];
  return next ? (`${mat.colour}-${next}` as MaterialId) : null;
}
