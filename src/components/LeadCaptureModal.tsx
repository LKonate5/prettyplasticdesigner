import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExportLead } from '../embed/email';
import { STR } from '../strings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One-time (per visit) lead-capture gate shown before the first export/email
 * action. Rendered via a portal straight into <body> so it always overlays
 * the whole viewport regardless of the control panel's own stacking context
 * (the mobile drawer transforms .panel, which would otherwise trap a
 * position:fixed child to that box instead of the real viewport).
 */
export function LeadCaptureModal({
  formatLabel,
  onSubmit,
  onCancel,
}: {
  formatLabel: string;
  onSubmit: (lead: ExportLead) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lead: ExportLead = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      company: company.trim(),
    };
    if (!lead.firstName || !lead.lastName || !lead.email || !lead.company) {
      setError(STR.exportLeadRequired);
      return;
    }
    if (!EMAIL_RE.test(lead.email)) {
      setError(STR.exportLeadInvalidEmail);
      return;
    }
    onSubmit(lead);
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal-card"
        noValidate
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{STR.exportLeadTitle}</h3>
        <p className="note" style={{ marginBottom: 2 }}>
          <strong>{formatLabel}</strong>
        </p>
        <p className="note">{STR.exportLeadHint}</p>

        <div className="field">
          <label htmlFor="lead-first-name">{STR.firstName}</label>
          <input
            id="lead-first-name"
            ref={firstInputRef}
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-last-name">{STR.lastName}</label>
          <input
            id="lead-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-email">{STR.contactEmail}</label>
          <input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-company">{STR.company}</label>
          <input
            id="lead-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        {error && <p className="warn">{error}</p>}

        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={onCancel}>
            {STR.exportLeadCancel}
          </button>
          <button type="submit" className="btn primary">
            {STR.exportLeadSubmit}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
