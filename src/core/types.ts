/**
 * Core shared types. Everything geometric is in real-world millimetres,
 * y-down, with the wall's top-left corner at (0, 0).
 */

export type ColourId = 'ochre' | 'terracotta' | 'green' | 'grey';
export type ShadeId = 'light' | 'medium' | 'dark';
export type MaterialId = `${ColourId}-${ShadeId}`; // exactly 12 combinations

export interface Material {
  id: MaterialId;
  colour: ColourId;
  shade: ShadeId;
  name: string; // display name, e.g. "Ochre Light"
  hex: string; // placeholder fill until real texture PNGs are supplied
  dxfLayer: string; // e.g. "PP_OCHRE_LIGHT"
  aci: number; // nearest AutoCAD Color Index (display approximation; DXF also carries true colour)
}

export type ProductId = 'first-one' | 'second-high' | 'basic-third';

export interface ProductSpec {
  id: ProductId;
  name: string;
  /** Physical tile size in mm (w × h × depth). */
  tile: { w: number; h: number; d: number };
  weightKg: number;
  /** Published coverage figure — display only; layout math derives its own exact pitches. */
  nominalTilesPerM2: number;
  /** Square metres of tile per (euro)pallet — the unit Pretty Plastic ships in. */
  palletM2: number;
  supportsRotation: boolean; // second-high only
  hasExposure: boolean; // basic-third only
  hasBond: boolean; // basic-third only
  maxTiles: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface ProductOptions {
  /** Visible course height in mm for Basic Third (300–500). Ignored by other products. */
  exposure: number;
  /** Basic Third bond. Ignored by other products. */
  bond: 'stacked' | 'staggered';
}

export type Pt = readonly [number, number];

/**
 * One placed tile. `polygon` is the drawn outline (physical laps are handled
 * by z-order, so lapped products draw full shapes that get partially covered).
 * `exportPolygon` is the VISIBLE, wall-clipped footprint — what DXF, the 3D
 * extrusion and area math use.
 */
export interface Tile {
  cellIndex: number; // index into the design's cells array
  row: number; // bottom-up row index (0 = bottom row)
  col: number;
  /**
   * Canonical wrapped lattice position. Wrap partners — a half-tile at one
   * edge and its match at the opposite edge — share the same (patternRow,
   * patternCol), hence the same cellIndex, hence the same colour. This is what
   * makes the wall a seamless repeating unit under both auto-generation and
   * hand-painting.
   */
  patternRow: number;
  patternCol: number;
  polygon: Pt[];
  clipped: Pt[] | null; // polygon ∩ wall rect, only when it differs from polygon
  exportPolygon: Pt[];
  zIndex: number; // draw order; ascending = bottom rows first, so higher rows overlap
  cut: boolean; // true when the tile is cut at a wall edge
  shadowStrips: Pt[][]; // translucent lap-shadow quads drawn over the tile fill
}

export interface Layout {
  productId: ProductId;
  wallW: number; // mm
  wallH: number; // mm
  rows: number; // as requested by the user
  cols: number;
  tiles: Tile[]; // sorted ascending zIndex = safe draw order
  /** Distinct logical tiles = patternRows × patternCols (wrap partners collapse to one). */
  cellCount: number;
  patternRows: number;
  patternCols: number;
  /**
   * Size of one seamless repeat (= wall size, since the wall now tiles by
   * construction), or null when the settings can't tile cleanly (odd row count
   * on an offset product). The seamless texture export renders the wall and
   * crops to this period.
   */
  torusPeriod: { w: number; h: number } | null;
}

export type PatternType = 'solid' | 'random' | 'gradient' | 'stripes' | 'checker';

export interface PatternConfig {
  type: PatternType;
  seed: number; // uint32; re-roll = new random seed, same seed = same design
  allowedMaterials: MaterialId[]; // palette restriction (min 1)
  /**
   * 0..1. For solid/random/stripes/checker: probability a cell's shade steps
   * ±1 within its colour. For gradient: strength of the dither at band edges.
   */
  toneVariation: number;
  solidMaterial: MaterialId;
  gradient: { direction: 'horizontal' | 'vertical' | 'diagonal' };
  stripes: { direction: 'horizontal' | 'vertical'; width: number }; // width in cells
  randomRotation: boolean; // second-high only
}

export interface Cell {
  material: number; // index into MATERIALS (small numbers keep undo snapshots cheap)
  rotation: Rotation; // always 0 except second-high
}
