import { jsPDF } from 'jspdf';
import { buildLayingPlan, type LaidTile, type LayingPlan } from '../core/laying';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { Cell, Layout, ProductOptions, ProductSpec, Pt } from '../core/types';
import type { ExportLead } from '../embed/email';
import { shareUrl } from '../embed/share';

/**
 * Laying plan: the sheet an installer takes on site. Every tile has a
 * coordinate (column letter + course number) and a colour code, so "what goes
 * where" can be read off paper. A3 landscape, vector throughout: one plan per
 * sheet at a standard scale (a big wall is split over several sheets), then a
 * course-by-course list. The data (coordinates, codes, cut edges) comes from
 * core/laying.ts; this file only draws it.
 */

export interface LayingPlanInput {
  product: ProductSpec;
  layout: Layout;
  cells: readonly Cell[];
  options: ProductOptions;
  schedule: Schedule;
  order: Order;
  design: DesignState;
  lead: ExportLead;
  dateLabel: string;
}

type RGB = [number, number, number];

const INK: RGB = [28, 28, 30];
const MUTED: RGB = [110, 109, 104];
const LINE: RGB = [222, 219, 212];
const WHITE: RGB = [255, 255, 255];
// Darker than the on-screen accent so white text and thin strokes stay legible on paper.
const ACCENT: RGB = [176, 74, 34];

const PAGE_W = 420;
const MARGIN = 12;
const FOOTER_Y = 287.5;
const BOTTOM = 285; // lowest y any content may reach

const SIDE_W = 100;
const SIDE_X = PAGE_W - MARGIN - SIDE_W;
const FRAME = { x: MARGIN, y: MARGIN, w: SIDE_X - 8 - MARGIN, h: BOTTOM - MARGIN };
const CAPTION_H = 6;
const AXIS = 9; // band for column letters / course numbers around the plan
const DRAW = {
  x: FRAME.x + AXIS,
  y: FRAME.y + CAPTION_H + AXIS,
  w: FRAME.w - AXIS * 2,
  h: FRAME.h - CAPTION_H - AXIS * 2,
};

// Standard scales, largest first. 1:25 is the smallest that keeps a code
// readable inside a tile; a wall that doesn't fit at 1:25 is split over sheets.
const SCALES = [5, 10, 15, 20, 25];

interface Span {
  from: number;
  to: number;
}

interface Sheet {
  number: number;
  cols: Span;
  courses: Span; // zero-based course indexes, bottom first
  colBand: number;
  courseBand: number;
}

export function exportLayingPlan(input: LayingPlanInput, filename: string): void {
  buildLayingPlanPdf(input).save(filename);
}

