import { useEffect, useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import type { Action } from '../core/state/actions';
import type { Cell, Layout, MaterialId, ProductSpec } from '../core/types';
import { materialIndex } from '../data/palette';
import { WallScene } from '../render/WallScene';
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

/**
 * Full-bleed live preview with paint/rotate interaction and zoom.
 *
 * Painting uses ONE delegated pointer handler: tiles carry data-cell
 * attributes and drags resolve the tile under the cursor with
 * document.elementFromPoint (pointer events would otherwise keep targeting
 * the first-touched element). A drag is bracketed by STROKE_START/END so it
 * lands as a single undo entry.
 *
 * Zoom: fit-to-view by default; +/− buttons or ctrl/cmd+wheel zoom (plain
 * scrolling is left alone so a page embed never hijacks scroll); when zoomed,
 * the container scrolls natively to pan.
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
  const [zoom, setZoom] = useState<number | null>(null); // px per mm; null = fit
  const containerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({ painting: false, lastCell: -1, back: false });

  const fitScale = (): number => {
    const el = containerRef.current;
    if (!el) return 0.2;
    return Math.min(el.clientWidth / layout.wallW, el.clientHeight / layout.wallH);
  };

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
      setZoom((z) => {
        const cur = z ?? fitScale();
        return Math.min(4, Math.max(0.02, cur * (e.deltaY < 0 ? 1.12 : 0.9)));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.wallW, layout.wallH]);

  const scene = (
    <WallScene
      layout={layout}
      cells={cells}
      product={product}
      textures={textures}
      width={zoom === null ? '100%' : layout.wallW * zoom}
      height={zoom === null ? '100%' : layout.wallH * zoom}
    />
  );

  return (
    <div className="preview" ref={containerRef} onPointerDown={onPointerDown}>
      {zoom === null ? <div className="preview-fit">{scene}</div> : scene}
      <div className="zoombar">
        <button onClick={() => setZoom((z) => (z ?? fitScale()) / 1.25)} title={STR.zoomOut}>
          −
        </button>
        <button onClick={() => setZoom(null)} title={STR.zoomFit}>
          ⤢
        </button>
        <button onClick={() => setZoom((z) => (z ?? fitScale()) * 1.25)} title={STR.zoomIn}>
          +
        </button>
      </div>
    </div>
  );
}
