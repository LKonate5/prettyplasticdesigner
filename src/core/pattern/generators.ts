import { MATERIALS, materialIndex, stepShade } from '../../data/palette';
import type { Cell, Layout, MaterialId, PatternConfig, Rotation } from '../types';
import { cellRng } from './prng';

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

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

  const cells: Cell[] = new Array(layout.cellCount);
  for (const tile of layout.tiles) {
    const pr = tile.patternRow;
    const pc = tile.patternCol;
    const rng = cellRng(config.seed, pr, pc);
    let mat = baseMaterial(config, pr, pc, maxRow, maxCol, list, rng);
    if (config.type !== 'gradient') mat = applyToneVariation(mat, config, allowedSet, rng);
    const rotation: Rotation =
      config.randomRotation && layout.productId === 'second-high'
        ? ROTATIONS[Math.floor(rng() * 4)]
        : 0;
    cells[tile.cellIndex] = { material: materialIndex(mat), rotation };
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
