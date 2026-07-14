import { useState } from 'react';
import { createPortal } from 'react-dom';
import { STR } from '../strings';

/**
 * Shows the pre-filled sample/quote email before it actually sends, so the
 * visitor can personalize it (or just send it as-is) — mirroring what a real
 * mailto: draft always allowed, now that these go straight out via the
 * server-side Resend integration instead of opening the visitor's own client.
 */
export function EmailPreviewModal({
  subject: initialSubject,
  body: initialBody,
  onSend,
  onCancel,
}: {
  subject: string;
  body: string;
  onSend: (subject: string, body: string) => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{STR.emailPreviewTitle}</h3>
        <p className="note">{STR.emailPreviewHint}</p>

        <div className="field">
          <label htmlFor="preview-subject">{STR.emailPreviewSubject}</label>
          <input
            id="preview-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="preview-body">{STR.emailPreviewBody}</label>
          <textarea
            id="preview-body"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={onCancel}>
            {STR.exportLeadCancel}
          </button>
          <button type="button" className="btn primary" onClick={() => onSend(subject, body)}>
            {STR.emailPreviewSend}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
