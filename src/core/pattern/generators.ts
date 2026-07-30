import { MATERIALS, materialIndex, stepShade } from '../../data/palette';
import type { Cell, ColourId, Layout, MaterialId, PatternConfig } from '../types';
import { cellRng } from './prng';

/**
 * Pure pattern generation: (config, layout) → cells. Deterministic — same
 * seed, same layout, same cells. All generators respect the palette
 * restriction (allowedMaterials).
 */
export function generatePattern(config: PatternConfig, layout: Layout): Cell[] {
  // Keep the canonical palette order (grouped by colour, light→dark) so
  // gradients and stripes walk the restricted palette in a sensible sequence.
  const allowed = MATERIALS.map((m) => m.id).filter((id) =>
    config.allowedMaterials.includes(id),
  );
  const list = allowed.length > 0 ? allowed : [MATERIALS[0].id];
  const allowedSet = new Set(list);

  // Colour is keyed on the CANONICAL wrapped position (patternRow/patternCol),
  // so wrap-partner tiles — which share a cellIndex — always compute the same
  // value. Every partner writes cells[cellIndex] identically (idempotent), and
  // the wall tiles seamlessly.
  const maxRow = Math.max(1, layout.patternRows - 1);
  const maxCol = Math.max(1, layout.patternCols - 1);

  if (config.type === 'random') {
    return generateHandLaidRandom(config, layout, list);
  }

  const cells: Cell[] = new Array(layout.cellCount);
  for (const tile of layout.tiles) {
    const pr = tile.patternRow;
    const pc = tile.patternCol;
    const rng = cellRng(config.seed, pr, pc);
    let mat = baseMaterial(config, pr, pc, maxRow, maxCol, list, rng);
    if (config.type !== 'gradient') mat = applyToneVariation(mat, config, allowedSet, rng);
    cells[tile.cellIndex] = { material: materialIndex(mat) };
  }
  return cells;
}

function baseMaterial(
  config: PatternConfig,
  row: number,
  col: number,
  maxRow: number,
  maxCol: number,
  list: MaterialId[],
  rng: () => number,
): MaterialId {
  const n = list.length;
  switch (config.type) {
    case 'solid':
      return list.includes(config.solidMaterial) ? config.solidMaterial : list[0];
    case 'random':
      return list[Math.floor(rng() * n)];
    case 'gradient': {
      let t: number;
      switch (config.gradient.direction) {
        case 'horizontal':
          t = col / maxCol;
          break;
        case 'vertical':
          t = row / maxRow;
          break;
        case 'diagonal':
          t = (col / maxCol + row / maxRow) / 2;
          break;
      }
      // toneVariation dithers band edges so the gradient looks hand-laid.
      t += (rng() - 0.5) * config.toneVariation * (2 / n);
      const idx = Math.min(n - 1, Math.max(0, Math.floor(t * n)));
      return list[idx];
    }
    case 'stripes': {
      const pos = config.stripes.direction === 'horizontal' ? row : col;
      const width = Math.max(1, config.stripes.width);
      const band = Math.floor(Math.max(0, pos) / width);
      return list[band % n];
    }
    case 'checker':
      return list[(((row + col) % n) + n) % n];
  }
}

type Grid = Array<MaterialId | null>;

interface RandomContext {
  config: PatternConfig;
  rows: number;
  cols: number;
  list: MaterialId[];
  familyCount: number;
  materialCounts: Map<MaterialId, number>;
  familyCounts: Map<ColourId, number>;
}

/**
 * "Random" as a designer means balanced and hand-laid, not independent dice
 * rolls. Fill the logical repeat once, then run a wrap-aware relaxation pass so
 * the repeated preview does not reveal colour blobs at the wall edges.
 */