export function buildLayingPlanPdf(input: LayingPlanInput): jsPDF {
  const { product, layout } = input;
  const plan = buildLayingPlan(layout, input.cells);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  doc.setProperties({
    title: `Laying plan ; ${product.name} ${layout.cols} × ${layout.rows}`,
    subject: 'Pretty Plastic laying plan',
    creator: 'Pretty Plastic Façade Designer',
  });

  const { scale, sheets, colSpans, courseSpans } = planSheets(layout, plan);
  sheets.forEach((sheet, i) => {
    if (i > 0) doc.addPage();
    drawSheet(doc, input, plan, sheet, sheets.length, scale, colSpans, courseSpans);
  });
  doc.addPage();
  drawCourseList(doc, plan);
  drawFooters(doc);
  return doc;
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function planSheets(layout: Layout, plan: LayingPlan) {
  const fits = (n: number) => layout.wallW / n <= DRAW.w && layout.wallH / n <= DRAW.h;
  const scale = SCALES.find(fits) ?? SCALES[SCALES.length - 1];

  const colExtent = extents(plan.columnCount, (t) => t.columnIndex, 'x');
  const courseExtent = extents(plan.courses.length, (t) => t.course - 1, 'y');
  const colSpans = fits(scale) ? [{ from: 0, to: plan.columnCount - 1 }] : splitSpans(colExtent, DRAW.w * scale);
  const courseSpans = fits(scale)
    ? [{ from: 0, to: plan.courses.length - 1 }]
    : splitSpans(courseExtent, DRAW.h * scale);

  const sheets: Sheet[] = [];
  courseSpans.forEach((courses, courseBand) => {
    colSpans.forEach((cols, colBand) => {
      sheets.push({ number: sheets.length + 1, cols, courses, colBand, courseBand });
    });
  });
  return { scale, sheets, colSpans, courseSpans };

  function extents(count: number, indexOf: (t: LaidTile) => number, axis: 'x' | 'y') {
    const out = Array.from({ length: count }, () => ({ lo: Infinity, hi: -Infinity }));
    for (const t of plan.tiles) {
      const e = out[indexOf(t)];
      for (const p of t.tile.exportPolygon) {
        const v = axis === 'x' ? p[0] : p[1];
        e.lo = Math.min(e.lo, v);
        e.hi = Math.max(e.hi, v);
      }
    }
    return out;
  }
}

/** Greedy: as many consecutive indexes per sheet as fit in `cap` mm; never an empty sheet. */
function splitSpans(ext: Array<{ lo: number; hi: number }>, cap: number): Span[] {
  const spans: Span[] = [];
  let from = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < ext.length; i++) {
    const nextLo = Math.min(lo, ext[i].lo);
    const nextHi = Math.max(hi, ext[i].hi);
    if (i > from && nextHi - nextLo > cap) {
      spans.push({ from, to: i - 1 });
      from = i;
      lo = ext[i].lo;
      hi = ext[i].hi;
    } else {
      lo = nextLo;
      hi = nextHi;
    }
  }
  spans.push({ from, to: ext.length - 1 });
  return spans;
}

