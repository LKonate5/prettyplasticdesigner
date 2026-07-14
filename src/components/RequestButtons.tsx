import { useState } from 'react';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { ProductSpec } from '../core/types';
import type { ExportLead } from '../embed/email';
import { blobToBase64, openMail, quoteEmail, sampleEmail, submitEmail, withLead } from '../embed/email';
import type { SceneInput } from '../export/svg';
import { EmailPreviewModal } from './EmailPreviewModal';
import { STR } from '../strings';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'sent' } | { kind: 'error'; message: string };
type Preview = { kind: 'sample' | 'quote'; subject: string; body: string };

const ATTACHMENT_PX_PER_MM = 0.6; // modest size: readable, but a light email attachment

/**
 * "Request a sample" and "Request a quote" — both actually SEND an email to
 * Pretty Plastic via the server-side Resend integration (api/send-email.ts),
 * so it works regardless of whether the visitor's device has a mail app
 * configured. If sending fails for any reason, they fall back to opening the
 * visitor's own mail client with the same message pre-filled (the old
 * behaviour), so a misconfigured/offline backend never leaves someone stuck.
 *
 * Before either send, the shared lead-capture gate runs (see ControlPanel),
 * then the visitor sees the pre-filled message in EmailPreviewModal — they can
 * edit it or just send it as-is, same as a normal mailto: draft always let you.
 */
export function RequestButtons({
  design,
  product,
  schedule,
  order,
  scene,
  requireLead,
}: {
  design: DesignState;
  product: ProductSpec;
  schedule: Schedule;
  order: Order;
  scene: SceneInput;
  /** Shared with ExportMenu — asks once per visit (see ControlPanel). */
  requireLead: (label: string, onReady: (lead: ExportLead) => void) => void;
}) {
  const [sampleStatus, setSampleStatus] = useState<Status>({ kind: 'idle' });
  const [quoteStatus, setQuoteStatus] = useState<Status>({ kind: 'idle' });
  const [preview, setPreview] = useState<Preview | null>(null);

  const openSamplePreview = () => {
    requireLead(STR.requestSample, (lead) => {
      const { subject, body } = sampleEmail(product, schedule, design);
      setPreview({ kind: 'sample', subject, body: withLead(lead, body) });
    });
  };

  const openQuotePreview = () => {
    requireLead(STR.requestQuote, (lead) => {
      const { subject, body } = quoteEmail(product, schedule, design, order);
      setPreview({ kind: 'quote', subject, body: withLead(lead, body) });
    });
  };

  const sendSample = async (subject: string, body: string) => {
    setPreview(null);
    setSampleStatus({ kind: 'busy' });
    const result = await submitEmail(subject, body);
    if (result.ok) {
      setSampleStatus({ kind: 'sent' });
    } else {
      openMail(subject, body); // fallback: visitor's own mail app, same content
      setSampleStatus({ kind: 'error', message: `${STR.emailFallback} (${result.error})` });
    }
  };

  const sendQuote = async (subject: string, body: string) => {
    setPreview(null);
    setQuoteStatus({ kind: 'busy' });
    try {
      const { renderRaster } = await import('../export/raster');
      const { blob } = await renderRaster(scene, 'png', ATTACHMENT_PX_PER_MM, { legend: schedule });
      const contentBase64 = await blobToBase64(blob);
      const filename = `pretty-plastic_${product.id}_wall.png`;
      const result = await submitEmail(subject, body, { filename, contentBase64 });
      if (result.ok) {
        setQuoteStatus({ kind: 'sent' });
        return;
      }
      throw new Error(result.error);
    } catch (err) {
      // fallback: download the image + open mail app, same as before the API existed
      try {
        const { exportRaster } = await import('../export/raster');
        await exportRaster(scene, 'png', 2, `pretty-plastic_${product.id}_wall.png`, {
          legend: schedule,
        });
      } catch {
        /* image render failed too — still offer the mailto with the text-only body */
      }
      openMail(subject, `${body}\n\n${STR.quoteImageNote}`);
      setQuoteStatus({ kind: 'error', message: `${STR.emailFallback} (${(err as Error).message})` });
    }
  };

  return (
    <div className="section">
      <div className="row">
        <button className="btn primary" disabled={sampleStatus.kind === 'busy'} onClick={openSamplePreview}>
          {sampleStatus.kind === 'busy' ? '…' : STR.requestSample}
        </button>
        <button className="btn primary" disabled={quoteStatus.kind === 'busy'} onClick={openQuotePreview}>
          {quoteStatus.kind === 'busy' ? '…' : STR.requestQuote}
        </button>
      </div>
      {sampleStatus.kind === 'sent' && <p className="note">{STR.emailSent}</p>}
      {sampleStatus.kind === 'error' && <p className="warn">{sampleStatus.message}</p>}
      {quoteStatus.kind === 'sent' && <p className="note">{STR.emailSent}</p>}
      {quoteStatus.kind === 'error' && <p className="warn">{quoteStatus.message}</p>}
      <p className="note">{STR.requestHint}</p>
      {preview && (
        <EmailPreviewModal
          subject={preview.subject}
          body={preview.body}
          onCancel={() => setPreview(null)}
          onSend={(subject, body) =>
            void (preview.kind === 'sample' ? sendSample(subject, body) : sendQuote(subject, body))
          }
        />
      )}
    </div>
  );
}
