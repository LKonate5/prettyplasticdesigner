import type { WallMesh } from './mesh';

/**
 * Binary glTF 2.0 (.glb) writer — a single self-contained file with geometry,
 * flat normals and per-material colours baked in. Opens in SketchUp (2021+),
 * Blender, Windows 3D Viewer, three.js and most online glTF viewers.
 *
 * glTF is Y-up / +Z-toward-viewer, matching the mesh frame, so the wall imports
 * upright and facing you. Millimetre units (glTF is unitless; 1 unit = 1 mm by
 * our convention, which importers treat as mm when set to a mm workspace).
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_TYPE = 0x4e4f534a; // "JSON"
const BIN_TYPE = 0x004e4942; // "BIN\0"
const FLOAT = 5126;
const ARRAY_BUFFER = 34962;
const TRIANGLES = 4;

export function buildGlb(mesh: WallMesh): ArrayBuffer {
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const materials: object[] = [];
  const primitives: object[] = [];
  const blocks: Float32Array[] = [];
  let byteOffset = 0;

  const addBlock = (arr: number[]): number => {
    const f32 = new Float32Array(arr);
    const view = { buffer: 0, byteOffset, byteLength: f32.byteLength, target: ARRAY_BUFFER };
    bufferViews.push(view);
    blocks.push(f32);
    byteOffset += f32.byteLength;
    return bufferViews.length - 1;
  };

  for (const group of mesh.groups) {
    if (group.positions.length === 0) continue;

    const posView = addBlock(group.positions);
    const posAccessor = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: FLOAT,
      count: group.positions.length / 3,
      type: 'VEC3',
      min: axisMin(group.positions),
      max: axisMax(group.positions),
    });

    const normView = addBlock(group.normals);
    const normAccessor = accessors.length;
    accessors.push({
      bufferView: normView,
      componentType: FLOAT,
      count: group.normals.length / 3,
      type: 'VEC3',
    });

    const [r, g, b] = rgb01(group.material.hex);
    materials.push({
      name: group.material.name,
      pbrMetallicRoughness: {
        baseColorFactor: [r, g, b, 1],
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
      doubleSided: true,
    });

    primitives.push({
      attributes: { POSITION: posAccessor, NORMAL: normAccessor },
      material: materials.length - 1,
      mode: TRIANGLES,
    });
  }

  const gltf = {
    asset: { version: '2.0', generator: 'Pretty Plastic Facade Designer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'PrettyPlasticWall', mesh: 0 }],
    meshes: [{ name: 'PrettyPlasticWall', primitives }],
    accessors,
    bufferViews,
    materials,
    buffers: [{ byteLength: byteOffset }],
  };

  return assembleGlb(gltf, blocks, byteOffset);
}

function assembleGlb(gltf: object, blocks: Float32Array[], binLength: number): ArrayBuffer {
  const enc = new TextEncoder();
  let json = enc.encode(JSON.stringify(gltf));
  json = pad(json, 0x20); // JSON chunk padded with spaces

  const total = 12 + 8 + json.byteLength + 8 + binLength;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const bytes = new Uint8Array(out);
  let o = 0;

  // header
  dv.setUint32(o, GLB_MAGIC, true); o += 4;
  dv.setUint32(o, 2, true); o += 4;
  dv.setUint32(o, total, true); o += 4;

  // JSON chunk
  dv.setUint32(o, json.byteLength, true); o += 4;
  dv.setUint32(o, JSON_TYPE, true); o += 4;
  bytes.set(json, o); o += json.byteLength;

  // BIN chunk (blocks are all float → already 4-byte aligned)
  dv.setUint32(o, binLength, true); o += 4;
  dv.setUint32(o, BIN_TYPE, true); o += 4;
  for (const block of blocks) {
    bytes.set(new Uint8Array(block.buffer, block.byteOffset, block.byteLength), o);
    o += block.byteLength;
  }

  return out;
}

function pad(arr: Uint8Array, fill: number): Uint8Array {
  const rem = arr.byteLength % 4;
  if (rem === 0) return arr;
  const padded = new Uint8Array(arr.byteLength + (4 - rem));
  padded.set(arr);
  padded.fill(fill, arr.byteLength);
  return padded;
}

function axisMin(pos: number[]): [number, number, number] {
  const m: [number, number, number] = [Infinity, Infinity, Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    m[0] = Math.min(m[0], pos[i]);
    m[1] = Math.min(m[1], pos[i + 1]);
    m[2] = Math.min(m[2], pos[i + 2]);
  }
  return m;
}

function axisMax(pos: number[]): [number, number, number] {
  const m: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    m[0] = Math.max(m[0], pos[i]);
    m[1] = Math.max(m[1], pos[i + 1]);
    m[2] = Math.max(m[2], pos[i + 2]);
  }
  return m;
}

function rgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
