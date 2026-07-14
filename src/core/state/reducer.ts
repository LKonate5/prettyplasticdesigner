import { MATERIAL_IDS } from '../../data/palette';
import { DEFAULT_OPTIONS, EXPOSURE_MAX, EXPOSURE_MIN, PRODUCTS } from '../../data/products';
import { computeLayout } from '../layout';
import { generatePattern } from '../pattern/generators';
import type {
  Cell,
  MaterialId,
  PatternConfig,
  ProductId,
  ProductOptions,
  Rotation,
} from '../types';
import type { Action } from './actions';

/**
 * Single app store: a pure reducer with a past/present/future undo history.
 *
 * Undo granularity:
 *  - a whole paint/rotate DRAG is one history entry (the UI brackets pointer
 *    gestures with STROKE_START / STROKE_END; the snapshot is pushed lazily on
 *    the first cell that actually changes, so empty strokes leave no trace);
 *  - a slider run (exposure, tone variation) coalesces into one entry via
 *    `lastCommitKind`.
 */

export interface DesignState {
  productId: ProductId;
  rows: number;
  cols: number;
  options: ProductOptions;
  pattern: PatternConfig;
  cells: Cell[];
  /** Waste allowance (0..1) added to order quantities in the quote panel. */
  wastePct: number;
}

export const DEFAULT_WASTE = 0.1;

export interface AppState {
  past: DesignState[];
  present: DesignState;
  future: DesignState[];
  /** Pre-stroke snapshot; pushed to past on the first real change of a stroke. */
  strokeBase: DesignState | null;
  /** Identity of the last committed control, so slider runs coalesce. */
  lastCommitKind: string | null;
  ui: {
    mode: 'paint' | 'rotate';
    brush: MaterialId;
    /** True when the last grid/product change was refused by the tile cap. */
    capNotice: boolean;
  };
}

const HISTORY_CAP = 50;
const GRID_MIN = 1;
const GRID_MAX = 80;

export const DEFAULT_GRID: Record<ProductId, { rows: number; cols: number }> = {
  'first-one': { rows: 20, cols: 10 }, // ≈ 3.0 × 3.1 m
  'second-high': { rows: 10, cols: 10 }, // 3 × 3 m
  'basic-third': { rows: 8, cols: 9 }, // ≈ 3.6 × 3.0 m (even rows → staggered tiles seamlessly)
};

/**
 * Offset products (First One always; Basic Third when staggered) only tile
 * cleanly top-to-bottom with an even row count, so snap rows to even. Keeps the
 * wall a true seamless repeat without the user having to think about it.
 */
export function snapRows(productId: ProductId, options: ProductOptions, rows: number): number {
  const offset = productId === 'first-one' || (productId === 'basic-third' && options.bond === 'staggered');
  if (!offset || rows % 2 === 0) return rows;
  return Math.max(2, rows + 1);
}

export function defaultPattern(seed: number): PatternConfig {
  return {
    type: 'random',
    seed,
    allowedMaterials: [...MATERIAL_IDS],
    toneVariation: 0.35,
    solidMaterial: 'grey-medium',
    gradient: { direction: 'vertical' },
    stripes: { direction: 'horizontal', width: 2 },
    randomRotation: true,
  };
}

function buildDesign(
  productId: ProductId,
  rows: number,
  cols: number,
  options: ProductOptions,
  pattern: PatternConfig,
  wastePct = DEFAULT_WASTE,
): DesignState | null {
  const product = PRODUCTS[productId];
  const snappedRows = snapRows(productId, options, rows);
  const layout = computeLayout(product, snappedRows, cols, options);
  if (layout.tiles.length > product.maxTiles) return null;
  return {
    productId,
    rows: snappedRows,
    cols,
    options,
    pattern,
    cells: generatePattern(pattern, layout),
    wastePct,
  };
}

export function initialDesign(productId: ProductId, seed: number): DesignState {
  const { rows, cols } = DEFAULT_GRID[productId];
  const design = buildDesign(productId, rows, cols, { ...DEFAULT_OPTIONS }, defaultPattern(seed));
  if (!design) throw new Error('default grid exceeds tile cap'); // impossible by construction
  return design;
}

export function initialAppState(seed: number): AppState {
  return appStateFromDesign(initialDesign('first-one', seed));
}

/** Build a fresh app state around a given design (e.g. one loaded from a share link). */
export function appStateFromDesign(present: DesignState): AppState {
  return {
    past: [],
    present,
    future: [],
    strokeBase: null,
    lastCommitKind: null,
    ui: { mode: 'paint', brush: 'ochre-medium', capNotice: false },
  };
}

function clampGrid(n: number): number {
  return Math.max(GRID_MIN, Math.min(GRID_MAX, Math.round(n) || GRID_MIN));
}

function clampExposure(n: number): number {
  return Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, Math.round(n)));
}

function addRotation(rotation: Rotation, delta: number): Rotation {
  return ((((rotation + delta * 90) % 360) + 360) % 360) as Rotation;
}

/**
 * Commit a new present. `kind` marks continuous controls: consecutive commits
 * of the same kind replace the present instead of stacking history entries.
 */
function commit(state: AppState, next: DesignState | null, kind: string | null = null): AppState {
  if (!next) {
    return { ...state, lastCommitKind: null, ui: { ...state.ui, capNotice: true } };
  }
  const coalesce = kind !== null && kind === state.lastCommitKind;
  const past = coalesce ? state.past : [...state.past, state.present];
  if (past.length > HISTORY_CAP) past.shift();
  return {
    ...state,
    past,
    present: next,
    future: [],
    strokeBase: null,
    lastCommitKind: kind,
    ui: { ...state.ui, capNotice: false },
  };
}

