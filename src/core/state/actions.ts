import type { MaterialId, PatternConfig, ProductId, ProductOptions, Rotation } from '../types';

/**
 * Seeds travel inside actions (RESET/REROLL) so the reducer stays fully
 * deterministic and testable — no Math.random() below the UI layer.
 */
export type Action =
  | { type: 'SET_PRODUCT'; productId: ProductId }
  | { type: 'SET_GRID'; rows?: number; cols?: number }
  | { type: 'SET_OPTIONS'; options: Partial<ProductOptions> }
  | { type: 'SET_PATTERN'; pattern: Partial<PatternConfig> }
  | { type: 'REROLL'; seed: number }
  | { type: 'RESET'; seed: number }
  | { type: 'STROKE_START' }
  | { type: 'PAINT_CELL'; cellIndex: number; material: number }
  | { type: 'ROTATE_CELL'; cellIndex: number; delta: 1 | -1 }
  | { type: 'ROTATE_ROW'; row: number; delta: 1 | -1 }
  | { type: 'ROTATE_COLUMN'; col: number; delta: 1 | -1 }
  | { type: 'SET_FACADE_ROTATION'; rotation: Rotation }
  | { type: 'STROKE_END' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_MODE'; mode: 'paint' | 'rotate' }
  | { type: 'SET_BRUSH'; brush: MaterialId }
  | { type: 'SET_WASTE'; wastePct: number };
