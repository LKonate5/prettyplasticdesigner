import type { ProductSpec, Rotation } from '../core/types';
import { STR } from '../strings';

const FACADE_ROTATIONS: Rotation[] = [0, 90, 180, 270];

/**
 * Tools row: paint/rotate mode (rotate only for products that support it),
 * plus undo / redo / reset.
 */
export function ModeToggle({
  product,
  mode,
  facadeRotation,
  canUndo,
  canRedo,
  onMode,
  onFacadeRotation,
  onUndo,
  onRedo,
  onReset,
}: {
  product: ProductSpec;
  mode: 'paint' | 'rotate';
  facadeRotation: Rotation | null;
  canUndo: boolean;
  canRedo: boolean;
  onMode: (mode: 'paint' | 'rotate') => void;
  onFacadeRotation: (rotation: Rotation) => void;
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
          {mode === 'rotate' && (
            <>
              <p className="note">{STR.rotateHint}</p>
              <label>{STR.facadeRotation}</label>
              <div className="seg">
                {FACADE_ROTATIONS.map((r) => (
                  <button
                    key={r}
                    className={facadeRotation === r ? 'active' : ''}
                    onClick={() => onFacadeRotation(r)}
                  >
                    {r}°
                  </button>
                ))}
              </div>
              <p className="note">{STR.facadeRotationHint}</p>
            </>
          )}
        </div>
      )}
      <div className="row">
        <button className="btn" disabled={!canUndo} onClick={onUndo} title={STR.undoHint}>
          ↩ {STR.undo}
        </button>
        <button className="btn" disabled={!canRedo} onClick={onRedo} title={STR.redoHint}>
          {STR.redo} ↪
        </button>
        <button className="btn" onClick={onReset} title={STR.resetHint}>
          {STR.reset}
        </button>
      </div>
      <p className="note">{STR.toolsHint}</p>
    </div>
  );
}
