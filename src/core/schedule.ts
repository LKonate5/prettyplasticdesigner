import { MATERIALS } from '../data/palette';
import type { Cell, Layout, Material, ProductSpec } from './types';

/**
 * Tile schedule — the quote-ready numbers. Counts include cut edge tiles
 * (installers cut them from full tiles) and exclude site waste.
 */

export interface ScheduleRow {
  material: Material;
  count: number;
  pct: number;
  weightKg: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totalTiles: number;
  areaM2: number;
  totalWeightKg: number;
  wallW: number;
  wallH: number;
}

export interface OrderRow {
  material: Material;
  need: number; // tiles on the wall
  order: number; // rounded up incl. waste
}

export interface Order {
  rows: OrderRow[];
  wastePct: number;
  totalNeed: number;
  totalOrder: number;
  boxes: number | null; // null when tiles-per-box not set
  tilesPerBox: number | null;
  areaToOrderM2: number;
  weightToOrderKg: number;
}

/**
 * Order-ready quantities: each colour rounded UP with a waste allowance, plus
 * boxes if a tiles-per-box figure is given. Waste covers cuts and breakage;
 * rounding up per colour means you never under-order a shade.
 */
export function computeOrder(
  product: ProductSpec,
  schedule: Schedule,
  wastePct: number,
  tilesPerBox: number | null,
): Order {
  const factor = 1 + Math.max(0, wastePct);
  const rows: OrderRow[] = schedule.rows.map((r) => ({
    material: r.material,
    need: r.count,
    order: Math.ceil(r.count * factor),
  }));
  const totalOrder = rows.reduce((s, r) => s + r.order, 0);
  const perBox = tilesPerBox && tilesPerBox > 0 ? Math.floor(tilesPerBox) : null;
  return {
    rows,
    wastePct,
    totalNeed: schedule.totalTiles,
    totalOrder,
    tilesPerBox: perBox,
    boxes: perBox ? Math.ceil(totalOrder / perBox) : null,
    areaToOrderM2: totalOrder / product.nominalTilesPerM2,
    weightToOrderKg: totalOrder * product.weightKg,
  };
}

export function computeSchedule(
  product: ProductSpec,
  layout: Layout,
  cells: readonly Cell[],
): Schedule {
  // Count PHYSICAL tiles placed on the wall (each cut edge tile counts as a
  // full tile, since it's cut from one), not the shared logical cells — this
  // is the orderable quantity. Wrap partners share a colour but are separate
  // physical tiles.
  const counts = new Array<number>(MATERIALS.length).fill(0);
  for (const tile of layout.tiles) {
    const cell = cells[tile.cellIndex];
    if (cell) counts[cell.material]++;
  }
  const totalTiles = layout.tiles.length;
  const areaM2 = (layout.wallW * layout.wallH) / 1_000_000;
  const rows: ScheduleRow[] = [];
  counts.forEach((count, i) => {
    if (count === 0) return;
    rows.push({
      material: MATERIALS[i],
      count,
      pct: totalTiles > 0 ? (count / totalTiles) * 100 : 0,
      weightKg: count * product.weightKg,
    });
  });
  return {
    rows,
    totalTiles,
    areaM2,
    totalWeightKg: totalTiles * product.weightKg,
    wallW: layout.wallW,
    wallH: layout.wallH,
  };
}
