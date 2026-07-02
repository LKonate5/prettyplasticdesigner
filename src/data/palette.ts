import type { ColourId, Material, MaterialId, ShadeId } from '../core/types';

/**
 * The single shared palette: 4 colours × 3 shades = 12 materials, identical
 * for all three products (confirmed on prettyplastic.nl/products).
 *
 * hex values are placeholders until the real tile texture PNGs arrive.
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
  m('ochre', 'light', '#D9B36C', 41),
  m('ochre', 'medium', '#C1913F', 40),
  m('ochre', 'dark', '#9C6F23', 44),
  m('terracotta', 'light', '#C97B5A', 31),
  m('terracotta', 'medium', '#A85438', 30),
  m('terracotta', 'dark', '#7E3B26', 34),
  m('green', 'light', '#8FA48B', 81),
  m('green', 'medium', '#64805F', 84),
  m('green', 'dark', '#42573F', 86),
  m('grey', 'light', '#B9BCBB', 254),
  m('grey', 'medium', '#8B8F8E', 8),
  m('grey', 'dark', '#565A59', 250),
];

export const MATERIAL_IDS: readonly MaterialId[] = MATERIALS.map((mat) => mat.id);

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
