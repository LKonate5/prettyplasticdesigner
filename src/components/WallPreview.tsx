import { useEffect, useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import type { Action } from '../core/state/actions';
import type { Cell, Layout, MaterialId, ProductSpec } from '../core/types';
import { materialIndex } from '../data/palette';
import { WallScene, type ViewBox } from '../render/WallScene';
import type { TextureMap } from '../render/textures';
import { STR } from '../strings';

interface WallPreviewProps {
  layout: Layout;
  cells: readonly Cell[];
  product: ProductSpec;
  textures: TextureMap;
  mode: 'paint' | 'rotate';
  brush: MaterialId;
  dispatch: Dispatch<Action>;
}

// Keep the filled preview responsive: cap the total tiles drawn across repeats.
const MAX_RENDERED_TILES = 9000;
// Leave a margin of continuing pattern around the wall so its frame is always
// visible on all four sides (the wall never touches the preview edges).
const FIT_MARGIN = 0.78;

/**
 * Full-bleed live preview. The wall pattern FILLS the whole area edge-to-edge
 * (no black bars) by repeating the tileable pattern around the actual wall, and
 * a frame marks the wall the user set. Paint/rotate work on any tile (repeats
 * share the same cell, so edits stay tileable).
 *
 * Painting uses ONE delegated pointer handler: tiles carry data-cell attributes
 * and drags resolve the tile under the cursor with document.elementFromPoint. A
 * drag is bracketed by STROKE_START/END so it lands as a single undo entry.
 *
 * Zoom: +/− buttons or ctrl/cmd+wheel scale the pattern; Fit resets. The view
 * stays centred on the wall.
 */
export function WallPreview({
  layout,
  cells,
  product,
  textures,
  mode,
  brush,
  dispatch,
}: WallPreviewProps) {
  const { wallW, wallH } = layout;
  const [zoomFactor, setZoomFactor] = useState(1); // multiplier on the fit scale
  const [size, setSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({ painting: false, lastCell: -1, back: false });

  // Track the container size so we can fill it exactly.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyAt = (target: Element | null) => {
    const el = target?.closest?.('[data-cell]');
    if (!el) return;
    const cellIndex = Number(el.getAttribute('data-cell'));
    if (cellIndex === gesture.current.lastCell) return;
    gesture.current.lastCell = cellIndex;
    if (mode === 'paint') {
      dispatch({ type: 'PAINT_CELL', cellIndex, material: materialIndex(brush) });
    } else {
      dispatch({ type: 'ROTATE_CELL', cellIndex, delta: gesture.current.back ? -1 : 1 });
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (!(e.target as Element).closest?.('[data-cell]')) return;
    e.preventDefault();
    gesture.current = { painting: true, lastCell: -1, back: e.shiftKey };
    dispatch({ type: 'STROKE_START' });
    applyAt(e.target as Element);
    const move = (ev: PointerEvent) => {
      if (!gesture.current.painting) return;
      applyAt(document.elementFromPoint(ev.clientX, ev.clientY));
    };
    const end = () => {
      gesture.current.painting = false;
      dispatch({ type: 'STROKE_END' });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoomFactor((z) => clampZoom(z * (e.deltaY < 0 ? 1.12 : 0.9)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Compute the visible mm region + the repeats needed to fill it.
  const cw = size.w || 800;
  const ch = size.h || 600;
  const fitScale = (Math.min(cw / wallW, ch / wallH) || 0.2) * FIT_MARGIN;
  const scale = fitScale * zoomFactor;
  const vbW = cw / scale;
  const vbH = ch / scale;
  const view: ViewBox = { x: wallW / 2 - vbW / 2, y: wallH / 2 - vbH / 2, w: vbW, h: vbH };

  let offsets: Array<[number, number]> = [];
  const iMax = Math.floor((view.x + vbW) / wallW);
  const iMin = Math.floor(view.x / wallW);
  const jMax = Math.floor((view.y + vbH) / wallH);
  const jMin = Math.floor(view.y / wallH);
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) offsets.push([i * wallW, j * wallH]);
  }
  // Perf guard: if the fill would draw too many tiles, show just the wall.
  if (offsets.length * layout.tiles.length > MAX_RENDERED_TILES) offsets = [[0, 0]];

  return (
    <div className="preview fill" ref={containerRef} onPointerDown={onPointerDown}>
      <WallScene
        layout={layout}
        cells={cells}
        product={product}
        textures={textures}
        width="100%"
        height="100%"
        view={view}
        tileOffsets={offsets}
        frame
      />
      <div className="zoombar">
        <button onClick={() => setZoomFactor((z) => clampZoom(z / 1.25))} title={STR.zoomOut}>
          −
        </button>
        <button onClick={() => setZoomFactor(1)} title={STR.zoomFit}>
          ⤢
        </button>
        <button onClick={() => setZoomFactor((z) => clampZoom(z * 1.25))} title={STR.zoomIn}>
          +
        </button>
      </div>
    </div>
  );
}

function clampZoom(z: number): number {
  return Math.min(6, Math.max(0.25, z));
}
