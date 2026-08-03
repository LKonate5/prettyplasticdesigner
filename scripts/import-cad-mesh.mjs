#!/usr/bin/env node
/**
 * Turn Pretty Plastic's 3D tile models into the relief mesh the app exports.
 *
 * Until now the GLB/OBJ exports extruded each tile's flat footprint into a box —
 * the wall had the right colours and the right thickness, but every tile was a
 * slab. These are the real tiles.
 *
 * Reads   autocad/**\/*.stl        (gitignored; the raw CAD, ~51 MB)
 * Writes  src/data/tileMeshes.ts   (a few KB — checked in, imported directly)
 *
 * Three things happen here:
 *
 * 1. ISOLATE. The Second High model is not just a tile: it also carries the
 *    mould/back-plate and four mounting clips as separate solids. We split the
 *    mesh into connected components and keep the one whose bounding box matches
 *    the published tile size.
 *
 * 2. ORIENT. Every model uses its own axes (First One is Z-up with Y out of the
 *    wall; Second High is X out of the wall and is modelled upside-down; Basic
 *    Third is Y-up with Z out of the wall). Each is mapped into ONE tile-local
 *    frame that matches the renderer: +x right, +y DOWN, +z out of the wall
 *    toward the viewer, origin at the tile's top-left-back corner.
 *
 *    Orientation is not guessable from the geometry alone — the tiles are hollow
 *    shells, so their front and back surfaces are congruent mirror images. The
 *    mappings below were confirmed against the tile photography. Changing one
 *    silently mirrors or inverts the relief, which is exactly the bug the photo
 *    orientation work existed to kill, so don't touch them without re-checking
 *    against images/ (scripts print a depth render with --debug).
 *
 * 3. DECIMATE. CAD tessellation is wildly redundant — Second High's tile is
 *    8,272 triangles, yet 23 flat planes cover 94% of its surface. We merge
 *    coplanar triangles back into polygons and re-triangulate, which is what
 *    makes instancing the relief across a 5,000-tile wall affordable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const debug = process.argv.includes('--debug');

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};

/**
 * How eagerly coplanar triangles merge. These are loose on purpose: the models
 * carry small fillets and draft angles that tessellate into hundreds of
 * near-parallel slivers, and at a tile drawn ~300 px wide those are invisible.
 * The FOLD lines — the relief the whole product is about — survive because they
 * are 20–70° breaks, an order of magnitude past this tolerance.
 */
const ANGLE_TOL = flag('angle', 0.12); // normal component quantum (≈7°)
const DIST_TOL = flag('dist', 2.0); // plane-offset quantum, mm

/**
 * Smallest face worth keeping, in mm². Coplanar merging alone is not enough:
 * the models carry fine moulded surface texture (Basic Third has ~12,000
 * micro-facets), which no amount of plane-merging collapses because the facets
 * genuinely aren't coplanar. At the size a tile is drawn — and next to a 30 mm
 * groove or a 33 mm fold — sub-centimetre bumps are noise, and instancing them
 * across thousands of tiles is what would blow the export up. The relief lives
 * in the big faces; this drops everything else.
 */
const MIN_FACE_AREA = flag('minArea', 400);

/** Published tile size (mm) — used to pick the tile out of a multi-solid model. */
const PRODUCTS = {
  'first-one': {
    stl: 'autocad/05 AutoCad/First One - 3D Model/20260701 First One.stl',
    size: [304, 400, 29], // w × h × depth
    // Z-up (the thin head-lap end is at max Z), face on +Y.
    map: (p, lo, hi) => [p[0] - lo[0], hi[2] - p[2], p[1] - lo[1]],
  },
  'second-high': {
    stl: 'autocad/Second High - 3D Model/20240112 Second High.stl',
    size: [294, 294, 67],
    // Face on +X. The tile is square and was modelled upside-down, so +Z runs
    // DOWN the wall and the width runs along -Y. Confirmed against the photos.
    map: (p, lo, hi) => [hi[1] - p[1], p[2] - lo[2], p[0] - lo[0]],
  },
  'basic-third': {
    stl: 'autocad/Basic Third - DWG - 3D Model/Basic Third - 3D Model/241121_Basic Third.stl',
    size: [329, 569, 30],
    // Y-up, face on +Z.
    map: (p, lo, hi) => [p[0] - lo[0], hi[1] - p[1], p[2] - lo[2]],
  },
};

