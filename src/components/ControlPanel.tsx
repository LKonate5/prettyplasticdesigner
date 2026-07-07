import type { Dispatch } from 'react';
import type { Action } from '../core/state/actions';
import type { AppState } from '../core/state/reducer';
import type { Schedule } from '../core/schedule';
import { randomSeed } from '../core/pattern/prng';
import { MATERIAL_IDS } from '../data/palette';
import type { Layout, MaterialId, ProductSpec } from '../core/types';
import type { TextureMap } from '../render/textures';
import { STR } from '../strings';
import { DimensionInputs } from './DimensionInputs';
import { ExportMenu } from './ExportMenu';
import { ModeToggle } from './ModeToggle';
import { PaletteGrid } from './PaletteGrid';
import { PatternControls } from './PatternControls';
import { ProductPicker } from './ProductPicker';
import { SchedulePanel } from './SchedulePanel';

/**
 * The left control panel — every design control, plus the schedule and export
 * menu. Under 800 px it becomes a slide-in drawer (the `open` flag).
 */
export function ControlPanel({
  open,
  state,
  product,
  layout,
  schedule,
  textures,
  dispatch,
}: {
  open: boolean;
  state: AppState;
  product: ProductSpec;
  layout: Layout;
  schedule: Schedule;
  textures: TextureMap;
  dispatch: Dispatch<Action>;
}) {
  const design = state.present;

  const toggleAllowed = (id: MaterialId) => {
    const has = design.pattern.allowedMaterials.includes(id);
    const next = has
      ? design.pattern.allowedMaterials.filter((m) => m !== id)
      : [...design.pattern.allowedMaterials, id];
    if (next.length === 0) return; // keep at least one
    dispatch({ type: 'SET_PATTERN', pattern: { allowedMaterials: next } });
  };

  return (
    <aside className={`panel${open ? ' open' : ''}`}>
      <div className="brand">
        <strong>{STR.brand}</strong>
        <span>{STR.appTitle}</span>
      </div>

      <ProductPicker
        value={design.productId}
        onChange={(productId) => dispatch({ type: 'SET_PRODUCT', productId })}
      />

      <DimensionInputs
        product={product}
        rows={design.rows}
        cols={design.cols}
        options={design.options}
        layout={layout}
        onGrid={(next) => dispatch({ type: 'SET_GRID', ...next })}
        onOptions={(options) => dispatch({ type: 'SET_OPTIONS', options })}
      />
      {state.ui.capNotice && <p className="warn">{STR.capNotice}</p>}

      <PatternControls
        product={product}
        pattern={design.pattern}
        onPattern={(pattern) => dispatch({ type: 'SET_PATTERN', pattern })}
        onReroll={() => dispatch({ type: 'REROLL', seed: randomSeed() })}
      />

      <PaletteGrid
        brush={state.ui.brush}
        allowed={design.pattern.allowedMaterials}
        onBrush={(brush) => dispatch({ type: 'SET_BRUSH', brush })}
        onToggleAllowed={toggleAllowed}
        onAllowAll={() =>
          dispatch({ type: 'SET_PATTERN', pattern: { allowedMaterials: [...MATERIAL_IDS] } })
        }
      />

      <ModeToggle
        product={product}
        mode={state.ui.mode}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onMode={(mode) => dispatch({ type: 'SET_MODE', mode })}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onReset={() => dispatch({ type: 'RESET', seed: randomSeed() })}
      />

      <SchedulePanel schedule={schedule} product={product} />

      <ExportMenu ctx={{ product, layout, cells: design.cells, textures }} />

      <p className="note">{STR.regenNote}</p>
    </aside>
  );
}
