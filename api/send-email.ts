import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendEmail } from './_lib/sendEmail.js';

/**
 * POST /api/send-email — the only place RESEND_API_KEY is used. The browser
 * never sees it; it lives in the deployment's environment variables (Vercel
 * project settings, or .env locally, both gitignored).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawAttachment = body.attachment as Record<string, unknown> | undefined;

  const result = await sendEmail({
    subject: typeof body.subject === 'string' ? body.subject : '',
    text: typeof body.text === 'string' ? body.text : '',
    attachment:
      rawAttachment && typeof rawAttachment === 'object'
        ? {
            filename: String(rawAttachment.filename ?? ''),
            contentBase64: String(rawAttachment.contentBase64 ?? ''),
          }
        : undefined,
  });

  res.status(result.ok ? 200 : 400).json(result);
}

function applyCors(req: VercelRequest, res: VercelResponse) {
  const rawOrigin = req.headers.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
  if (!origin || !isAllowedOrigin(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function isAllowedOrigin(origin: string): boolean {
  return (
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
    /^https:\/\/prettyplasticdesigner([-.][a-z0-9-]+)*\.vercel\.app$/.test(origin)
  );
}
