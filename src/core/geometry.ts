import type { Pt } from './types';

/**
 * Sutherland–Hodgman clip of a polygon against an axis-aligned rectangle.
 * Returns [] when nothing remains. Shared by the layout engine, renderer and
 * exporters so screen and files always agree on edge-tile shapes.
 */
export function clipPolygonToRect(
  poly: Pt[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Pt[] {
  const edges: Array<{ inside: (p: Pt) => boolean; cross: (a: Pt, b: Pt) => Pt }> = [
    { inside: (p) => p[0] >= x0, cross: (a, b) => atX(a, b, x0) },
    { inside: (p) => p[0] <= x1, cross: (a, b) => atX(a, b, x1) },
    { inside: (p) => p[1] >= y0, cross: (a, b) => atY(a, b, y0) },
    { inside: (p) => p[1] <= y1, cross: (a, b) => atY(a, b, y1) },
  ];
  let out = poly;
  for (const edge of edges) {
    if (out.length === 0) return [];
    const next: Pt[] = [];
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i + out.length - 1) % out.length];
      const cur = out[i];
      const curIn = edge.inside(cur);
      if (edge.inside(prev) !== curIn) next.push(edge.cross(prev, cur));
      if (curIn) next.push(cur);
    }
    out = next;
  }
  return out;
}

function atX(a: Pt, b: Pt, x: number): Pt {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
}

function atY(a: Pt, b: Pt, y: number): Pt {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), y];
}

/** Shoelace area (always positive). */
export function polygonArea(poly: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** True when clipping actually changed the shape (tile is cut at a wall edge). */
export function polygonsDiffer(a: Pt[], b: Pt[]): boolean {
  if (a.length !== b.length) return true;
  return Math.abs(polygonArea(a) - polygonArea(b)) > 1e-6;
}

/**
 * Quad of width `depth` along segment a→b, offset to the side facing
 * `towards` (usually the tile centre). Used for geometric lap shadows —
 * identical on screen and in every export, unlike SVG filters.
 */
export function insetQuad(a: Pt, b: Pt, depth: number, towards: Pt): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  if ((towards[0] - mx) * nx + (towards[1] - my) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [a, b, [b[0] + nx * depth, b[1] + ny * depth], [a[0] + nx * depth, a[1] + ny * depth]];
}
