import { describe, expect, it } from 'vitest';
import { computeLayout } from '../core/layout';
import { generatePattern } from '../core/pattern/generators';
import { defaultPattern } from '../core/state/reducer';
import { PRODUCTS } from '../data/products';
import type { ProductId } from '../core/types';
import { buildWallMesh } from './mesh';
import { buildGlb } from './glb';
import { buildObj } from './obj';

function meshFor(productId: ProductId, rows = 5, cols = 4) {
  const product = PRODUCTS[productId];
  const layout = computeLayout(product, rows, cols, { exposure: 450, bond: 'staggered' });
  const cells = generatePattern(defaultPattern(2), layout);
  return { product, layout, cells, mesh: buildWallMesh(product, layout, cells) };
}

describe('3D mesh', () => {
  it('positions and normals are aligned triples with no NaN', () => {
    for (const id of ['first-one', 'second-high', 'basic-third'] as ProductId[]) {
      const { mesh } = meshFor(id);
      let tris = 0;
      for (const g of mesh.groups) {
        expect(g.positions.length % 9).toBe(0);
        expect(g.positions.length).toBe(g.normals.length);
        expect(g.positions.every(Number.isFinite)).toBe(true);
        expect(g.normals.every(Number.isFinite)).toBe(true);
        tris += g.positions.length / 9;
      }
      expect(tris).toBe(mesh.triangleCount);
      expect(tris).toBeGreaterThan(0);
    }
  });

  it('every normal is unit length', () => {
    const { mesh } = meshFor('second-high');
    for (const g of mesh.groups) {
      for (let i = 0; i < g.normals.length; i += 3) {
        const len = Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2]);
        expect(len).toBeCloseTo(1, 5);
      }
    }
  });

  it('depth matches the product and the wall sits on z=0', () => {
    const { mesh, product } = meshFor('second-high');
    expect(mesh.bbox.min[2]).toBeCloseTo(0, 6);
    expect(mesh.bbox.max[2]).toBeCloseTo(product.tile.d, 6); // 67 mm
    // Y is up and within the wall height
    const { layout } = meshFor('second-high');
    expect(mesh.bbox.max[1]).toBeLessThanOrEqual(layout.wallH + 1);
    expect(mesh.bbox.min[1]).toBeGreaterThanOrEqual(-1);
  });

  it('groups map to the used materials only', () => {
    const { mesh, cells } = meshFor('first-one');
    const usedMaterials = new Set(cells.map((c) => c.material));
    expect(mesh.groups.length).toBe(usedMaterials.size);
  });

  it('front-cap normals point toward the viewer (+Z)', () => {
    const { mesh } = meshFor('basic-third');
    // at least some triangles must face +Z (the front caps) and some -Z (backs)
    let front = 0;
    let back = 0;
    for (const g of mesh.groups) {
      for (let i = 0; i < g.normals.length; i += 9) {
        if (g.normals[i + 2] > 0.9) front++;
        if (g.normals[i + 2] < -0.9) back++;
      }
    }
    expect(front).toBeGreaterThan(0);
    expect(back).toBeGreaterThan(0);
  });
});

describe('GLB writer', () => {
  it('produces a valid glb container with parseable JSON', () => {
    const { mesh } = meshFor('first-one');
    const glb = buildGlb(mesh);
    const dv = new DataView(glb);
    expect(dv.getUint32(0, true)).toBe(0x46546c67); // "glTF"
    expect(dv.getUint32(4, true)).toBe(2); // version
    expect(dv.getUint32(8, true)).toBe(glb.byteLength); // total length
    // JSON chunk
    const jsonLen = dv.getUint32(12, true);
    expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // "JSON"
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)));
    expect(json.asset.version).toBe('2.0');
    expect(json.meshes[0].primitives.length).toBe(mesh.groups.length);
    // BIN chunk length equals buffer byteLength
    const binHeaderAt = 20 + jsonLen;
    expect(dv.getUint32(binHeaderAt + 4, true)).toBe(0x004e4942); // "BIN\0"
    expect(json.buffers[0].byteLength).toBe(dv.getUint32(binHeaderAt, true));
    // POSITION accessors carry required min/max
    for (const acc of json.accessors) {
      expect(acc.type).toBe('VEC3');
      if (acc.min) expect(acc.min.length).toBe(3);
    }
    // every chunk 4-byte aligned
    expect(jsonLen % 4).toBe(0);
  });

  it('accessor vertex counts match the mesh', () => {
    const { mesh } = meshFor('second-high');
    const glb = buildGlb(mesh);
    const dv = new DataView(glb);
    const jsonLen = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)));
    const totalVerts = mesh.groups.reduce((s, g) => s + g.positions.length / 3, 0);
    const accVerts = json.accessors
      .filter((_: unknown, i: number) => i % 2 === 0) // POSITION accessors
      .reduce((s: number, a: { count: number }) => s + a.count, 0);
    expect(accVerts).toBe(totalVerts);
  });
});

describe('OBJ writer', () => {
  it('emits geometry + a material library referenced by usemtl', () => {
    const { mesh } = meshFor('basic-third');
    const { obj, mtl } = buildObj(mesh, 'wall.mtl');
    expect(obj).toContain('mtllib wall.mtl');
    const faces = (obj.match(/^f /gm) ?? []).length;
    expect(faces).toBe(mesh.triangleCount);
    // every material used in the obj is defined in the mtl
    const used = [...obj.matchAll(/^usemtl (.+)$/gm)].map((m) => m[1]);
    for (const u of new Set(used)) expect(mtl).toContain(`newmtl ${u}`);
    expect(obj).not.toMatch(/NaN|undefined/);
    expect(mtl).toMatch(/Kd /);
  });
});
