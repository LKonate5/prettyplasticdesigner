import { computeLayout } from '../core/layout';
import { generatePattern } from '../core/pattern/generators';
import { DEFAULT_WASTE, WASTE_MAX, type DesignState } from '../core/state/reducer';
import type { Cell, MaterialId, PatternType, ProductId } from '../core/types';
import { isColourAllowedFor, materialAt, materialIndex, MATERIALS, MATERIAL_IDS } from '../data/palette';
import { PRODUCTS } from '../data/products';

/**
 * Encode a design into a compact URL-safe string (and back), so a design can
 * live in the page URL and be shared. We store the settings + only the
 * hand-painted cells that DIFFER from what the pattern would generate, so the
 * string stays small (a fresh auto-generated design carries no overrides).
 *
 * Rotation is only meaningful for Second High. Its override records carry a
 * third value when needed; two-value records from earlier links still decode
 * as an unrotated tile.
 */

type GradientDirection = 'horizontal' | 'vertical' | 'diagonal';

interface Packed {
  p: ProductId;
  r: number;
  c: number;
  e: number; // exposure
  b: 0 | 1; // bond: 0 stacked, 1 staggered
  t: PatternType;
  s: number; // seed
  tv: number; // toneVariation
  sm: number; // solidMaterial index
  am: number[]; // allowedMaterials indices
  gdir?: GradientDirection; // gradient direction, named for the bands it draws
  gd?: GradientDirection; // pre-flip gradient direction — decode only, see below
  sdir: 'horizontal' | 'vertical';
  sw: number; // stripe width
  w: number; // waste fraction
  o: Array<[number, number] | [number, number, 0 | 90 | 180 | 270]>;
}

const PRODUCT_IDS: ProductId[] = ['first-one', 'second-high', 'basic-third'];

const FLIPPED: Record<GradientDirection, GradientDirection> = {
  horizontal: 'vertical',
  vertical: 'horizontal',
  diagonal: 'diagonal',
};

/**
 * Links written before gradient Direction was named for its bands carry `gd`,
 * where the name meant the axis the colour travelled along instead — the exact
 * opposite for the two straight directions. Read those swapped rather than
 * letting them through: every quote Pretty Plastic has been sent carries a link
 * to "this exact design", and it has to still open the design that was priced,
 * not one turned ninety degrees.
 */
function gradientDirection(packed: Packed): GradientDirection {
  if (packed.gdir) return packed.gdir;
  return packed.gd ? FLIPPED[packed.gd] : 'horizontal';
}

function baselineCells(design: DesignState): Cell[] {
  const layout = computeLayout(
    PRODUCTS[design.productId],
    design.rows,
    design.cols,
    design.options,
  );
  return generatePattern(design.pattern, layout);
}

export function encodeDesign(design: DesignState): string {
  const base = baselineCells(design);
  const overrides: Packed['o'] = [];
  design.cells.forEach((cell, i) => {
    const b = base[i];
    if (!b || b.material !== cell.material || cell.rotation) {
      overrides.push(cell.rotation ? [i, cell.material, cell.rotation] : [i, cell.material]);
    }
  });
  const packed: Packed = {
    p: design.productId,
    r: design.rows,
    c: design.cols,
    e: design.options.exposure,
    b: design.options.bond === 'staggered' ? 1 : 0,
    t: design.pattern.type,
    s: design.pattern.seed,
    tv: design.pattern.toneVariation,
    sm: materialIndex(design.pattern.solidMaterial),
    am: design.pattern.allowedMaterials.map(materialIndex),
    gdir: design.pattern.gradient.direction,
    sdir: design.pattern.stripes.direction,
    sw: design.pattern.stripes.width,
    w: design.wastePct,
    o: overrides,
  };
  return toUrlSafe(btoa(unescape(encodeURIComponent(JSON.stringify(packed)))));
}

export function decodeDesign(str: string): DesignState | null {
  try {
    const packed: Packed = JSON.parse(decodeURIComponent(escape(atob(fromUrlSafe(str)))));
    if (!PRODUCT_IDS.includes(packed.p)) return null;
    const asMaterial = (i: number): MaterialId => materialAt(i).id;
    // A share link is untrusted input — it could carry material indices for a
    // colour locked to a different product (see COLOUR_PRODUCT_LOCK in
    // data/palette.ts, e.g. blue is First One only). Filter those out here,
    // the same way SET_PRODUCT sanitises them for the interactive path.
    const allowedForColour = (id: MaterialId): boolean => {
      const colour = MATERIALS.find((mat) => mat.id === id)?.colour;
      return !colour || isColourAllowedFor(colour, packed.p);
    };
    const solidMaterial = asMaterial(packed.sm);
    const design: DesignState = {
      productId: packed.p,
      rows: packed.r,
      cols: packed.c,
      options: { exposure: packed.e, bond: packed.b === 1 ? 'staggered' : 'stacked' },
      pattern: {
        type: packed.t,
        seed: packed.s >>> 0,
        allowedMaterials: (packed.am?.length ? packed.am : MATERIAL_IDS.map((_, i) => i))
          .map(asMaterial)
          .filter(allowedForColour),
        toneVariation: packed.tv,
        solidMaterial: allowedForColour(solidMaterial) ? solidMaterial : 'grey-medium',
        gradient: { direction: gradientDirection(packed) },
        stripes: { direction: packed.sdir, width: packed.sw },
      },
      cells: [],
      wastePct: typeof packed.w === 'number' ? Math.max(0, Math.min(WASTE_MAX, packed.w)) : DEFAULT_WASTE,
    };
    // Regenerate the baseline, then apply hand-painted material and T2 rotation
    // overrides. Rotation from old links is accepted too.
    design.cells = baselineCells(design);
    for (const [i, material, rotation] of packed.o ?? []) {
      if (!design.cells[i]) continue;
      if (!allowedForColour(materialAt(material).id)) continue;
      design.cells[i] = packed.p === 'second-high' && isRotation(rotation)
        ? { material, rotation }
        : { material };
    }
    return design;
  } catch {
    return null;
  }
}

function isRotation(value: unknown): value is 0 | 90 | 180 | 270 {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

const PUBLIC_DESIGNER_URL = 'https://prettyplasticdesigner.vercel.app/';

/** Build the full shareable URL for a design (public page + design in the hash). */
export function shareUrl(design: DesignState): string {
  const base =
    typeof location !== 'undefined'
      ? location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? PUBLIC_DESIGNER_URL
        : location.href.split('#')[0]
      : '';
  return `${base}#d=${encodeDesign(design)}`;
}

/** Read a design out of the current URL hash, if present. */
export function designFromHash(): DesignState | null {
  if (typeof location === 'undefined') return null;
  const m = location.hash.match(/[#&]d=([^&]+)/);
  return m ? decodeDesign(m[1]) : null;
}

const toUrlSafe = (s: string): string => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrlSafe = (s: string): string =>
  s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
