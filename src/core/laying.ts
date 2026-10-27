import { materialAt } from '../data/palette';
import type { Cell, ColourId, Layout, Material, ShadeId, Tile, TileRotation } from './types';

/**
 * Laying plan ("legpatroon") — where each tile goes. Pure data; the PDF in
 * export/layingPlan.ts only draws it.
 *
 * Every physical tile gets a coordinate, "F09": column letter + course number.
 * Courses count from the bottom (01 is the first one laid). Columns are the
 * distinct tile-centre x positions, left to right, so a product whose courses
 * are offset by half a tile (First One, staggered Basic Third) gets a letter
 * per HALF tile and only every other letter exists in a given course.
 */

export type CutEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * One letter per colour. Ochre is Y, not O, so a code never reads as a zero on
 * a printout. A Record, so adding a colour to the palette won't compile until
 * it has a letter here.
 */
const COLOUR_LETTER: Record<ColourId, string> = {
  ochre: 'Y',
  terracotta: 'T',
  green: 'G',
  grey: 'S',
  blue: 'B',
};

const SHADE_DIGIT: Record<ShadeId, number> = { light: 1, medium: 2, dark: 3 };

/** "T2" = terracotta, medium. Colour letter + shade (1 light, 2 medium, 3 dark). */
export function materialCode(material: Material): string {
  return `${COLOUR_LETTER[material.colour]}${SHADE_DIGIT[material.shade]}`;
}

// No I and no O: next to a digit they read as 1 and 0.
const COLUMN_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 0 → A … 23 → Z, then AA, AB … (like spreadsheet columns). */
export function columnLabel(index: number): string {
  const base = COLUMN_LETTERS.length;
  let n = index;
  let label = '';
  do {
    label = COLUMN_LETTERS[n % base] + label;
    n = Math.floor(n / base) - 1;
  } while (n >= 0);
  return label;
}

export interface LaidTile {
  /** Coordinate, e.g. "F09". Unique on the wall. */
  id: string;
  column: string;
  columnIndex: number;
  /** 1 = bottom course. */
  course: number;
  tile: Tile;
  material: Material;
  /** Colour + shade, e.g. "T2". */
  code: string;
  /** Second High only; 0 for every other product. */
  rotation: TileRotation;
  /** Wall edges this tile is cut at. Empty for a whole tile. */
  cutEdges: CutEdge[];
  /** Centre of the tile's lattice position, mm, y down (the drawn outline may be cut). */
  cx: number;
  cy: number;
}

export interface LayingPlan {
  /** Course by course, bottom first, each left to right. */
  tiles: LaidTile[];
  /** courses[0] is course 01. */
  courses: LaidTile[][];
  /** Number of distinct column letters on the wall. */
  columnCount: number;
  /** x of each column's centre line, mm. */
  columnX: number[];
}

// Positions closer than this are the same lattice line (float noise from the layouts).
const SAME_LINE_MM = 0.5;

export function buildLayingPlan(layout: Layout, cells: readonly Cell[]): LayingPlan {
  const bounds = layout.tiles.map((tile) => polygonBounds(tile.polygon));

  // Column lines: every distinct centre x. The smallest gap between two lines is
  // one column step (a half tile when courses are offset, a whole one when not).
  const lines: number[] = [];
  for (const b of [...bounds].sort((a, c) => a.cx - c.cx)) {
    if (lines.length === 0 || b.cx - lines[lines.length - 1] > SAME_LINE_MM) lines.push(b.cx);
  }
  let step = Infinity;
  for (let i = 1; i < lines.length; i++) step = Math.min(step, lines[i] - lines[i - 1]);
  const origin = lines[0] ?? 0;
  const indexOf = (x: number) => (Number.isFinite(step) ? Math.round((x - origin) / step) : 0);
  const columnCount = Number.isFinite(step) ? indexOf(lines[lines.length - 1]) + 1 : lines.length;
  const columnX = Array.from({ length: columnCount }, (_, i) => (Number.isFinite(step) ? origin + i * step : origin));

  const laid: LaidTile[] = layout.tiles.map((tile, i) => {
    const b = bounds[i];
    const columnIndex = indexOf(b.cx);
    const course = tile.row + 1;
    const column = columnLabel(columnIndex);
    const cell = cells[tile.cellIndex];
    const cutEdges: CutEdge[] = [];
    if (b.minX < -SAME_LINE_MM) cutEdges.push('left');
    if (b.maxX > layout.wallW + SAME_LINE_MM) cutEdges.push('right');
    if (b.minY < -SAME_LINE_MM) cutEdges.push('top');
    if (b.maxY > layout.wallH + SAME_LINE_MM) cutEdges.push('bottom');
    const material = materialAt(cell?.material ?? 0);
    return {
      id: `${column}${String(course).padStart(2, '0')}`,
      column,
      columnIndex,
      course,
      tile,
      material,
      code: materialCode(material),
      // Same rule as the renderer: only Second High tiles are ever turned.
      rotation: layout.productId === 'second-high' ? (cell?.rotation ?? 0) : 0,
      cutEdges,
      cx: b.cx,
      cy: b.cy,
    };
  });

  laid.sort((a, b) => a.course - b.course || a.cx - b.cx);
  const courses: LaidTile[][] = [];
  for (const t of laid) (courses[t.course - 1] ??= []).push(t);
  return { tiles: laid, courses, columnCount, columnX };
}

function polygonBounds(polygon: Tile['polygon']) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
