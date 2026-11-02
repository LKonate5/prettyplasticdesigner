import { MATERIALS, materialIndex } from '../../data/palette';
import type { ColourId, MaterialId, PatternConfig } from '../types';

/**
 * How much of a design each material gets. Shares travel as whole parts per
 * thousand (PatternConfig.weights) so a share link reproduces exactly the
 * quotas the generator used; the helpers here turn them into fractions, tile
 * counts and the other materials' new shares when one slider moves.
 */

export type Weights = NonNullable<PatternConfig['weights']>;

/** What the weights add up to. */
export const WEIGHT_TOTAL = 1000;

const colourOf = (id: MaterialId): ColourId => MATERIALS[materialIndex(id)].colour;

/**
 * The even mix for a hand-laid random wall: every colour gets the same share,
 * split between the shades of it that are allowed. (Dropping one shade of a
 * colour keeps that colour's weight on the wall instead of handing it to the
 * others.)
 */
export function evenColourShares(ids: readonly MaterialId[]): Map<MaterialId, number> {
  const perColour = new Map<ColourId, MaterialId[]>();
  for (const id of ids) {
    const colour = colourOf(id);
    perColour.set(colour, [...(perColour.get(colour) ?? []), id]);
  }
  const shares = new Map<MaterialId, number>();
  for (const members of perColour.values()) {
    for (const id of members) shares.set(id, 1 / perColour.size / members.length);
  }
  return shares;
}

/** Every material the same share. */
export function evenShares(ids: readonly MaterialId[]): Map<MaterialId, number> {
  return new Map(ids.map((id) => [id, 1 / Math.max(1, ids.length)]));
}

/**
 * Fractions (adding up to 1) for `ids` from stored weights. Weights that are
 * missing, negative or all zero fall back to `fallback`.
 */
export function sharesFromWeights(
  weights: Weights | undefined,
  ids: readonly MaterialId[],
  fallback: Map<MaterialId, number> = evenShares(ids),
): Map<MaterialId, number> {
  if (!weights) return fallback;
  const raw = ids.map((id) => Math.max(0, weights[id] ?? 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return fallback;
  return new Map(ids.map((id, i) => [id, raw[i] / sum]));
}

/** The shares the controls show for a pattern, whether or not the user has moved a slider. */
export function effectiveShares(
  pattern: PatternConfig,
  ids: readonly MaterialId[],
): Map<MaterialId, number> {
  const even = pattern.type === 'random' ? evenColourShares(ids) : evenShares(ids);
  return sharesFromWeights(pattern.weights, ids, even);
}

/** Whole numbers that add up to `total`, as close to `ideal` as whole numbers allow. */
function largestRemainder(ideal: number[], total: number): number[] {
  const floors = ideal.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = ideal
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/** Tile counts per material that add up to exactly `total`. */
export function quotas(
  shares: Map<MaterialId, number>,
  total: number,
): Map<MaterialId, number> {
  const ids = [...shares.keys()];
  const counts = largestRemainder(
    ids.map((id) => (shares.get(id) ?? 0) * total),
    total,
  );
  return new Map(ids.map((id, i) => [id, counts[i]]));
}

function toWeights(ids: readonly MaterialId[], fractions: number[]): Weights {
  const parts = largestRemainder(
    fractions.map((f) => f * WEIGHT_TOTAL),
    WEIGHT_TOTAL,
  );
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

/**
 * Move one material to `share` (0..1) of the design and scale every other
 * allowed material, in proportion to what it had, to fill what is left.
 */
export function setShare(
  pattern: PatternConfig,
  ids: readonly MaterialId[],
  id: MaterialId,
  share: number,
): Weights {
  const current = effectiveShares(pattern, ids);
  const target = Math.max(0, Math.min(1, share));
  const others = ids.filter((other) => other !== id);
  if (others.length === 0) return { [id]: WEIGHT_TOTAL };
  const othersSum = others.reduce((sum, other) => sum + (current.get(other) ?? 0), 0);
  const fractions = ids.map((other) => {
    if (other === id) return target;
    return othersSum > 0
      ? ((current.get(other) ?? 0) / othersSum) * (1 - target)
      : (1 - target) / others.length;
  });
  return toWeights(ids, fractions);
}

/**
 * Keep stored weights valid when the allowed set changes: materials that left
 * lose their share, materials that arrived get an even one, and the rest is
 * scaled to fill the wall again. No weights stay no weights.
 */
export function reconcileWeights(
  weights: Weights | undefined,
  ids: readonly MaterialId[],
): Weights | undefined {
  if (!weights || ids.length === 0) return undefined;
  const arrivalShare = 1 / ids.length;
  const keptSum = ids.reduce((sum, id) => sum + (id in weights ? Math.max(0, weights[id] ?? 0) : 0), 0);
  const arrivals = ids.filter((id) => !(id in weights));
  if (keptSum <= 0) return undefined;
  const keptFraction = 1 - arrivals.length * arrivalShare;
  const fractions = ids.map((id) =>
    id in weights ? (Math.max(0, weights[id] ?? 0) / keptSum) * keptFraction : arrivalShare,
  );
  return toWeights(ids, fractions);
}

/**
 * A repeating run of materials in the proportions of `shares`, spread as
 * evenly as the length allows. Stripes and the checker walk it instead of the
 * plain palette order once the user has moved a share.
 */
export function shareCycle(
  list: readonly MaterialId[],
  shares: Map<MaterialId, number>,
  length = 20,
): MaterialId[] {
  const counts = quotas(new Map(list.map((id) => [id, shares.get(id) ?? 0])), length);
  const placed = new Map<MaterialId, number>(list.map((id) => [id, 0]));
  const cycle: MaterialId[] = [];
  for (let i = 0; i < length; i++) {
    let best: MaterialId | null = null;
    let bestDeficit = Number.NEGATIVE_INFINITY;
    for (const id of list) {
      const want = counts.get(id) ?? 0;
      if (want === 0) continue;
      const deficit = (want * (i + 1)) / length - (placed.get(id) ?? 0);
      if (deficit > bestDeficit) {
        best = id;
        bestDeficit = deficit;
      }
    }
    if (best === null) break;
    cycle.push(best);
    placed.set(best, (placed.get(best) ?? 0) + 1);
  }
  return cycle.length > 0 ? cycle : [...list];
}

/** Running totals of `shares` in palette order — where each gradient band ends. */
export function cumulativeShares(
  list: readonly MaterialId[],
  shares: Map<MaterialId, number>,
): number[] {
  let sum = 0;
  return list.map((id) => (sum += shares.get(id) ?? 0));
}