// ---------------------------------------------------------------- STL

function parseStl(buf) {
  if (buf.subarray(0, 5).toString('ascii') === 'solid' && buf.includes(Buffer.from('facet normal'))) {
    const verts = [];
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    const txt = buf.toString('ascii');
    let m;
    while ((m = re.exec(txt))) verts.push([+m[1], +m[2], +m[3]]);
    const tris = [];
    for (let i = 0; i < verts.length; i += 3) tris.push([verts[i], verts[i + 1], verts[i + 2]]);
    return tris;
  }
  const n = buf.readUInt32LE(80);
  const tris = [];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12; // skip the (unreliable) stored normal
    const v = [];
    for (let k = 0; k < 3; k++) {
      const p = o + k * 12;
      v.push([buf.readFloatLE(p), buf.readFloatLE(p + 4), buf.readFloatLE(p + 8)]);
    }
    tris.push(v);
  }
  return tris;
}

const bounds = (tris) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let a = 0; a < 3; a++) {
    if (p[a] < lo[a]) lo[a] = p[a];
    if (p[a] > hi[a]) hi[a] = p[a];
  }
  return { lo, hi, size: [0, 1, 2].map((a) => hi[a] - lo[a]) };
};

/** Split into disjoint solids (the Second High file holds four of them). */
function components(tris) {
  const key = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
  const parent = new Map();
  const find = (a) => {
    while (parent.get(a) !== a) {
      parent.set(a, parent.get(parent.get(a)));
      a = parent.get(a);
    }
    return a;
  };
  const union = (a, b) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const t of tris) {
    const k = t.map(key);
    union(k[0], k[1]);
    union(k[1], k[2]);
  }
  const groups = new Map();
  for (const t of tris) {
    const root = find(key(t[0]));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(t);
  }
  return [...groups.values()];
}

/** The solid whose bounding box best matches the published tile size. */
function pickTile(tris, size) {
  const want = [...size].sort((a, b) => a - b);
  return components(tris)
    .map((c) => {
      const s = [...bounds(c).size].sort((a, b) => a - b);
      return { c, err: s.reduce((acc, v, i) => acc + Math.abs(v - want[i]), 0) };
    })
    .sort((a, b) => a.err - b.err)[0].c;
}

// ---------------------------------------------------------------- decimation

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
function normal(t) {
  const n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
  const L = len(n) || 1;
  return [n[0] / L, n[1] / L, n[2] / L];
}

/**
 * Merge coplanar triangles into polygons, then re-triangulate.
 *
 * Group by plane, walk the group's boundary edges (an edge shared by two
 * triangles of the SAME plane is interior and drops out) into closed loops, and
 * ear-clip each loop. A flat face tessellated into hundreds of slivers collapses
 * back to a handful of triangles, and the silhouette is preserved exactly
 * because only interior edges are ever removed.
 */
