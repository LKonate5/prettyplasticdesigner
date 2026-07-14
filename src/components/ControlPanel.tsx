import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Action } from '../core/state/actions';
import type { AppState } from '../core/state/reducer';
import { computeOrder, type Schedule } from '../core/schedule';
import { randomSeed } from '../core/pattern/prng';
import { MATERIAL_IDS } from '../data/palette';
import type { Layout, MaterialId, ProductSpec } from '../core/types';
import type { ExportLead } from '../embed/email';
import { productPhotoStatus } from '../render/textures';
import type { TextureMap } from '../render/textures';
import { STR } from '../strings';
import { DimensionInputs } from './DimensionInputs';
import { ExportMenu } from './ExportMenu';
import { LeadCaptureModal } from './LeadCaptureModal';
import { ModeToggle } from './ModeToggle';
import { PaletteGrid } from './PaletteGrid';
import { PatternControls } from './PatternControls';
import { ProductPicker } from './ProductPicker';
import { QuotePanel } from './QuotePanel';
import { RequestButtons } from './RequestButtons';
import { SchedulePanel } from './SchedulePanel';
import { ShareButton } from './ShareButton';

/**
 * The left control panel — every design control, plus the schedule and export
 * menu. Under 800 px it becomes a slide-in drawer (the `open` flag).
 */
export function ControlPanel({
  open,
  onClose,
  state,
  product,
  layout,
  schedule,
  textures,
  dispatch,
}: {
  open: boolean;
  onClose: () => void;
  state: AppState;
  product: ProductSpec;
  layout: Layout;
  schedule: Schedule;
  textures: TextureMap;
  dispatch: Dispatch<Action>;
}) {
  const design = state.present;
  const order = computeOrder(product, schedule, design.wastePct);
  // Only judged once the manifest loaded, so no note flashes during startup.
  const photoStatus = textures.size > 0 ? productPhotoStatus(textures, product.id) : 'native';
  const scene = {
    product,
    layout,
    cells: design.cells,
    textures,
    options: design.options,
    pattern: design.pattern,
  };

  // Captured once per visit, shared by ExportMenu and RequestButtons, before
  // their first send/download — see LeadCaptureModal.
  const [lead, setLead] = useState<ExportLead | null>(null);
  const [pendingLead, setPendingLead] = useState<{
    label: string;
    onReady: (lead: ExportLead) => void;
  } | null>(null);

  const requireLead = (label: string, onReady: (lead: ExportLead) => void) => {
    if (lead) {
      onReady(lead);
      return;
    }
    setPendingLead({ label, onReady });
  };

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
        <div>
          <strong>{STR.brand}</strong>
          <span>{STR.appTitle}</span>
        </div>
        <button className="drawer-done" onClick={onClose} aria-label={STR.seeWall}>
          {STR.seeWall} ✕
        </button>
      </div>

      <ProductPicker
        value={design.productId}
        onChange={(productId) => dispatch({ type: 'SET_PRODUCT', productId })}
      />
      {photoStatus === 'none' && <p className="note">{STR.renderedPreviewNote}</p>}
      {/* Basic Third no longer shows the borrowed photo (see TileShape) — its
          marble-fade + bands rendering doesn't need this disclaimer. */}
      {photoStatus === 'borrowed' && product.id !== 'basic-third' && (
        <p className="note">{STR.borrowedPhotoNote}</p>
      )}

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
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onReset={() => dispatch({ type: 'RESET', seed: randomSeed() })}
      />

      <SchedulePanel schedule={schedule} />

      <QuotePanel
        order={order}
        wastePct={design.wastePct}
        onWaste={(wastePct) => dispatch({ type: 'SET_WASTE', wastePct })}
      />

      <ShareButton design={design} />

      <ExportMenu ctx={{ ...scene, schedule, design, order }} requireLead={requireLead} />

      <RequestButtons
        design={design}
        product={product}
        schedule={schedule}
        order={order}
        scene={scene}
        requireLead={requireLead}
      />

      <p className="note">{STR.regenNote}</p>

      {pendingLead && (
        <LeadCaptureModal
          formatLabel={pendingLead.label}
          onSubmit={(next) => {
            setLead(next);
            const onReady = pendingLead.onReady;
            setPendingLead(null);
            onReady(next);
          }}
          onCancel={() => setPendingLead(null)}
        />
      )}
    </aside>
  );
}