function drawSheet(
  doc: jsPDF,
  input: LayingPlanInput,
  plan: LayingPlan,
  sheet: Sheet,
  sheetCount: number,
  scale: number,
  colSpans: Span[],
  courseSpans: Span[],
): void {
  const { product, layout } = input;
  const inSheet = plan.tiles.filter(
    (t) =>
      t.columnIndex >= sheet.cols.from &&
      t.columnIndex <= sheet.cols.to &&
      t.course - 1 >= sheet.courses.from &&
      t.course - 1 <= sheet.courses.to,
  );

  // Extent of what this sheet shows, in wall mm. Sides that are the wall's own
  // edge use the true edge, so the outline is the wall and not ragged tiles.
  let xLo = Infinity;
  let xHi = -Infinity;
  let yLo = Infinity;
  let yHi = -Infinity;
  for (const t of inSheet) {
    for (const [x, y] of t.tile.exportPolygon) {
      xLo = Math.min(xLo, x);
      xHi = Math.max(xHi, x);
      yLo = Math.min(yLo, y);
      yHi = Math.max(yHi, y);
    }
  }
  const atLeft = sheet.colBand === 0;
  const atRight = sheet.colBand === colSpans.length - 1;
  const atBottom = sheet.courseBand === 0;
  const atTop = sheet.courseBand === courseSpans.length - 1;
  if (atLeft) xLo = 0;
  if (atRight) xHi = layout.wallW;
  if (atTop) yLo = 0;
  if (atBottom) yHi = layout.wallH;

  // Centre the drawing in the plan area.
  const ox = DRAW.x + (DRAW.w - (xHi - xLo) / scale) / 2 - xLo / scale;
  const oy = DRAW.y + (DRAW.h - (yHi - yLo) / scale) / 2 - yLo / scale;
  const X = (x: number) => ox + x / scale;
  const Y = (y: number) => oy + y / scale;
  const toPaper = (poly: readonly Pt[]): Pt[] => poly.map(([x, y]) => [X(x), Y(y)] as Pt);

  // Frame + caption
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.rect(FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Laying plan ; ${product.name}`, FRAME.x + 3, FRAME.y + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(`Sheet ${sheet.number} of ${sheetCount}`, FRAME.x + FRAME.w - 3, FRAME.y + 4.2, { align: 'right' });
  if (sheetCount > 1) {
    const sheetAt = (colBand: number, courseBand: number) => courseBand * colSpans.length + colBand + 1;
    const hints: string[] = [];
    if (!atLeft) hints.push(`Left: sheet ${sheetAt(sheet.colBand - 1, sheet.courseBand)}`);
    if (!atRight) hints.push(`Right: sheet ${sheetAt(sheet.colBand + 1, sheet.courseBand)}`);
    if (!atTop) hints.push(`Above: sheet ${sheetAt(sheet.colBand, sheet.courseBand + 1)}`);
    if (!atBottom) hints.push(`Below: sheet ${sheetAt(sheet.colBand, sheet.courseBand - 1)}`);
    doc.text(hints.join('   ·   '), FRAME.x + FRAME.w / 2, FRAME.y + 4.2, { align: 'center' });
  }

  // Tiles
  const tilePaperW = product.tile.w / scale;
  const codePt = Math.min(11, Math.max(6.5, tilePaperW * 0.42));
  doc.setLineWidth(0.25);
  doc.setLineJoin('round');
  for (const t of inSheet) {
    const rgb = hexRgb(t.material.hex);
    const poly = toPaper(t.tile.exportPolygon);
    doc.setFillColor(...rgb);
    doc.setDrawColor(...WHITE);
    polygon(doc, poly, 'FD');
    if (t.cutEdges.length > 0) hatch(doc, poly, mix(rgb, [0, 0, 0], 0.4), 1.6);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(codePt);
  for (const t of inSheet) {
    const poly = toPaper(t.tile.exportPolygon);
    const [cx, cy] = centroid(poly);
    const fg = labelColour(t.material.hex);
    doc.setTextColor(...fg);
    doc.text(t.code, cx, cy, { align: 'center', baseline: 'middle' });
    if (t.rotation !== 0) turnMarker(doc, cx, cy, tilePaperW / 2, t.rotation, fg);
  }

  // Wall edges (solid) ; sides that continue on another sheet get no line.
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  if (atLeft) doc.line(X(0), Y(yLo), X(0), Y(yHi));
  if (atRight) doc.line(X(layout.wallW), Y(yLo), X(layout.wallW), Y(yHi));
  if (atTop) doc.line(X(xLo), Y(0), X(xHi), Y(0));
  if (atBottom) doc.line(X(xLo), Y(layout.wallH), X(xHi), Y(layout.wallH));

  // Axes: column letters above and below, course numbers left and right.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  for (let i = sheet.cols.from; i <= sheet.cols.to; i++) {
    const x = X(plan.columnX[i]);
    const label = plan.tiles.find((t) => t.columnIndex === i)?.column ?? '';
    doc.text(label, x, Y(yLo) - 3, { align: 'center', baseline: 'middle' });
    doc.text(label, x, Y(yHi) + 3, { align: 'center', baseline: 'middle' });
  }
  for (let c = sheet.courses.from; c <= sheet.courses.to; c++) {
    const row = inSheet.filter((t) => t.course - 1 === c);
    if (row.length === 0) continue;
    const y = Y(courseCentreY(row));
    const label = String(c + 1).padStart(2, '0');
    doc.text(label, X(xLo) - 2.5, y, { align: 'right', baseline: 'middle' });
    doc.text(label, X(xHi) + 2.5, y, { align: 'left', baseline: 'middle' });
  }

  // Start marker beside course 01
  if (atBottom && atLeft) {
    const first = inSheet.filter((t) => t.course === 1);
    const y = Y(courseCentreY(first));
    doc.setFillColor(...ACCENT);
    const x = X(xLo) - 8.5;
    polygon(doc, [[x, y - 1.6], [x, y + 1.6], [x + 2.6, y]], 'F');
  }

  drawSidebar(doc, input, plan, sheet, sheetCount, scale, colSpans, courseSpans);
}

/** Middle of a course's visible band, wall mm (cut half rows sit lower/higher than their lattice line). */
function courseCentreY(row: LaidTile[]): number {
  let sum = 0;
  for (const t of row) {
    const ys = t.tile.exportPolygon.map((p) => p[1]);
    sum += (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  return sum / row.length;
}

/** Small triangle toward where the tile's top edge ends up after turning it. */
function turnMarker(doc: jsPDF, cx: number, cy: number, half: number, rotation: number, fg: RGB): void {
  const a = (rotation * Math.PI) / 180; // clockwise, y down
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const tip = half * 0.82;
  const base = half * 0.58;
  const wide = half * 0.15;
  doc.setFillColor(...fg);
  polygon(
    doc,
    [
      [cx + dx * tip, cy + dy * tip],
      [cx + dx * base + px * wide, cy + dy * base + py * wide],
      [cx + dx * base - px * wide, cy + dy * base - py * wide],
    ],
    'F',
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function drawSidebar(
  doc: jsPDF,
  input: LayingPlanInput,
  plan: LayingPlan,
  sheet: Sheet,
  sheetCount: number,
  scale: number,
  colSpans: Span[],
  courseSpans: Span[],
): void {
  const { product, layout, schedule, order, options, lead } = input;
  const x0 = SIDE_X;
  const x1 = SIDE_X + SIDE_W;
  let y = MARGIN;

  // Brand
  doc.setFillColor(...INK);
  doc.rect(x0, y, SIDE_W, 15, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Pretty Plastic', x0 + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Laying plan ; legpatroon', x0 + 4, y + 11.5);
  y += 20;

  // Title block
  heading(doc, 'Title block', x0, y);
  y += 4;
  const cutCount = plan.tiles.filter((t) => t.cutEdges.length > 0).length;
  const rows: Array<[string, string]> = [];
  if (lead.projectName) rows.push(['Project', lead.projectName]);
  rows.push(['Prepared for', [`${lead.firstName} ${lead.lastName}`.trim(), lead.company].filter(Boolean).join(', ')]);
  rows.push(['Product', product.name], ['Tile', `${product.tile.w} × ${product.tile.h} × ${product.tile.d} mm`]);
  if (product.hasBond) {
    rows.push(['Bond', options.bond === 'staggered' ? 'Staggered' : 'Stacked'], ['Exposure', `${options.exposure} mm`]);
  }
  rows.push(
    ['Wall', `${mmToM(layout.wallW)} × ${mmToM(layout.wallH)} m`],
    ['Area', `${schedule.areaM2.toFixed(2)} m² (${schedule.roundedAreaM2} m² rounded)`],
    ['Courses', `${plan.courses.length} (01 at the bottom)`],
    ['Tiles', `${schedule.totalTiles} (${cutCount} cut)`],
    ['To order', `${order.toOrderM2} m² incl. ${Math.round(order.wastePct * 100)}% waste`],
    ['Date', input.dateLabel],
  );
  const rowH = 4.4;
  doc.setFontSize(7.5);
  for (const [label, value] of rows) {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.line(x0, y + 0.8, x1, y + 0.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(label, x0, y + 3.7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(value, x0 + 24, y + 3.7, { maxWidth: SIDE_W - 24 });
    y += rowH;
  }
  doc.setDrawColor(...LINE);
  doc.line(x0, y + 0.8, x1, y + 0.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Design', x0, y + 3.7);
  doc.setTextColor(...ACCENT);
  doc.textWithLink('Open this design in the designer', x0 + 24, y + 3.7, { url: shareUrl(input.design) });
  y += rowH + 5;

  // Key plan, only when the wall runs over several sheets
  if (sheetCount > 1) {
    heading(doc, 'Sheets', x0, y);
    y += 3;
    y += drawKeyPlan(doc, plan, layout, sheet, colSpans, courseSpans, x0, y) + 5;
  }

  // Legend and quantities
  heading(doc, 'Legend and quantities', x0, y);
  y += 3.5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('COLOUR', x0, y + 2);
  doc.text('TILES', x1 - 14, y + 2, { align: 'right' });
  doc.text('%', x1, y + 2, { align: 'right' });
  y += 3.4;
  const legend = [...schedule.rows].sort((a, b) => b.count - a.count);
  const legendRowH = 4.6;
  const codeOf = new Map(plan.tiles.map((t) => [t.material.id, t.code]));
  for (const r of legend) {
    doc.setFillColor(...hexRgb(r.material.hex));
    doc.rect(x0, y, 11, legendRowH - 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...labelColour(r.material.hex));
    doc.text(codeOf.get(r.material.id) ?? '', x0 + 5.5, y + (legendRowH - 0.8) / 2, {
      align: 'center',
      baseline: 'middle',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(r.material.name, x0 + 14, y + (legendRowH - 0.8) / 2, { baseline: 'middle' });
    doc.text(String(r.count), x1 - 14, y + (legendRowH - 0.8) / 2, { align: 'right', baseline: 'middle' });
    doc.text(`${r.pct.toFixed(0)}%`, x1, y + (legendRowH - 0.8) / 2, { align: 'right', baseline: 'middle' });
    y += legendRowH;
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  doc.line(x0, y + 0.4, x1, y + 0.4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text('Total', x0 + 14, y + 3.6);
  doc.text(String(schedule.totalTiles), x1 - 14, y + 3.6, { align: 'right' });
  doc.text('100%', x1, y + 3.6, { align: 'right' });
  y += 4.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  const codeNote = doc.splitTextToSize(
    'Code = colour letter + shade (1 light, 2 medium, 3 dark). Y ochre, T terracotta, G green, S grey, B blue.',
    SIDE_W,
  ) as string[];
  doc.text(codeNote, x0, y + 1.8);
  y += codeNote.length * 2.8 + 5;

  // Notes
  heading(doc, 'Notes', x0, y);
  y += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  notesFor(input, plan).forEach((note, i) => {
    const lines = doc.splitTextToSize(note, SIDE_W - 5) as string[];
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}.`, x0, y + 2.4);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, x0 + 5, y + 2.4);
    y += lines.length * 3.2 + 1.2;
  });

  // Stamp
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(x0, BOTTOM - 7, x1, BOTTOM - 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(`A3 · 1:${scale} at 100%`, x0, BOTTOM - 2.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Sheet ${sheet.number} of ${sheetCount}`, x1, BOTTOM - 2.5, { align: 'right' });
}

function notesFor(input: LayingPlanInput, plan: LayingPlan): string[] {
  const { product } = input;
  const start = plan.courses[0]?.[0]?.id ?? '';
  const lastLetter = plan.tiles.find((t) => t.columnIndex === plan.columnCount - 1)?.column ?? '';
  const halfColumns =
    plan.courses.length > 1 && plan.courses[0][0].columnIndex % 2 !== plan.courses[1][0].columnIndex % 2;
  const notes = [
    `Start at ${start}, bottom left (marked with a triangle). Lay each course left to right, then move up one course.`,
  ];
  if (product.id !== 'second-high') notes.push('Each course laps over the one below it, so lay the wall from the bottom up.');
  if (halfColumns) {
    notes.push(
      `Columns are half a tile apart (A to ${lastLetter}), so a course only uses every other letter. Read a tile at its column letter and course number.`,
    );
  } else {
    notes.push(`Read a tile at its column letter (A to ${lastLetter}) and course number.`);
  }
  if (plan.tiles.some((t) => t.cutEdges.length > 0)) {
    notes.push('Hatched tiles are cut to the wall edge. Cut pieces on opposite edges share one colour.');
  }
  if (plan.tiles.some((t) => t.rotation !== 0)) {
    notes.push(
      'A triangle on a tile means it is turned: the triangle points to where the top edge of the tile ends up. Tiles without a triangle are not turned.',
    );
  }
  notes.push('Quantities include cut tiles and exclude site waste. Print at 100% ; the scale is only true at 100%.');
  return notes;
}

/** Thumbnail of the whole wall with its sheets numbered and this one highlighted. Returns its height. */
function drawKeyPlan(
  doc: jsPDF,
  plan: LayingPlan,
  layout: Layout,
  sheet: Sheet,
  colSpans: Span[],
  courseSpans: Span[],
  x0: number,
  y0: number,
): number {
  const k = Math.min((SIDE_W - 2) / layout.wallW, 26 / layout.wallH);

  // Boundaries between neighbouring sheets, wall mm.
  const colEdge = (i: number) => {
    if (i === 0) return 0;
    if (i === colSpans.length) return layout.wallW;
    return (plan.columnX[colSpans[i - 1].to] + plan.columnX[colSpans[i].from]) / 2;
  };
  // Course bands run bottom (index 0) to top; y is measured down from the top of the wall.
  const bandEdge = (i: number) => {
    if (i === 0) return layout.wallH;
    if (i === courseSpans.length) return 0;
    return (courseCentreY(plan.courses[courseSpans[i - 1].to]) + courseCentreY(plan.courses[courseSpans[i].from])) / 2;
  };

  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  courseSpans.forEach((_, band) => {
    colSpans.forEach((__, col) => {
      const xa = x0 + colEdge(col) * k;
      const xb = x0 + colEdge(col + 1) * k;
      const ya = y0 + bandEdge(band + 1) * k;
      const yb = y0 + bandEdge(band) * k;
      const current = band === sheet.courseBand && col === sheet.colBand;
      doc.setFillColor(...(current ? ACCENT : WHITE));
      doc.setDrawColor(...(current ? ACCENT : MUTED));
      doc.rect(xa, ya, xb - xa, yb - ya, 'FD');
      if (xb - xa > 5 && yb - ya > 3) {
        doc.setTextColor(...(current ? WHITE : INK));
        doc.text(String(band * colSpans.length + col + 1), (xa + xb) / 2, (ya + yb) / 2, {
          align: 'center',
          baseline: 'middle',
        });
      }
    });
  });
  return layout.wallH * k;
}

function heading(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.4 });
}

// ---------------------------------------------------------------------------
// Course list
// ---------------------------------------------------------------------------

function drawCourseList(doc: jsPDF, plan: LayingPlan): void {
  const LABEL_W = 64;
  const chipsX = MARGIN + LABEL_W;
  const chipsRight = PAGE_W - MARGIN;
  const chipH = 4.6;
  const lineH = 5.8;

  const header = (continued: boolean): number => {
    doc.setFillColor(...INK);
    doc.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, 12, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(continued ? 'Course list (continued)' : 'Course list', MARGIN + 4, MARGIN + 7.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      'Tiles in each course, left to right. Each tile: column letter · colour code. Hatched = cut to the wall edge.',
      PAGE_W - MARGIN - 4,
      MARGIN + 7.5,
      { align: 'right' },
    );
    return MARGIN + 18;
  };

  let y = header(false);
  for (const course of plan.courses) {
    // Lay the chips out first, so the row's height is known before the page break check.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const placed: Array<{ t: LaidTile; x: number; line: number; w: number; label: string }> = [];
    let cx = chipsX;
    let line = 0;
    for (const t of course) {
      const label = `${t.column}·${t.code}${t.rotation ? `·R${t.rotation}` : ''}`;
      const w = doc.getTextWidth(label) + 3.2;
      if (cx + w > chipsRight && cx > chipsX) {
        cx = chipsX;
        line++;
      }
      placed.push({ t, x: cx, line, w, label });
      cx += w + 1;
    }
    const rowH = (line + 1) * lineH + 2;
    if (y + rowH > BOTTOM) {
      doc.addPage();
      y = header(true);
    }

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y - 0.6, PAGE_W - MARGIN, y - 0.6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(`Course ${String(course[0].course).padStart(2, '0')}`, MARGIN, y + 3.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${course.length} tiles ; ${courseKind(course)}`, MARGIN + 21, y + 3.4, { maxWidth: LABEL_W - 22 });

    for (const p of placed) {
      const cy = y + p.line * lineH;
      const rgb = hexRgb(p.t.material.hex);
      doc.setFillColor(...rgb);
      doc.rect(p.x, cy, p.w, chipH, 'F');
      if (p.t.cutEdges.length > 0) {
        hatch(doc, [[p.x, cy], [p.x + p.w, cy], [p.x + p.w, cy + chipH], [p.x, cy + chipH]], mix(rgb, [0, 0, 0], 0.4), 1.4);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...labelColour(p.t.material.hex));
      doc.text(p.label, p.x + p.w / 2, cy + chipH / 2, { align: 'center', baseline: 'middle' });
    }
    y += rowH;
  }
}