function decimate(tris, angleTol = ANGLE_TOL, distTol = DIST_TOL) {
  const planes = new Map();
  for (const t of tris) {
    const n = normal(t);
    if (!isFinite(n[0])) continue;
    const d = dot(n, t[0]);
    const key = `${Math.round(n[0] / angleTol)},${Math.round(n[1] / angleTol)},${Math.round(n[2] / angleTol)}|${Math.round(d / distTol)}`;
    if (!planes.has(key)) planes.set(key, { n, tris: [] });
    planes.get(key).tris.push(t);
  }

  const out = [];
  for (const { n, tris: group } of planes.values()) {
    // boundary = edges used an odd number of times within this plane
    const edges = new Map();
    const vkey = (p) => `${Math.round(p[0] * 1e3)},${Math.round(p[1] * 1e3)},${Math.round(p[2] * 1e3)}`;
    const pos = new Map();
    for (const t of group) {
      for (let i = 0; i < 3; i++) {
        const a = t[i];
        const b = t[(i + 1) % 3];
        const ka = vkey(a);
        const kb = vkey(b);
        pos.set(ka, a);
        pos.set(kb, b);
        const fwd = `${ka}>${kb}`;
        const rev = `${kb}>${ka}`;
        if (edges.has(rev)) edges.delete(rev);
        else edges.set(fwd, [ka, kb]);
      }
    }
    // chain directed boundary edges into loops
    const next = new Map();
    for (const [, [a, b]] of edges) {
      if (!next.has(a)) next.set(a, []);
      next.get(a).push(b);
    }
    const loops = [];
    const used = new Set();
    for (const [, [start]] of edges) {
      if (used.has(start)) continue;
      const loop = [];
      let cur = start;
      for (let guard = 0; guard < 10000; guard++) {
        const outs = next.get(cur);
        if (!outs || outs.length === 0) break;
        const nxt = outs.pop();
        used.add(cur);
        loop.push(cur);
        cur = nxt;
        if (cur === start) break;
      }
      if (loop.length >= 3) loops.push(loop.map((k) => pos.get(k)));
    }
    // keep only the OUTER loop of each plane (inner loops would be holes; the
    // tiles have none, and a stray sliver loop is safe to drop)
    const real = loops.filter((l) => polyArea(l, n) > 1); // ignore tessellation slivers
    if (real.length === 0) continue; // all surface texture — drop the group

    if (real.length > 1) {
      // Several boundary loops. They may be HOLES (Second High's front rim is
      // an annulus) or disjoint coplanar ISLANDS, and the two are not safely
      // distinguishable here — treating an island as a hole punches the face
      // through, and filling a hole slabs a flat plate over the relief. Both
      // are far worse than a few extra triangles, so keep the CAD's own
      // tessellation for this face and move on.
      out.push(...group);
      continue;
    }
    if (polyArea(real[0], n) < MIN_FACE_AREA) continue; // moulded surface texture
    out.push(...earClip(real[0], n));
  }
  return out;
}

/** Project a 3D point on plane `n` into the plane's dominant 2D axes. */
function planeAxes(n) {
  const ax =
    Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2])
      ? 0
      : Math.abs(n[1]) > Math.abs(n[2])
        ? 1
        : 2;
  const [u, v] = ax === 0 ? [1, 2] : ax === 1 ? [2, 0] : [0, 1];
  return { u, v, flip: n[ax] < 0 };
}

function polyArea(poly, n) {
  let s = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) {
    const c = cross(poly[i], poly[(i + 1) % poly.length]);
    s = [s[0] + c[0], s[1] + c[1], s[2] + c[2]];
  }
  return Math.abs(dot(s, n)) / 2;
}

