import { useState } from 'react';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { ProductSpec } from '../core/types';
import type { ExportLead, LeadRequestContext } from '../embed/email';
import { blobToBase64, openMail, quoteEmail, sampleEmail, submitEmail, withLead } from '../embed/email';
import type { SceneInput } from '../export/svg';
import { EmailPreviewModal } from './EmailPreviewModal';
import { STR } from '../strings';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'sent' } | { kind: 'error'; message: string };
type Preview = { kind: 'sample' | 'quote'; subject: string; body: string };

const QUOTE_ATTACHMENT_PX_PER_MM = 0.45;
const QUOTE_ATTACHMENT_MAX_EDGE = 1600;
const QUOTE_ATTACHMENT_JPEG_QUALITY = 0.76;
const QUOTE_ATTACHMENT_MAX_BASE64 = 2_500_000; // keep the full JSON request comfortably below Vercel's body limit

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
  requireLead: (
    label: string,
    onReady: (lead: ExportLead) => void,
    request?: LeadRequestContext,
  ) => void;
}) {
  const [sampleStatus, setSampleStatus] = useState<Status>({ kind: 'idle' });
  const [quoteStatus, setQuoteStatus] = useState<Status>({ kind: 'idle' });
  const [preview, setPreview] = useState<Preview | null>(null);
  const defaultSampleMaterials = [...schedule.rows]
    .sort((a, b) => b.count - a.count)
    .map((row) => row.material.id)
    .slice(0, 5);

  const openSamplePreview = () => {
    requireLead(
      STR.requestSample,
      (lead) => {
        const { subject, body } = sampleEmail(product, schedule, design, lead.sample);
        setPreview({ kind: 'sample', subject, body: withLead(lead, body) });
      },
      {
        mode: 'sample',
        sampleDefaults: {
          streetName: '',
          streetNumber: '',
          streetAddition: '',
          postalCode: '',
          city: '',
          country: '',
          selections: [{ productId: product.id, materialIds: defaultSampleMaterials }],
        },
      },
    );
  };

  const openQuotePreview = () => {
    requireLead(
      STR.requestQuote,
      (lead) => {
        const { subject, body } = quoteEmail(product, schedule, design, order, lead.quote);
        setPreview({ kind: 'quote', subject, body: withLead(lead, body) });
      },
      {
        mode: 'quote',
        quoteDefaults: { requestedAreaM2: order.toOrderM2, productIds: [product.id] },
      },
    );
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
      const { blob } = await renderRaster(scene, 'jpeg', QUOTE_ATTACHMENT_PX_PER_MM, {
        legend: schedule,
        maxEdge: QUOTE_ATTACHMENT_MAX_EDGE,
        quality: QUOTE_ATTACHMENT_JPEG_QUALITY,
      });
      const contentBase64 = await blobToBase64(blob);
      const attachment =
        contentBase64.length <= QUOTE_ATTACHMENT_MAX_BASE64
          ? { filename: `pretty-plastic_${product.id}_wall.jpg`, contentBase64 }
          : undefined;
      const message = attachment
        ? body
        : `${body}\n\nPreview image omitted because the generated wall image was too large for email. The design link above remains available.`;
      const result = await submitEmail(subject, message, attachment);
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
