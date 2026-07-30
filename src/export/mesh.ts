import { SH_FACET } from '../core/layout/secondHigh';
import type { Cell, Layout, Material, Pt, ProductSpec } from '../core/types';
import { materialAt } from '../data/palette';

/**
 * 3D wall mesh shared by the OBJ and GLB exporters. Coordinates are
 * millimetres in a Y-up, right-handed frame: X = wall width, Y = wall height,
 * Z = depth toward the viewer. Product relief is real geometry, not a texture:
 * Second High has a raised faceted apex and Basic Third gets three raised slats.
 */

const JOINT_SHRINK = 0.985;
const SECOND_HIGH_RELIEF = 12;
const BASIC_THIRD_RELIEF = 3;
const FIRST_ONE_LAYER_OFFSET = 2;

type V3 = [number, number, number];

export interface MeshGroup {
  material: Material;
  positions: number[];
  normals: number[];
}

export interface WallMesh {
  groups: MeshGroup[];
  triangleCount: number;
  bbox: { min: V3; max: V3 };
}

export function buildWallMesh(product: ProductSpec, layout: Layout, cells: readonly Cell[]): WallMesh {
  const groups = new Map<number, MeshGroup>();
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;

  const grow = (p: V3) => {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
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

    const cx = poly.reduce((sum, p) => sum + p[0], 0) / poly.length;
    const cy = poly.reduce((sum, p) => sum + p[1], 0) / poly.length;
    const layerOffset = product.id === 'first-one' ? (tile.row % 2) * FIRST_ONE_LAYER_OFFSET : 0;
    const outerDepth = product.tile.d + layerOffset;
    const frontDepth = product.id === 'second-high'
      ? outerDepth - SECOND_HIGH_RELIEF
      : product.id === 'basic-third'
        ? outerDepth - BASIC_THIRD_RELIEF
        : outerDepth;
    const to3d = (p: Pt, z: number): V3 => [
      cx + (p[0] - cx) * JOINT_SHRINK,
      layout.wallH - (cy + (p[1] - cy) * JOINT_SHRINK),
      z,
    ];
    const front = poly.map((p) => to3d(p, frontDepth));
    const back = poly.map((p) => to3d(p, layerOffset));
    const center: V3 = [
      front.reduce((sum, p) => sum + p[0], 0) / front.length,
      front.reduce((sum, p) => sum + p[1], 0) / front.length,
      (frontDepth + layerOffset) / 2,
    ];
    const push = (a: V3, b: V3, c: V3) => {
      triangleCount += emitTri(group!, a, b, c, center);
      grow(a);
      grow(b);
      grow(c);
    };

    if (product.id === 'second-high') {
      const [x, y] = tile.polygon[0];
      const rotation = cells[tile.cellIndex]?.rotation ?? 0;
      const apex = to3d(rotatePoint([x + SH_FACET.ax, y + SH_FACET.ay], x, y, rotation), outerDepth);
      for (let i = 0; i < front.length; i++) push(front[i], front[(i + 1) % front.length], apex);
    } else {
      for (let i = 1; i < front.length - 1; i++) push(front[0], front[i], front[i + 1]);
    }

    // Back cap and outside walls form the actual tile thickness.
    for (let i = 1; i < back.length - 1; i++) push(back[0], back[i], back[i + 1]);
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      push(front[i], front[j], back[j]);
      push(front[i], back[j], back[i]);
    }

    if (product.id === 'basic-third') {
      const x0 = Math.min(...poly.map(([x]) => x));
      const x1 = Math.max(...poly.map(([x]) => x));
      const y0 = Math.min(...poly.map(([, y]) => y));
      const y1 = Math.max(...poly.map(([, y]) => y));
      const width = x1 - x0;
      const bandHalf = Math.min(8, width / 12);
      for (let band = 0; band < 3; band++) {
        const bx = x0 + ((band + 0.5) * width) / 3;
        const low: Pt[] = [[bx - bandHalf, y0], [bx + bandHalf, y0], [bx + bandHalf, y1], [bx - bandHalf, y1]];
        const base = low.map((p) => to3d(p, frontDepth));
        const top = low.map((p) => to3d(p, outerDepth));
        push(top[0], top[1], top[2]);
        push(top[0], top[2], top[3]);
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          push(top[i], top[j], base[j]);
          push(top[i], base[j], base[i]);
        }
      }
    }
  }

  return { groups: [...groups.values()], triangleCount, bbox: { min, max } };
}

function rotatePoint(point: Pt, x: number, y: number, rotation: number): Pt {
  if (!rotation) return point;
  const cx = x + SH_FACET.size / 2;
  const cy = y + SH_FACET.size / 2;
  const rad = (rotation * Math.PI) / 180;
  return [
    cx + (point[0] - cx) * Math.cos(rad) - (point[1] - cy) * Math.sin(rad),
    cy + (point[0] - cx) * Math.sin(rad) + (point[1] - cy) * Math.cos(rad),
  ];
}

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
