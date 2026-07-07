import type { Cell, Layout, ProductSpec } from '../core/types';

/**
 * PHASE 2 — 3D export (OBJ / glTF).
 *
 * The layout engine already gives us everything a 3D exporter needs: each
 * tile's visible polygon in mm and the product depth. Extruding those
 * polygons by the depth (First One 29 mm, Second High 67 mm, Basic Third
 * 30 mm) yields a watertight wall mesh that opens in SketchUp, Blender, etc.
 *
 * This is intentionally a stub with the shape of the real function so phase 2
 * is a drop-in: fill in the triangulation + writer, wire two entries into
 * ExportMenu, done. Native .skp/.rvt stay out of scope (not writable in a
 * browser) — the DXF and this OBJ/GLB are the interchange path into them.
 */

export interface ExtrudedMesh {
  positions: number[]; // xyz triples, mm
  indices: number[]; // triangle indices
  materialRanges: Array<{ material: number; start: number; count: number }>;
}

export function buildExtrusion(
  _product: ProductSpec,
  _layout: Layout,
  _cells: readonly Cell[],
): ExtrudedMesh {
  throw new Error('3D export (OBJ/glTF) is planned for phase 2.');
}