function generateHandLaidRandom(
  config: PatternConfig,
  layout: Layout,
  list: MaterialId[],
): Cell[] {
  const rows = Math.max(1, layout.patternRows);
  const cols = Math.max(1, layout.patternCols);
  const families = new Set(list.map(familyOf));
  const ctx: RandomContext = {
    config,
    rows,
    cols,
    list,
    familyCount: families.size,
    materialCounts: new Map(list.map((id) => [id, 0])),
    familyCounts: new Map([...families].map((id) => [id, 0])),
  };
  const grid: Grid = new Array(rows * cols).fill(null);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      place(grid, ctx, row, col, 0, false);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      place(grid, ctx, row, col, 1, true);
    }
  }

  return grid.map((mat) => ({ material: materialIndex(mat ?? list[0]) }));
}

function place(
  grid: Grid,
  ctx: RandomContext,
  row: number,
  col: number,
  pass: number,
  wrap: boolean,
): void {
  const idx = indexOf(row, col, ctx.cols);
  const previous = grid[idx];
  if (previous) adjustCounts(ctx, previous, -1);
  grid[idx] = null;

  let best = ctx.list[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const mat of ctx.list) {
    const score = candidateScore(grid, ctx, row, col, mat, pass, wrap);
    if (score < bestScore) {
      best = mat;
      bestScore = score;
    }
  }

  grid[idx] = best;
  adjustCounts(ctx, best, 1);
}

function candidateScore(
  grid: Grid,
  ctx: RandomContext,
  row: number,
  col: number,
  mat: MaterialId,
  pass: number,
  wrap: boolean,
): number {
  const family = familyOf(mat);
  const assigned = assignedCount(ctx) + 1;
  const familyTarget = assigned / Math.max(1, ctx.familyCount);
  const materialTarget = assigned / ctx.list.length;
  const nextFamilyCount = (ctx.familyCounts.get(family) ?? 0) + 1;
  const familyPressure = ctx.familyCount > 1 ? square(nextFamilyCount - familyTarget) : 0;
  const familyQuotaPressure = ctx.familyCount > 1
    ? Math.max(0, nextFamilyCount - Math.ceil(familyTarget)) * 18
    : 0;
  const materialPressure = square((ctx.materialCounts.get(mat) ?? 0) + 1 - materialTarget);
  const sameFamilyWeight = ctx.familyCount > 1 ? 1 : 0;
  const exactWeight = 0.4 + ctx.config.toneVariation;

  let score = familyPressure * 5.5 + familyQuotaPressure + materialPressure * (0.25 + ctx.config.toneVariation * 0.25);

  for (const [dr, dc] of ORTHOGONAL) {
    const n = get(grid, ctx, row + dr, col + dc, wrap);
    if (!n) continue;
    if (familyOf(n) === family) score += 4.2 * sameFamilyWeight;
    if (n === mat) score += 1.2 * exactWeight;
  }
  for (const [dr, dc] of DIAGONAL) {
    const n = get(grid, ctx, row + dr, col + dc, wrap);
    if (!n) continue;
    if (familyOf(n) === family) score += 1.1 * sameFamilyWeight;
    if (n === mat) score += 0.45 * exactWeight;
  }

  if (sameFamilyWeight && createsRun(grid, ctx, row, col, family, wrap)) score += 80;
  if (sameFamilyWeight && createsBlock(grid, ctx, row, col, family, wrap)) score += 70;
  if (createsExactRun(grid, ctx, row, col, mat, wrap)) score += 14 * exactWeight;

  const jitter = cellRng(
    ctx.config.seed ^ Math.imul(materialIndex(mat) + 1, 0x45d9f3b) ^ Math.imul(pass + 1, 0x9e3779b1),
    row,
    col,
  )();
  return score + jitter * 0.55;
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
];

