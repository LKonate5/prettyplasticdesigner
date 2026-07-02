/**
 * Deterministic pseudo-random numbers (mulberry32). Every cell gets its own
 * stream keyed on (seed, row, col), so:
 *  - the same seed always reproduces the same design (re-roll = new seed),
 *  - resizing the wall keeps the pattern of the cells that already existed.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cellRng(seed: number, row: number, col: number): () => number {
  const h =
    (seed ^ Math.imul(row + 0x9e37, 73856093) ^ Math.imul(col + 0x85eb, 19349663)) >>> 0;
  return mulberry32(h);
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
