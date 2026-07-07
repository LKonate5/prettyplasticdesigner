import type { Cell, Layout, Material, Pt, ProductSpec } from '../core/types';
import { materialAt } from '../data/palette';

/**
 * 3D wall mesh — the shared geometry behind the OBJ and GLB exporters.
 *
 * Each visible tile becomes a solid prism: its footprint extruded from the
 * wall plane (z = 0) out to the product depth (z = depth, toward the viewer).
 * Prisms are grouped by material so each colour is one mesh part.
 *
 * Coordinates are millimetres in a Y-up, right-handed frame (the glTF/OBJ
 * convention): X = wall width, Y = wall height (flipped from the screen's
 * y-down), Z = depth toward the viewer.
 *
 * A small shrink toward each tile's centre opens a thin joint between tiles.
 * That both looks like real cladding and, crucially, stops touching tiles
 * (e.g. the exact First One tessellation) from sharing coincident side walls,
 * which would z-fight between differently-coloured neighbours.
 *
 * Faceted relief (Second High's facets, Basic Third's bands) is surface detail
 * shown in the 2D render/texture, not modelled in the mesh — the mesh carries
 * the true footprint, thickness and layout, which is what CAD/3D tools need.
 */

const JOINT_SHRINK = 0.985; // 1.5% toward centroid → visible joint, no coincident faces

type V3 = [number, number, number];

export interface MeshGroup {
  material: Material;
  positions: number[]; // flat xyz, 9 numbers per triangle (non-indexed, flat-shaded)
  normals: number[];
}

export interface WallMesh {
  groups: MeshGroup[];
  triangleCount: number;
  bbox: { min: V3; max: V3 };
}

export function buildWallMesh(
  product: ProductSpec,
  layout: Layout,
  cells: readonly Cell[],
): WallMesh {
  const depth = product.tile.d;
  const groups = new Map<number, MeshGroup>();
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;

  const grow = (p: V3) => {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  };

  for (const tile of layout.tiles) {
    const poly = tile.exportPolygon;
    if (poly.length < 3) continue;
    const matIndex = cells[tile.cellIndex]?.material ?? 0;
    let group = groups.get(matIndex);
    if (!group) {
      group = { material: materialAt(matIndex), positions: [], normals: [] };
      groups.set(matIndex, group);
    }

    // to 3D (y-up), shrunk toward the centroid to open a joint
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const to3d = (p: Pt, z: number): V3 => [
      cx + (p[0] - cx) * JOINT_SHRINK,
      layout.wallH - (cy + (p[1] - cy) * JOINT_SHRINK),
      z,
    ];
    const front = poly.map((p) => to3d(p, depth));
    const back = poly.map((p) => to3d(p, 0));
    const center: V3 = [
      front.reduce((s, p) => s + p[0], 0) / front.length,
      front.reduce((s, p) => s + p[1], 0) / front.length,
      depth / 2,
    ];

    const push = (a: V3, b: V3, c: V3) => {
      triangleCount += emitTri(group!, a, b, c, center);
      grow(a);
      grow(b);
      grow(c);
    };

    const n = poly.length;
    // front cap (z = depth) and back cap (z = 0), fan-triangulated (convex)
    for (let i = 1; i < n - 1; i++) {
      push(front[0], front[i], front[i + 1]);
      push(back[0], back[i], back[i + 1]);
    }
    // side walls
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      push(front[i], front[j], back[j]);
      push(front[i], back[j], back[i]);
    }
  }

  return {
    groups: [...groups.values()],
    triangleCount,
    bbox: { min, max },
  };
}

/** Emit one triangle with a flat normal oriented outward from `center`. */
function emitTri(group: MeshGroup, a: V3, b: V3, c: V3, center: V3): 1 {
  let n = normal(a, b, c);
  const mid: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  const outward = dot(n, sub(mid, center)) >= 0;
  const [p, q, r] = outward ? [a, b, c] : [a, c, b];
  if (!outward) n = neg(n);
  group.positions.push(...p, ...q, ...r);
  group.normals.push(...n, ...n, ...n);
  return 1;
}

function normal(a: V3, b: V3, c: V3): V3 {
  const u = sub(b, a);
  const v = sub(c, a);
  const cr: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(cr[0], cr[1], cr[2]) || 1;
  return [cr[0] / len, cr[1] / len, cr[2] / len];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
