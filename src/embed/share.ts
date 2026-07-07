import { computeLayout } from '../core/layout';
import { generatePattern } from '../core/pattern/generators';
import type { DesignState } from '../core/state/reducer';
import type { Cell, MaterialId, PatternType, ProductId, Rotation } from '../core/types';
import { materialAt, materialIndex, MATERIAL_IDS } from '../data/palette';
import { PRODUCTS } from '../data/products';

/**
 * Encode a design into a compact URL-safe string (and back), so a design can
 * live in the page URL and be shared. We store the settings + only the
 * hand-painted cells that DIFFER from what the pattern would generate, so the
 * string stays small (a fresh auto-generated design carries no overrides).
 */

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
  gd: 'horizontal' | 'vertical' | 'diagonal';
  sdir: 'horizontal' | 'vertical';
  sw: number; // stripe width
  rr: 0 | 1; // randomRotation
  o: [number, number, number][]; // overrides: [cellIndex, material, rotation]
}

const PRODUCT_IDS: ProductId[] = ['first-one', 'second-high', 'basic-third'];

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
  const overrides: [number, number, number][] = [];
  design.cells.forEach((cell, i) => {
    const b = base[i];
    if (!b || b.material !== cell.material || b.rotation !== cell.rotation) {
      overrides.push([i, cell.material, cell.rotation]);
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
    gd: design.pattern.gradient.direction,
    sdir: design.pattern.stripes.direction,
    sw: design.pattern.stripes.width,
    rr: design.pattern.randomRotation ? 1 : 0,
    o: overrides,
  };
  return toUrlSafe(btoa(unescape(encodeURIComponent(JSON.stringify(packed)))));
}

export function decodeDesign(str: string): DesignState | null {
  try {
    const packed: Packed = JSON.parse(decodeURIComponent(escape(atob(fromUrlSafe(str)))));
    if (!PRODUCT_IDS.includes(packed.p)) return null;
    const asMaterial = (i: number): MaterialId => materialAt(i).id;
    const design: DesignState = {
      productId: packed.p,
      rows: packed.r,
      cols: packed.c,
      options: { exposure: packed.e, bond: packed.b === 1 ? 'staggered' : 'stacked' },
      pattern: {
        type: packed.t,
        seed: packed.s >>> 0,
        allowedMaterials: (packed.am?.length ? packed.am : MATERIAL_IDS.map((_, i) => i)).map(
          asMaterial,
        ),
        toneVariation: packed.tv,
        solidMaterial: asMaterial(packed.sm),
        gradient: { direction: packed.gd },
        stripes: { direction: packed.sdir, width: packed.sw },
        randomRotation: packed.rr === 1,
      },
      cells: [],
    };
    // regenerate the baseline, then apply the hand-painted overrides
    design.cells = baselineCells(design);
    for (const [i, material, rotation] of packed.o ?? []) {
      if (design.cells[i]) design.cells[i] = { material, rotation: rotation as Rotation };
    }
    return design;
  } catch {
    return null;
  }
}

/** Build the full shareable URL for a design (current page + design in the hash). */
export function shareUrl(design: DesignState): string {
  const base = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
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
