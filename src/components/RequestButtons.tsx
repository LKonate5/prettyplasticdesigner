import { useState } from 'react';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { ProductSpec } from '../core/types';
import { openMail, quoteEmail, sampleEmail } from '../embed/email';
import type { SceneInput } from '../export/svg';
import { STR } from '../strings';

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

  const requestSample = () => {
    const { subject, body } = sampleEmail(product, schedule, design);
    openMail(subject, body);
  };

  const requestQuote = async () => {
    setBusy(true);
    try {
      const { exportRaster } = await import('../export/raster');
      await exportRaster(scene, 'png', 2, `pretty-plastic_${product.id}_wall.png`, {
        legend: schedule,
      });
    } catch {
      /* if the render fails we still open the email */
    }
    setBusy(false);
    const { subject, body } = quoteEmail(product, schedule, design, order, { withImageNote: true });
    openMail(subject, body);
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