export function appReducer(state: AppState, action: Action): AppState {
  const p = state.present;
  switch (action.type) {
    case 'SET_PRODUCT': {
      if (action.productId === p.productId) return state;
      const { rows, cols } = DEFAULT_GRID[action.productId];
      return commit(
        state,
        buildDesign(action.productId, rows, cols, { ...DEFAULT_OPTIONS }, p.pattern, p.wastePct),
      );
    }

    case 'SET_GRID': {
      const rows = action.rows !== undefined ? clampGrid(action.rows) : p.rows;
      const cols = action.cols !== undefined ? clampGrid(action.cols) : p.cols;
      if (rows === p.rows && cols === p.cols) return state;
      return commit(state, buildDesign(p.productId, rows, cols, p.options, p.pattern, p.wastePct));
    }

    case 'SET_OPTIONS': {
      const options: ProductOptions = {
        exposure:
          action.options.exposure !== undefined
            ? clampExposure(action.options.exposure)
            : p.options.exposure,
        bond: action.options.bond ?? p.options.bond,
      };
      if (options.exposure === p.options.exposure && options.bond === p.options.bond) {
        return state;
      }
      if (options.bond === p.options.bond) {
        // Exposure only moves geometry — tile count is unchanged, so the cells
        // (including hand-painted ones) survive the slider.
        return commit(state, { ...p, options }, 'options:exposure');
      }
      return commit(
        state,
        buildDesign(p.productId, p.rows, p.cols, options, p.pattern, p.wastePct),
      );
    }

    case 'SET_PATTERN': {
      const pattern = { ...p.pattern, ...action.pattern };
      const keys = Object.keys(action.pattern);
      // Runs on one control (tone slider, seed typing…) coalesce into one undo.
      const kind = keys.length === 1 ? `pattern:${keys[0]}` : null;
      return commit(
        state,
        buildDesign(p.productId, p.rows, p.cols, p.options, pattern, p.wastePct),
        kind,
      );
    }

    case 'REROLL':
      return commit(
        state,
        buildDesign(p.productId, p.rows, p.cols, p.options, { ...p.pattern, seed: action.seed }, p.wastePct),
      );

    case 'SET_WASTE':
      if (action.wastePct === p.wastePct) return state;
      return commit(state, { ...p, wastePct: action.wastePct }, 'wastePct');

    case 'RESET': {
      const { rows, cols } = DEFAULT_GRID[p.productId];
      return commit(
        state,
        buildDesign(p.productId, rows, cols, { ...DEFAULT_OPTIONS }, defaultPattern(action.seed)),
      );
    }

    case 'STROKE_START':
      return { ...state, strokeBase: p, lastCommitKind: null };

    case 'PAINT_CELL': {
      const cell = p.cells[action.cellIndex];
      if (!cell || cell.material === action.material) return state;
      const cells = [...p.cells];
      cells[action.cellIndex] = { ...cell, material: action.material };
      return strokeEdit(state, { ...p, cells });
    }

    case 'ROTATE_CELL': {
      const cell = p.cells[action.cellIndex];
      if (!cell) return state;
      const cells = [...p.cells];
      cells[action.cellIndex] = { ...cell, rotation: addRotation(cell.rotation, action.delta) };
      return strokeEdit(state, { ...p, cells });
    }

    // Row/column/facade bulk rotate are second-high only (the only product
    // with a rotatable facet); the UI gates these controls the same way.
    case 'ROTATE_ROW': {
      if (p.productId !== 'second-high') return state;
      const cells = [...p.cells];
      for (let col = 0; col < p.cols; col++) {
        const i = action.row * p.cols + col;
        const cell = cells[i];
        if (cell) cells[i] = { ...cell, rotation: addRotation(cell.rotation, action.delta) };
      }
      return strokeEdit(state, { ...p, cells });
    }

    case 'ROTATE_COLUMN': {
      if (p.productId !== 'second-high') return state;
      const cells = [...p.cells];
      for (let row = 0; row < p.rows; row++) {
        const i = row * p.cols + action.col;
        const cell = cells[i];
        if (cell) cells[i] = { ...cell, rotation: addRotation(cell.rotation, action.delta) };
      }
      return strokeEdit(state, { ...p, cells });
    }

    case 'SET_FACADE_ROTATION': {
      if (p.productId !== 'second-high') return state;
      const cells = p.cells.map((cell) => ({ ...cell, rotation: action.rotation }));
      return commit(state, { ...p, cells });
    }

    case 'STROKE_END':
      return state.strokeBase ? { ...state, strokeBase: null } : state;

    case 'UNDO': {
      if (state.past.length === 0) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [p, ...state.future],
        strokeBase: null,
        lastCommitKind: null,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const [present, ...future] = state.future;
      return {
        ...state,
        past: [...state.past, p],
        present,
        future,
        strokeBase: null,
        lastCommitKind: null,
      };
    }

    case 'SET_MODE':
      return { ...state, ui: { ...state.ui, mode: action.mode } };

    case 'SET_BRUSH':
      return { ...state, ui: { ...state.ui, brush: action.brush } };
  }
}

/**
 * A cell changed during a stroke. On the first change, push the pre-stroke
 * snapshot and clear it — later changes in the same stroke just move present.
 */
function strokeEdit(state: AppState, present: DesignState): AppState {
  if (state.strokeBase) {
    const past = [...state.past, state.strokeBase];
    if (past.length > HISTORY_CAP) past.shift();
    return { ...state, past, present, future: [], strokeBase: null, lastCommitKind: null };
  }
  return { ...state, present };
}
