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

export interface Order {
  wastePct: number;
  /** Exact wall coverage in m² (for reference). */
  exactM2: number;
  /** Whole m² to cover the wall — Pretty Plastic ships full square metres only. */
  onWallM2: number;
  /** Whole m² to order, incl. the waste allowance. */
  toOrderM2: number;
  palletM2: number;
  pallets: number;
  weightKg: number;
}

/**
 * Order-ready quantities. Pretty Plastic ships in FULL square metres (no
 * halves) on europallets, so everything rounds UP to whole m²: the coverage,
 * the order (coverage + waste), and the pallet count. Waste covers cuts and
 * breakage.
 */
export function computeOrder(product: ProductSpec, schedule: Schedule, wastePct: number): Order {
  const exactM2 = schedule.areaM2;
  // Round the wall coverage up to whole m² FIRST, then add the waste on top and
  // round up again — so "10 m² + 10%" orders 11 m², not 10 (the waste is never
  // swallowed by rounding).
  const onWallM2 = Math.ceil(exactM2);
  const toOrderM2 = Math.ceil(onWallM2 * (1 + Math.max(0, wastePct)));
  const kgPerM2 = product.weightKg * product.nominalTilesPerM2;
  return {
    wastePct,
    exactM2,
    onWallM2,
    toOrderM2,
    palletM2: product.palletM2,
    pallets: Math.ceil(toOrderM2 / product.palletM2),
    weightKg: Math.round(toOrderM2 * kgPerM2),
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
