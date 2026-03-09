import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function — /api/send-email
 *
 * Proxy sécurisé pour l'envoi d'emails.
 * Les credentials restent côté serveur et ne sont jamais exposés au navigateur.
 *
 * POST /api/send-email
 * Body JSON :
 * {
 *   to: string,
 *   toName?: string,
 *   subject: string,
 *   htmlContent: string,
 *   provider: 'microsoft' | 'google' | 'sendgrid',
 *   credentials: {
 *     email?: string,        // Microsoft / Google
 *     appPassword?: string,  // Microsoft / Google
 *     fromName?: string,
 *     apiKey?: string,       // SendGrid
 *     fromEmail?: string,    // SendGrid
 *   },
 *   attachments?: { filename: string; content: string; type: string }[]
 * }
 */

import nodemailer from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: string; // base64
  type: string;
}

interface SendEmailBody {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  provider: 'microsoft' | 'google' | 'sendgrid';
  credentials: {
    email?: string;
    appPassword?: string;
    fromName?: string;
    apiKey?: string;
    fromEmail?: string;
  };
  attachments?: EmailAttachment[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Respond 200 to CORS preflight requests
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { to, toName, subject, htmlContent, provider, credentials, attachments } = (req.body ?? {}) as Partial<SendEmailBody>;

  if (!to || !subject || !htmlContent || !provider || !credentials) {
    return res.status(400).json({
      error: 'Missing required fields: to, subject, htmlContent, provider, credentials',
    });
  }

  try {
    if (provider === 'microsoft') {
      // ── Microsoft Outlook / Exchange via SMTP (App Password) ─────────────
      const { email, appPassword, fromName } = credentials;

      if (!email || !appPassword) {
        return res.status(400).json({
          error: 'Microsoft Outlook requires email and appPassword credentials.',
        });
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user: email, pass: appPassword },
      });

      const mailAttachments = attachments?.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.type,
      }));

      const info = await transporter.sendMail({
        from: fromName ? `"${fromName}" <${email}>` : email,
        to: toName ? `"${toName}" <${to}>` : to,
        subject,
        html: htmlContent,
        ...(mailAttachments ? { attachments: mailAttachments } : {}),
      });

      return res.status(200).json({
        success: true,
        messageId: info.messageId ?? `ms_${Date.now()}`,
        provider: 'microsoft',
      });

    } else if (provider === 'google') {
      // ── Google Gmail via SMTP (App Password) ─────────────────────────────
      const { email, appPassword, fromName } = credentials;

      if (!email || !appPassword) {
        return res.status(400).json({
          error: 'Google Gmail requires email and appPassword credentials.',
        });
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: email, pass: appPassword },
      });

      const mailAttachments = attachments?.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.type,
      }));

      const info = await transporter.sendMail({
        from: fromName ? `"${fromName}" <${email}>` : email,
        to: toName ? `"${toName}" <${to}>` : to,
        subject,
        html: htmlContent,
        ...(mailAttachments ? { attachments: mailAttachments } : {}),
      });

      return res.status(200).json({
        success: true,
        messageId: info.messageId ?? `gmail_${Date.now()}`,
        provider: 'google',
      });

    } else if (provider === 'sendgrid') {
      // ── SendGrid REST API ─────────────────────────────────────────────────
      const { apiKey, fromEmail, fromName } = credentials;

      if (!apiKey || !fromEmail) {
        return res.status(400).json({
          error: 'SendGrid requires apiKey and fromEmail credentials.',
        });
      }

      const body = {
        personalizations: [{ to: [{ email: to, name: toName ?? to }] }],
        from: { email: fromEmail, name: fromName ?? fromEmail },
        subject,
        content: [{ type: 'text/html', value: htmlContent }],
        ...(attachments && attachments.length > 0
          ? {
              attachments: attachments.map(a => ({
                filename: a.filename,
                content: a.content,
                type: a.type,
                disposition: 'attachment',
              })),
            }
          : {}),
      };

      const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (sgRes.status === 202) {
        const messageId = sgRes.headers.get('X-Message-Id') ?? `sg_${Date.now()}`;
        return res.status(200).json({ success: true, messageId, provider: 'sendgrid' });
      }

      const errBody = await sgRes.json().catch(() => ({})) as { errors?: { message?: string }[] };
      return res.status(502).json({
        error: errBody.errors?.[0]?.message ?? `SendGrid error (${sgRes.status})`,
      });

    } else {
      return res.status(400).json({
        error: `Unknown provider: ${provider}. Use 'microsoft', 'google' or 'sendgrid'.`,
      });
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-email] Error:', message);
    return res.status(500).json({ error: 'Failed to send email. Please check your credentials and try again.' });
  }
}
