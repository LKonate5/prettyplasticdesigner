import type { ProductSpec } from '../core/types';
import { STR } from '../strings';

/**
 * Tools row: paint/rotate mode (rotate only for products that support it),
 * plus undo / redo / reset.
 */
export function ModeToggle({
  product,
  mode,
  canUndo,
  canRedo,
  onMode,
  onUndo,
  onRedo,
  onReset,
}: {
  product: ProductSpec;
  mode: 'paint' | 'rotate';
  canUndo: boolean;
  canRedo: boolean;
  onMode: (mode: 'paint' | 'rotate') => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  return (
    <div className="section">
      <h2>{STR.tools}</h2>
      {product.supportsRotation && (
        <div className="field">
          <div className="seg">
            <button className={mode === 'paint' ? 'active' : ''} onClick={() => onMode('paint')}>
              {STR.paint}
            </button>
            <button className={mode === 'rotate' ? 'active' : ''} onClick={() => onMode('rotate')}>
              {STR.rotate}
            </button>
          </div>
          {mode === 'rotate' && <p className="note">{STR.rotateHint}</p>}
        </div>
      )}
      <div className="row">
        <button className="btn" disabled={!canUndo} onClick={onUndo}>
          ↩ {STR.undo}
        </button>
        <button className="btn" disabled={!canRedo} onClick={onRedo}>
          {STR.redo} ↪
        </button>
        <button className="btn" onClick={onReset}>
          {STR.reset}
        </button>
      </div>
    </div>
  );
}
