import { Resend } from 'resend';
import { SALES_EMAIL } from '../../src/config';

/**
 * Server-only Resend integration. This file lives under api/ (never imported
 * by src/, never bundled into the browser), so RESEND_API_KEY stays private —
 * the browser only ever talks to /api/send-email.ts, which calls this.
 *
 * The recipient is fixed to SALES_EMAIL here, not client-supplied, so this
 * endpoint can never be used to relay mail to an arbitrary address using
 * Pretty Plastic's Resend account.
 */

// Resend's shared testing sender — works without verifying a domain, but has
// no reputation of its own, so mail lands in spam (confirmed by a test send).
// send.prettyplastic.nl already has SPF/DKIM DNS records, but Resend still
// reports it as unverified — the domain needs to be added under
// https://resend.com/domains before FROM_EMAIL can switch to it.
const FROM_EMAIL = 'onboarding@resend.dev';

const MAX_SUBJECT = 200;
const MAX_TEXT = 20_000;
const MAX_ATTACHMENT_FILENAME = 100;
const MAX_ATTACHMENT_BASE64 = 6_000_000; // ~4.5 MB decoded — a wall preview image, not the full-res download

export interface SendEmailInput {
  subject: string;
  text: string;
  attachment?: { filename: string; contentBase64: string };
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Email sending is not configured (missing RESEND_API_KEY).' };
  }

  const subject = input.subject.trim();
  const text = input.text.trim();
  if (!subject || subject.length > MAX_SUBJECT) {
    return { ok: false, error: 'Invalid subject.' };
  }
  if (!text || text.length > MAX_TEXT) {
    return { ok: false, error: 'Invalid message body.' };
  }

  let attachments: { filename: string; content: string }[] | undefined;
  if (input.attachment) {
    const { filename, contentBase64 } = input.attachment;
    if (!filename || filename.length > MAX_ATTACHMENT_FILENAME) {
      return { ok: false, error: 'Invalid attachment filename.' };
    }
    if (!contentBase64 || contentBase64.length > MAX_ATTACHMENT_BASE64) {
      return { ok: false, error: 'Attachment is too large.' };
    }
    attachments = [{ filename, content: contentBase64 }];
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: SALES_EMAIL,
    subject,
    text,
    attachments,
  });

  if (error) return { ok: false, error: error.message || 'Resend rejected the email.' };
  return { ok: true, id: data?.id ?? '' };
}