const DIAGONAL: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function createsRun(
  grid: Grid,
  ctx: RandomContext,
  row: number,
  col: number,
  family: ColourId,
  wrap: boolean,
): boolean {
  return (
    hasFamily(grid, ctx, row, col - 2, family, wrap) && hasFamily(grid, ctx, row, col - 1, family, wrap) ||
    hasFamily(grid, ctx, row, col - 1, family, wrap) && hasFamily(grid, ctx, row, col + 1, family, wrap) ||
    hasFamily(grid, ctx, row, col + 1, family, wrap) && hasFamily(grid, ctx, row, col + 2, family, wrap) ||
    hasFamily(grid, ctx, row - 2, col, family, wrap) && hasFamily(grid, ctx, row - 1, col, family, wrap) ||
    hasFamily(grid, ctx, row - 1, col, family, wrap) && hasFamily(grid, ctx, row + 1, col, family, wrap) ||
    hasFamily(grid, ctx, row + 1, col, family, wrap) && hasFamily(grid, ctx, row + 2, col, family, wrap)
  );
}

function createsExactRun(
  grid: Grid,
  ctx: RandomContext,
  row: number,
  col: number,
  mat: MaterialId,
  wrap: boolean,
): boolean {
  return (
    get(grid, ctx, row, col - 2, wrap) === mat && get(grid, ctx, row, col - 1, wrap) === mat ||
    get(grid, ctx, row, col - 1, wrap) === mat && get(grid, ctx, row, col + 1, wrap) === mat ||
    get(grid, ctx, row, col + 1, wrap) === mat && get(grid, ctx, row, col + 2, wrap) === mat ||
    get(grid, ctx, row - 2, col, wrap) === mat && get(grid, ctx, row - 1, col, wrap) === mat ||
    get(grid, ctx, row - 1, col, wrap) === mat && get(grid, ctx, row + 1, col, wrap) === mat ||
    get(grid, ctx, row + 1, col, wrap) === mat && get(grid, ctx, row + 2, col, wrap) === mat
  );
}

function createsBlock(
  grid: Grid,
  ctx: RandomContext,
  row: number,
  col: number,
  family: ColourId,
  wrap: boolean,
): boolean {
  for (const top of [row - 1, row]) {
    for (const left of [col - 1, col]) {
      const corners = [
        [top, left],
        [top, left + 1],
        [top + 1, left],
        [top + 1, left + 1],
      ] as const;
      if (corners.every(([r, c]) => (r === row && c === col) || hasFamily(grid, ctx, r, c, family, wrap))) {
        return true;
      }
    }
  }
  return false;
}

function hasFamily(
  grid: Grid,
  ctx: RandomContext,
  row: number,
  col: number,
  family: ColourId,
  wrap: boolean,
): boolean {
  const mat = get(grid, ctx, row, col, wrap);
  return !!mat && familyOf(mat) === family;
}

function get(
  grid: Grid,
  { rows, cols }: RandomContext,
  row: number,
  col: number,
  wrap: boolean,
): MaterialId | null {
  if (wrap) {
    return grid[indexOf(mod(row, rows), mod(col, cols), cols)];
  }
  if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
  return grid[indexOf(row, col, cols)];
}

function adjustCounts(ctx: RandomContext, mat: MaterialId, delta: 1 | -1): void {
  ctx.materialCounts.set(mat, (ctx.materialCounts.get(mat) ?? 0) + delta);
  const family = familyOf(mat);
  ctx.familyCounts.set(family, (ctx.familyCounts.get(family) ?? 0) + delta);
}

function assignedCount(ctx: RandomContext): number {
  let count = 0;
  for (const n of ctx.materialCounts.values()) count += n;
  return count;
}

function familyOf(mat: MaterialId): ColourId {
  return MATERIALS[materialIndex(mat)].colour;
}

function indexOf(row: number, col: number, cols: number): number {
  return row * cols + col;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function square(n: number): number {
  return n * n;
}

/** With probability = toneVariation, step the shade ±1 within the same colour. */
function applyToneVariation(
  mat: MaterialId,
  config: PatternConfig,
  allowedSet: Set<MaterialId>,
  rng: () => number,
): MaterialId {
  if (config.toneVariation <= 0) return mat;
  if (rng() >= config.toneVariation) return mat;
  const stepped = stepShade(mat, rng() < 0.5 ? -1 : 1);
  return stepped && allowedSet.has(stepped) ? stepped : mat;
}