function courseKind(course: LaidTile[]): string {
  if (course.every((t) => t.cutEdges.includes('top') || t.cutEdges.includes('bottom'))) {
    return `half-height, cut at the ${course[0].cutEdges.includes('top') ? 'top' : 'bottom'} edge`;
  }
  const first = course[0];
  const last = course[course.length - 1];
  return first.cutEdges.length > 0 && last.cutEdges.length > 0 ? 'ends cut to the wall edge' : 'whole tiles';
}

// ---------------------------------------------------------------------------
// Footer, drawing helpers
// ---------------------------------------------------------------------------

function drawFooters(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y, PAGE_W - MARGIN, FOOTER_Y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text('Generated with the Pretty Plastic Façade Designer ; prettyplastic.nl', MARGIN, FOOTER_Y + 4);
    doc.text(
      'Quantities include cut edge tiles and exclude site waste ; verify before ordering.',
      MARGIN,
      FOOTER_Y + 7.5,
    );
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, FOOTER_Y + 4, { align: 'right' });
  }
}

function polygon(doc: jsPDF, pts: readonly Pt[], style: 'F' | 'S' | 'FD'): void {
  const [x0, y0] = pts[0];
  const rel: number[][] = [];
  for (let i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  doc.lines(rel, x0, y0, [1, 1], style, true);
}

/**
 * 45° hatch lines across a convex polygon. Lines sit on a fixed grid (x + y a
 * multiple of `gap`), so neighbouring cut tiles continue each other's strokes.
 */
function hatch(doc: jsPDF, poly: readonly Pt[], colour: RGB, gap: number): void {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y] of poly) {
    lo = Math.min(lo, x + y);
    hi = Math.max(hi, x + y);
  }
  doc.setDrawColor(...colour);
  doc.setLineWidth(0.15);
  for (let c = Math.ceil(lo / gap) * gap; c < hi; c += gap) {
    const hits: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const [px, py] = poly[i];
      const [qx, qy] = poly[(i + 1) % poly.length];
      const sp = px + py - c;
      const sq = qx + qy - c;
      if (sp < 0 !== sq < 0) {
        const t = sp / (sp - sq);
        hits.push([px + (qx - px) * t, py + (qy - py) * t]);
      }
    }
    if (hits.length >= 2) doc.line(hits[0][0], hits[0][1], hits[1][0], hits[1][1]);
  }
}

function centroid(poly: readonly Pt[]): Pt {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(area) < 1e-9) {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  return [cx / (3 * area), cy / (3 * area)];
}

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Dark text on light tiles, white on dark ones. */
function labelColour(hex: string): RGB {
  const [r, g, b] = hexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? INK : WHITE;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round) as RGB;
}

function mmToM(mm: number): string {
  return (mm / 1000).toFixed(2);
}
