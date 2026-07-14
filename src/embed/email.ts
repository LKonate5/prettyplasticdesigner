import { SALES_EMAIL } from '../config';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { ProductSpec } from '../core/types';
import { shareUrl } from './share';

const m = (mm: number) => (mm / 1000).toFixed(2);

/** Visitor details captured once per visit before their first export/email (see ExportMenu). */
export interface ExportLead {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
}

const leadLine = (lead: ExportLead): string =>
  `From: ${lead.firstName} ${lead.lastName} — ${lead.email} — ${lead.company}`;

/** Prefixes an outgoing email body with who the visitor is. */
export function withLead(lead: ExportLead, body: string): string {
  return `${leadLine(lead)}\n\n${body}`;
}

/** Internal notification sent when a visitor downloads a file (not the quote/sample flows). */
export function exportNotificationEmail(
  lead: ExportLead,
  formatLabel: string,
  product: ProductSpec,
  schedule: Schedule,
  design: DesignState,
) {
  const body = [
    `${lead.firstName} ${lead.lastName} just downloaded a ${formatLabel} of their facade design.`,
    '',
    leadLine(lead),
    '',
    ...projectLines(product, schedule, design),
    '',
    `Design link: ${shareUrl(design)}`,
  ].join('\n');
  return {
    subject: `${lead.firstName} ${lead.lastName} downloaded ${formatLabel} — Pretty Plastic Designer`,
    body,
  };
}

/** Shared project details used in both the sample and quote emails. */
export function projectLines(
  product: ProductSpec,
  schedule: Schedule,
  design: DesignState,
): string[] {
  return [
    `Product: ${product.name} (${product.tile.w}×${product.tile.h}×${product.tile.d} mm)`,
    `Wall size: ${m(schedule.wallW)} × ${m(schedule.wallH)} m (${schedule.roundedAreaM2} m²)`,
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

export interface SubmitEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Actually SEND the message via the server-side Resend integration
 * (api/send-email.ts), instead of just opening the visitor's own mail app.
 * Reliable regardless of whether the visitor's device has a mail client
 * configured. The Resend API key never reaches the browser.
 */
export async function submitEmail(
  subject: string,
  text: string,
  attachment?: { filename: string; contentBase64: string },
): Promise<SubmitEmailResult> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, text, attachment }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error ?? `Send failed (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the email service — check your connection.' };
  }
}

/** Strip the "data:...;base64," prefix a FileReader data URL carries. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

export function quoteEmail(product: ProductSpec, schedule: Schedule, design: DesignState, order: Order) {
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
    `Design link: ${shareUrl(design)}`,
    '',
    'Thank you!',
  ].join('\n');
  return { subject: `Quote request — Pretty Plastic ${product.name}`, body };
}
