import { useEffect, useMemo, useReducer, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { WallPreview } from './components/WallPreview';
import { computeLayout } from './core/layout';
import { computeSchedule } from './core/schedule';
import { randomSeed } from './core/pattern/prng';
import { appReducer, appStateFromDesign, initialAppState } from './core/state/reducer';
import { PRODUCTS } from './data/products';
import { designFromHash } from './embed/share';
import { probeTextures } from './render/textures';
import type { TextureMap } from './render/textures';
import { STR } from './strings';

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
    const shared = designFromHash(); // reopen a design shared via URL
    return shared ? appStateFromDesign(shared) : initialAppState(randomSeed());
  });
  const [textures, setTextures] = useState<TextureMap>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Probe for drop-in texture PNGs once at startup (falls back to hex).
  useEffect(() => {
    let live = true;
    probeTextures().then((map) => live && setTextures(map));
    return () => {
      live = false;
    };
  }, []);

  const design = state.present;
  const product = PRODUCTS[design.productId];
  const layout = useMemo(
    () => computeLayout(product, design.rows, design.cols, design.options),
    [product, design.rows, design.cols, design.options],
  );
  const schedule = useMemo(
    () => computeSchedule(product, layout, design.cells),
    [product, layout, design.cells],
  );

  // Keyboard undo/redo. Ignore while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <button className="menu-btn" onClick={() => setDrawerOpen(true)}>
        ☰ {STR.menu}
      </button>
      {drawerOpen && <div className="backdrop" onClick={() => setDrawerOpen(false)} />}
      <ControlPanel
        open={drawerOpen}
        state={state}
        product={product}
        layout={layout}
        schedule={schedule}
        textures={textures}
        dispatch={dispatch}
      />
      <WallPreview
        layout={layout}
        cells={design.cells}
        product={product}
        textures={textures}
        mode={state.ui.mode}
        brush={state.ui.brush}
        dispatch={dispatch}
      />
    </div>
  );
}
