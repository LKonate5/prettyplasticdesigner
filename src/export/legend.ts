import type { Schedule } from '../core/schedule';

/**
 * Draw the colour legend onto a raster export canvas — the same information the
 * on-screen PreviewLegend shows, so a shared PNG/JPEG explains its own colour
 * mix. Sized relative to the image so it reads at any resolution.
 */
export function drawLegend(ctx: CanvasRenderingContext2D, schedule: Schedule, pxW: number): void {
  const fs = Math.max(11, Math.min(30, Math.round(pxW / 70))); // font size
  const pad = Math.round(fs * 0.9);
  const rowH = Math.round(fs * 1.5);
  const sw = Math.round(fs * 0.9); // swatch size
  const margin = Math.round(fs * 1.2);

  const title = `Tile schedule · ${schedule.totalTiles} · ${schedule.areaM2.toFixed(1)} m²`;
  ctx.font = `600 ${fs}px Helvetica, Arial, sans-serif`;
  let boxW = ctx.measureText(title).width;
  ctx.font = `${fs}px Helvetica, Arial, sans-serif`;
  for (const r of schedule.rows) {
    const line = `${r.material.name}   ${r.count} · ${r.pct.toFixed(0)}%`;
    boxW = Math.max(boxW, sw + fs * 0.6 + ctx.measureText(line).width);
  }
  boxW = Math.ceil(boxW) + pad * 2;
  const boxH = pad * 2 + rowH + schedule.rows.length * rowH;

  // panel
  ctx.fillStyle = 'rgba(20,21,23,0.82)';
  ctx.fillRect(margin, margin, boxW, boxH);

  // title
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${fs}px Helvetica, Arial, sans-serif`;
  let y = margin + pad + rowH / 2;
  ctx.fillText(title, margin + pad, y);

  // rows
  ctx.font = `${fs}px Helvetica, Arial, sans-serif`;
  for (const r of schedule.rows) {
    y += rowH;
    const x = margin + pad;
    ctx.fillStyle = r.material.hex;
    ctx.fillRect(x, y - sw / 2, sw, sw);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.material.name, x + sw + fs * 0.5, y);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    const count = `${r.count} · ${r.pct.toFixed(0)}%`;
    ctx.fillText(count, margin + boxW - pad - ctx.measureText(count).width, y);
  }
}
