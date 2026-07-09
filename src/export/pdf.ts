import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Schedule } from '../core/schedule';
import type { ProductOptions, ProductSpec } from '../core/types';
import { renderRaster } from './raster';
import type { SceneInput } from './svg';

/**
 * One-page A4 spec sheet: header, the wall render, a specification table and
 * the material schedule. jsPDF + autotable — the whole sheet is one image and
 * two tables.
 */
export async function exportPdf(
  scene: SceneInput,
  schedule: Schedule,
  options: ProductOptions,
  filename: string,
  dateLabel: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  const product = scene.product;

  // Header band
  doc.setFillColor(28, 28, 30);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Pretty Plastic — Facade Design', margin, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${product.name}   ·   ${dateLabel}`, margin, 16.5);

  // Wall render (PNG rasterized at 2 px/mm, fitted into a box)
  const png = await renderPng(scene);
  const boxY = 28;
  const boxMaxH = 96;
  const aspect = schedule.wallW / schedule.wallH;
  let imgW = contentW;
  let imgH = imgW / aspect;
  if (imgH > boxMaxH) {
    imgH = boxMaxH;
    imgW = imgH * aspect;
  }
  const imgX = margin + (contentW - imgW) / 2;
  doc.addImage(png, 'PNG', imgX, boxY, imgW, imgH);
  doc.setTextColor(110, 109, 104);
  doc.setFontSize(8.5);
  doc.text(
    `Elevation — ${mmToM(schedule.wallW)} × ${mmToM(schedule.wallH)} m`,
    margin,
    boxY + imgH + 5,
  );

  // Specification table
  const specStart = boxY + imgH + 9;
  autoTable(doc, {
    startY: specStart,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2 },
    body: specRows(product, options, schedule),
    columnStyles: { 0: { textColor: [110, 109, 104] }, 1: { fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });

  // Material schedule
  autoTable(doc, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [['', 'Material', 'Tiles', '%', 'Weight (kg)']],
    body: schedule.rows.map((r) => ['', r.material.name, r.count, r.pct.toFixed(1), r.weightKg.toFixed(1)]),
    foot: [['', 'Total', schedule.totalTiles, '100', schedule.totalWeightKg.toFixed(1)]],
    theme: 'striped',
    headStyles: { fillColor: [28, 28, 30] },
    footStyles: { fillColor: [238, 236, 232], textColor: [28, 28, 30], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 1.6 },
    columnStyles: { 0: { cellWidth: 8 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: margin, right: margin },
    // swatch chip in column 0
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const row = schedule.rows[data.row.index];
        if (!row) return;
        const [r, g, b] = hexRgb(row.material.hex);
        doc.setFillColor(r, g, b);
        doc.rect(data.cell.x + 1.5, data.cell.y + 1.5, data.cell.width - 3, data.cell.height - 3, 'F');
      }
    },
  });

  // Footer
  const footY = 285;
  doc.setDrawColor(222, 219, 212);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);
  doc.setTextColor(110, 109, 104);
  doc.setFontSize(7.5);
  doc.text('Generated with the Pretty Plastic Facade Designer — prettyplastic.nl', margin, footY);
  doc.text(
    'Quantities include cut edge tiles and exclude site waste — verify before ordering.',
    margin,
    footY + 4,
  );

  doc.save(filename);
}

function specRows(product: ProductSpec, options: ProductOptions, s: Schedule): string[][] {
  const rows: string[][] = [
    ['Product', product.name],
    ['Tile size', `${product.tile.w} × ${product.tile.h} × ${product.tile.d} mm`],
    ['Weight / tile', `${product.weightKg} kg`],
    ['Coverage', `${product.nominalTilesPerM2} tiles/m²`],
  ];
  if (product.hasBond) rows.push(['Bond', options.bond === 'staggered' ? 'Staggered' : 'Stacked']);
  rows.push(
    ['Wall size', `${mmToM(s.wallW)} × ${mmToM(s.wallH)} m`],
    ['Area', `${s.areaM2.toFixed(2)} m²`],
    ['Total tiles', String(s.totalTiles)],
    ['Total weight', `${s.totalWeightKg.toFixed(1)} kg`],
  );
  return rows;
}

async function renderPng(scene: SceneInput): Promise<string> {
  const { blob } = await renderRaster(scene, 'png', 2);
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function mmToM(mm: number): string {
  return (mm / 1000).toFixed(2);
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
