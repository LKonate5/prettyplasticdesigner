import { SALES_EMAIL } from '../config';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { ProductSpec } from '../core/types';
import { STR } from '../strings';
import { shareUrl } from './share';

const m = (mm: number) => (mm / 1000).toFixed(2);

/** Shared project details used in both the sample and quote emails. */
export function projectLines(
  product: ProductSpec,
  schedule: Schedule,
  design: DesignState,
): string[] {
  return [
    `Product: ${product.name} (${product.tile.w}×${product.tile.h}×${product.tile.d} mm)`,
    `Wall size: ${m(schedule.wallW)} × ${m(schedule.wallH)} m (${schedule.areaM2.toFixed(2)} m²)`,
    design.productId === 'basic-third' ? `Bond: ${design.options.bond}` : '',
    '',
    'Colours used:',
    ...schedule.rows.map((r) => `  • ${r.material.name}: ${r.count} tiles (${r.pct.toFixed(0)}%)`),
  ].filter((l) => l !== '');
}

/** Open the visitor's email app with a pre-filled message to Pretty Plastic. */
export function openMail(subject: string, body: string): void {
  const href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const a = document.createElement('a');
  a.href = href;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function sampleEmail(product: ProductSpec, schedule: Schedule, design: DesignState) {
  const body = [
    'Hi Pretty Plastic,',
    '',
    'I would like to request samples for the following facade design:',
    '',
    ...projectLines(product, schedule, design),
    '',
    `Design link: ${shareUrl(design)}`,
    '',
    'Please let me know how to receive the samples. Thank you!',
  ].join('\n');
  return { subject: `Sample request — Pretty Plastic ${product.name}`, body };
}

export function quoteEmail(
  product: ProductSpec,
  schedule: Schedule,
  design: DesignState,
  order: Order,
  opts: { withImageNote?: boolean } = {},
) {
  const body = [
    'Hi Pretty Plastic,',
    '',
    'Please could you quote the following facade design (pricing + availability)?',
    '',
    ...projectLines(product, schedule, design),
    '',
    `To order (incl. ${Math.round(order.wastePct * 100)}% waste): ${order.toOrderM2} m²`,
    `Pallets: ${order.pallets} (${order.palletM2} m² per europallet)`,
    `Approx. weight: ${order.weightKg} kg`,
    '',
    opts.withImageNote ? STR.quoteImageNote : '',
    `Design link: ${shareUrl(design)}`,
    '',
    'Thank you!',
  ]
    .filter((l) => l !== '')
    .join('\n');
  return { subject: `Quote request — Pretty Plastic ${product.name}`, body };
}