function earClip(poly, n) {
  // project onto the plane's dominant axes so we can clip in 2D
  const { u, v, flip } = planeAxes(n);
  const pts = poly.map((p) => ({ p, x: p[u], y: flip ? -p[v] : p[v] }));
  const area2 = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let signed = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    signed += a.x * b.y - b.x * a.y;
  }
  if (signed < 0) pts.reverse();

  const idx = pts.map((_, i) => i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = pts[idx[(i + idx.length - 1) % idx.length]];
      const b = pts[idx[i]];
      const c = pts[idx[(i + 1) % idx.length]];
      if (area2(a, b, c) <= 0) continue; // reflex
      let inside = false;
      for (const j of idx) {
        const p = pts[j];
        if (p === a || p === b || p === c) continue;
        if (area2(a, b, p) >= 0 && area2(b, c, p) >= 0 && area2(c, a, p) >= 0) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      tris.push([a.p, b.p, c.p]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate remainder
  }
  if (idx.length === 3) tris.push([pts[idx[0]].p, pts[idx[1]].p, pts[idx[2]].p]);
  return tris;
}

// ---------------------------------------------------------------- emit

const round = (n) => Math.round(n * 100) / 100;
const meshes = {};

for (const [id, cfg] of Object.entries(PRODUCTS)) {
  let raw;
  try {
    raw = parseStl(readFileSync(join(ROOT, cfg.stl)));
  } catch {
    console.error(`  ${id}: ${cfg.stl} not found — skipped`);
    continue;
  }
  const tile = pickTile(raw, cfg.size);
  const { lo, hi } = bounds(tile);
  const local = tile.map((t) => t.map((p) => cfg.map(p, lo, hi)));
  const small = decimate(local);
  const b = bounds(small);

  // weld vertices and index the triangles
  const index = new Map();
  const positions = [];
  const indices = [];
  for (const t of small) {
    for (const p of t) {
      const k = `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)},${Math.round(p[2] * 100)}`;
      let i = index.get(k);
      if (i === undefined) {
        i = positions.length / 3;
        index.set(k, i);
        positions.push(round(p[0]), round(p[1]), round(p[2]));
      }
      indices.push(i);
    }
  }
  meshes[id] = {
    size: b.size.map(round),
    positions,
    indices,
    from: tile.length,
  };
  console.log(
    `  ${id.padEnd(12)} ${String(tile.length).padStart(5)} → ${String(small.length).padStart(4)} tris` +
      `  (${positions.length / 3} verts)  bbox ${b.size.map(round).join(' × ')}`,
  );
  if (debug) writeDepthPgm(id, small, b);
}

// Shipped as a fetched ASSET, not a bundled module: it's ~800 KB, and only the
// 3D exporters ever want it. Bundling it would put it in every visitor's initial
// download for a feature most of them never touch.
const json = JSON.stringify(
  Object.fromEntries(
    Object.entries(meshes).map(([id, m]) => [
      id,
      { size: m.size, positions: m.positions, indices: m.indices },
    ]),
  ),
);
writeFileSync(join(ROOT, 'public/cad/tile-meshes.json'), json);
console.log(`\nWrote public/cad/tile-meshes.json (${(json.length / 1024).toFixed(1)} KB)`);

// A quick greyscale of the decimated front face, to eyeball against images/.
function writeDepthPgm(id, tris, b) {
  const N = 300;
  const d = new Float32Array(N * N).fill(-Infinity);
  for (const t of tris) {
    const pts = t.map((p) => [(p[0] / b.size[0]) * (N - 1), (p[1] / b.size[1]) * (N - 1), p[2]]);
    const [a, bb, c] = pts;
    const den = (bb[1] - c[1]) * (a[0] - c[0]) + (c[0] - bb[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-9) continue;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(N - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(N - 1, Math.ceil(Math.max(...xs))); x++) {
        const w0 = ((bb[1] - c[1]) * (x - c[0]) + (c[0] - bb[0]) * (y - c[1])) / den;
        const w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
        const z = w0 * a[2] + w1 * bb[2] + w2 * c[2];
        if (z > d[y * N + x]) d[y * N + x] = z;
      }
    }
  }
  const img = Buffer.alloc(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const z = d[i];
    if (!isFinite(z)) { img[i] = 20; continue; }
    const zr = isFinite(d[y * N + Math.min(N - 1, x + 1)]) ? d[y * N + Math.min(N - 1, x + 1)] : z;
    const zd = isFinite(d[Math.min(N - 1, y + 1) * N + x]) ? d[Math.min(N - 1, y + 1) * N + x] : z;
    const nx = -(zr - z);
    const ny = -(zd - z);
    const L = Math.hypot(nx, ny, 1);
    const lit = (nx * -0.55 + ny * -0.55 + 0.63) / L;
    img[i] = Math.max(0, Math.min(255, 45 + lit * 205));
  }
  writeFileSync(`/tmp/mesh-${id}.pgm`, Buffer.concat([Buffer.from(`P5\n${N} ${N}\n255\n`, 'ascii'), img]));
  console.log(`     debug: /tmp/mesh-${id}.pgm`);
}
