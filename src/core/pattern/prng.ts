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

/**
 * Friendly short code for a seed — a base-36 string like "K7X2P" instead of a
 * meaningless 10-digit number. Reversible, so a user can jot one down and type
 * it back to return to a look.
 */
export function seedToCode(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase();
}

export function codeToSeed(code: string): number | null {
  const cleaned = code.trim().toLowerCase().replace(/[^0-9a-z]/g, '');
  if (!cleaned) return null;
  const n = parseInt(cleaned, 36);
  return Number.isFinite(n) ? n >>> 0 : null;
}
