import { STR } from '../strings';

/** Tools row: undo / redo / reset. */
export function ModeToggle({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  return (
    <div className="section">
      <h2>{STR.tools}</h2>
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
