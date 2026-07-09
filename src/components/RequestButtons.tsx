import { useState } from 'react';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { ProductSpec } from '../core/types';
import { shareUrl } from '../embed/share';
import type { SceneInput } from '../export/svg';
import { SALES_EMAIL } from '../config';
import { STR } from '../strings';

const m = (mm: number) => (mm / 1000).toFixed(2);

function projectLines(product: ProductSpec, schedule: Schedule, design: DesignState): string[] {
  return [
    `Product: ${product.name} (${product.tile.w}×${product.tile.h}×${product.tile.d} mm)`,
    `Wall size: ${m(schedule.wallW)} × ${m(schedule.wallH)} m (${schedule.areaM2.toFixed(2)} m²)`,
    design.productId === 'basic-third'
      ? `Visible row height: ${design.options.exposure} mm, ${design.options.bond} bond`
      : '',
    '',
    'Colours used:',
    ...schedule.rows.map((r) => `  • ${r.material.name}: ${r.count} tiles (${r.pct.toFixed(0)}%)`),
  ].filter((l) => l !== '');
}

function openMail(subject: string, body: string): void {
  const href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const a = document.createElement('a');
  a.href = href;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * "Request a sample" and "Request a quote" — both open a pre-filled email to
 * Pretty Plastic with the project details. The quote focuses on order
 * quantities + pricing and first downloads the wall image so the user can
 * attach it (email links can't carry a file attachment themselves).
 */
export function RequestButtons({
  design,
  product,
  schedule,
  order,
  scene,
}: {
  design: DesignState;
  product: ProductSpec;
  schedule: Schedule;
  order: Order;
  scene: SceneInput;
}) {
  const [busy, setBusy] = useState(false);
  const link = shareUrl(design);

  const requestSample = () => {
    const body = [
      'Hi Pretty Plastic,',
      '',
      'I would like to request samples for the following facade design:',
      '',
      ...projectLines(product, schedule, design),
      '',
      `Design link: ${link}`,
      '',
      'Please let me know how to receive the samples. Thank you!',
    ].join('\n');
    openMail(`Sample request — Pretty Plastic ${product.name}`, body);
  };

  const requestQuote = async () => {
    setBusy(true);
    try {
      const { exportRaster } = await import('../export/raster');
      await exportRaster(scene, 'png', 2, `pretty-plastic_${product.id}_wall.png`);
    } catch {
      /* if the render fails we still open the email */
    }
    setBusy(false);

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
      STR.quoteImageNote,
      `Design link: ${link}`,
      '',
      'Thank you!',
    ]
      .filter((l) => l !== '')
      .join('\n');
    openMail(`Quote request — Pretty Plastic ${product.name}`, body);
  };

  return (
    <div className="section">
      <div className="row">
        <button className="btn primary" onClick={requestSample}>
          {STR.requestSample}
        </button>
        <button className="btn primary" disabled={busy} onClick={requestQuote}>
          {busy ? '…' : STR.requestQuote}
        </button>
      </div>
      <p className="note">{STR.requestHint}</p>
    </div>
  );
}
