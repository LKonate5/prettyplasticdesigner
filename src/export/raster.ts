import type { Schedule } from '../core/schedule';
import { downloadBlob } from './download';
import { buildSceneSvg, type SceneInput } from './svg';

const MAX_EDGE = 8192; // Safari caps canvas dimensions ~8k; clamp the long edge.

export interface RasterResult {
  blob: Blob;
  width: number;
  height: number;
  clamped: boolean;
}

/** Rasterize an SVG string to a canvas at the requested px size. */
async function svgToCanvas(svg: string, pxW: number, pxH: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, pxW, pxH);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG rasterization failed'));
    img.src = url;
  });
}

function clampScale(wallW: number, wallH: number, pxPerMm: number) {
  const long = Math.max(wallW, wallH) * pxPerMm;
  const factor = long > MAX_EDGE ? MAX_EDGE / long : 1;
  return {
    pxW: Math.max(1, Math.round(wallW * pxPerMm * factor)),
    pxH: Math.max(1, Math.round(wallH * pxPerMm * factor)),
    clamped: factor < 1,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality),
  );
}

/** Produce a full-wall PNG/JPEG blob (no download). JPEG gets a white ground. */
export async function renderRaster(
  scene: SceneInput,
  format: 'png' | 'jpeg',
  pxPerMm: number,
  opts: { legend?: Schedule } = {},
): Promise<RasterResult> {
  const { wallW, wallH } = scene.layout;
  const { pxW, pxH, clamped } = clampScale(wallW, wallH, pxPerMm);
  const svg = await buildSceneSvg(scene, { mm: false });
  const canvas = await svgToCanvas(svg, pxW, pxH);
  const out = format === 'jpeg' ? withWhiteGround(canvas) : canvas;
  if (opts.legend) {
    const { drawLegend } = await import('./legend');
    drawLegend(out.getContext('2d')!, opts.legend, pxW);
  }
  const blob = await canvasToBlob(
    out,
    format === 'jpeg' ? 'image/jpeg' : 'image/png',
    format === 'jpeg' ? 0.92 : undefined,
  );
  return { blob, width: pxW, height: pxH, clamped };
}

/** Render a full-wall PNG/JPEG at `pxPerMm` (e.g. 1 = 1px/mm) and download it. */
export async function exportRaster(
  scene: SceneInput,
  format: 'png' | 'jpeg',
  pxPerMm: number,
  filename: string,
  opts: { legend?: Schedule } = {},
): Promise<RasterResult> {
  const result = await renderRaster(scene, format, pxPerMm, opts);
  downloadBlob(result.blob, filename);
  return result;
}

function withWhiteGround(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0);
  return canvas;
}

export interface SeamlessOutcome {
  ok: boolean;
  reason?: string;
  result?: RasterResult;
}

/**
 * Seamless / tileable PNG. The wall is now tileable by construction — wrap
 * partner tiles share a colour, so a half-tile at one edge matches its partner
 * at the opposite edge. So we just render the wall and crop to one period (=
 * the wall size). `torusPeriod` is null when the settings can't tile cleanly
 * (odd rows on an offset bond), in which case we return a reason rather than a
 * misleading image.
 */
export async function exportSeamless(
  scene: SceneInput,
  pxPerMm: number,
  filename: string,
): Promise<SeamlessOutcome> {
  const period = scene.layout.torusPeriod;
  if (!period) {
    return { ok: false, reason: 'This layout can’t tile seamlessly — use an even row count.' };
  }
  const { pxW, pxH, clamped } = clampScale(period.w, period.h, pxPerMm);
  const svg = await buildSceneSvg(scene, { mm: false });
  const canvas = await svgToCanvas(svg, pxW, pxH);
  const blob = await canvasToBlob(canvas, 'image/png');
  downloadBlob(blob, filename);
  return { ok: true, result: { blob, width: pxW, height: pxH, clamped } };
}
