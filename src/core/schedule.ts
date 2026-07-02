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

export function computeSchedule(
  product: ProductSpec,
  layout: Layout,
  cells: readonly Cell[],
): Schedule {
  const counts = new Array<number>(MATERIALS.length).fill(0);
  for (const cell of cells) counts[cell.material]++;
  const totalTiles = cells.length;
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
