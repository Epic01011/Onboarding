/**
 * aiEmailGenerator.ts
 *
 * Service de génération de brouillons d'emails IA pour l'Inbox IA.
 *
 * Construit le prompt système optimal et appelle Claude (Anthropic) ou OpenAI
 * via la serverless function /api/generate-ai-email (proxy CORS-safe).
 *
 * La réponse est formatée en HTML incluant la signature de l'expert et le logo
 * du cabinet en pied de message.
 */

import DOMPurify from 'dompurify';
import { ClientEmail } from '../utils/microsoftGraph';
import { CabinetInfo } from '../utils/servicesStorage';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateEmailOptions {
  clientEmail: ClientEmail;
  cabinetInfo: CabinetInfo;
}

export interface GeneratedDraft {
  subject: string;
  htmlBody: string;
  plainText: string;
}

export type AiErrorKind =
  | 'timeout'        // AbortError — API took more than 30 s
  | 'invalid_key'    // HTTP 401 — API key rejected
  | 'rate_limited'   // HTTP 429 — quota exceeded
  | 'server_error'   // HTTP 5xx — upstream AI service failure
  | 'other';         // Any other failure

/**
 * Typed error thrown by `generateEmailDraft`.
 * Callers (e.g. useInboxSync) can switch on `kind` to show specific toasts.
 */
export class AiGenerationError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiGenerationError';
  }
}

// ─── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(cabinetInfo: CabinetInfo): string {
  const expertName = cabinetInfo.expertNom || 'Expert-Comptable';
  const cabinetName = cabinetInfo.nom || 'Cabinet Expert-Comptable';

  return `Tu es ${expertName}, expert-comptable au cabinet "${cabinetName}".
Tu dois rédiger des réponses professionnelles, précises et bienveillantes aux emails de clients.

Règles impératives :
- Réponds toujours en français, avec un ton professionnel et chaleureux.
- Cite les textes légaux et références BOFiP pertinents (articles du CGI, BOI-*, etc.).
- Structure ta réponse avec des paragraphes clairs.
- Commence par "Bonjour [prénom du client]," ou "Bonjour Madame/Monsieur [nom],"
- Termine TOUJOURS par la formule de politesse standard et ta signature.
- Formate ta réponse en HTML valide (utilise <p>, <strong>, <ul>, <li> etc.).
- N'inclus PAS les balises <html>, <head> ou <body> — uniquement le contenu du corps.
- La réponse doit être complète, prête à l'envoi.`;
}

function buildUserPrompt(clientEmail: ClientEmail): string {
  return `Voici l'email reçu du client ${clientEmail.clientName} (${clientEmail.fromEmail}) :

Objet : ${clientEmail.subject}

---
${clientEmail.body}
---

Génère une réponse professionnelle et complète à cet email. Inclus les références légales pertinentes.
Réponds uniquement avec le contenu HTML du corps de l'email (pas de <html>/<body>).`;
}

// ─── Signature HTML ─────────────────────────────────────────────────────────────

function buildSignatureHtml(cabinetInfo: CabinetInfo): string {
  const expertName = cabinetInfo.expertNom || 'Expert-Comptable';
  const cabinetName = cabinetInfo.nom || 'Cabinet Expert-Comptable';
  const expertEmail = cabinetInfo.expertEmail || '';
  const telephone = cabinetInfo.telephone || '';
  const logoUrl = cabinetInfo.cabinetLogoUrl || '';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${cabinetName}" style="max-height:60px;max-width:200px;margin-bottom:8px;" /><br/>`
    : '';

  return `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<table style="font-family:Arial,sans-serif;font-size:13px;color:#374151;">
  <tr>
    <td>
      ${logoHtml}
      <strong style="font-size:14px;">${expertName}</strong><br/>
      <span style="color:#6b7280;">${cabinetName}</span><br/>
      ${expertEmail ? `<a href="mailto:${expertEmail}" style="color:#2563eb;text-decoration:none;">${expertEmail}</a><br/>` : ''}
      ${telephone ? `<span>${telephone}</span>` : ''}
    </td>
  </tr>
</table>`;
}

// ─── API call via serverless proxy ──────────────────────────────────────────────

/** Timeout in milliseconds for the AI proxy call. */
const AI_CALL_TIMEOUT_MS = 30_000;

async function callAiApi(
  provider: 'claude' | 'openai',
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT_MS);

  try {
    const response = await fetch('/api/generate-ai-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, systemPrompt, userPrompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errMsg = `AI API error ${response.status}`;
      try {
        const body = await response.json() as { error?: string };
        errMsg = body?.error ?? errMsg;
      } catch { /* ignore */ }

      if (response.status === 401) throw new AiGenerationError('invalid_key', errMsg);
      if (response.status === 429) throw new AiGenerationError('rate_limited', errMsg);
      if (response.status === 504) throw new AiGenerationError('timeout', errMsg);
      if (response.status >= 500) throw new AiGenerationError('server_error', errMsg);
      throw new AiGenerationError('other', errMsg);
    }

    const result = await response.json() as { content: string };
    return result.content;
  } catch (err) {
    if (err instanceof AiGenerationError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiGenerationError('timeout', 'La génération IA a dépassé le délai de 30 secondes.');
    }
    throw new AiGenerationError('other', err instanceof Error ? err.message : 'Erreur inconnue');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Génère un brouillon d'email HTML professionnel en réponse à l'email d'un client.
 *
 * Si la clé API est manquante, retourne un brouillon de démonstration.
 */
export async function generateEmailDraft(
  options: GenerateEmailOptions,
): Promise<GeneratedDraft> {
  const { clientEmail, cabinetInfo } = options;
  const provider = cabinetInfo.aiProvider ?? 'claude';
  const apiKey = cabinetInfo.aiApiKey ?? '';

  const replySubject = clientEmail.subject.startsWith('Re:')
    ? clientEmail.subject
    : `Re: ${clientEmail.subject}`;

  // If no API key configured, return a placeholder draft
  if (!apiKey) {
    const placeholder = `<p>Bonjour ${clientEmail.clientName},</p>
<p>Merci pour votre message concernant : <em>${clientEmail.subject}</em>.</p>
<p>Nous avons bien reçu votre demande et reviendrons vers vous dans les plus brefs délais.</p>
<p>Cordialement,</p>`;
    return {
      subject: replySubject,
      htmlBody: placeholder + buildSignatureHtml(cabinetInfo),
      plainText: `Bonjour ${clientEmail.clientName},\n\nMerci pour votre message.\n\nCordialement,\n${cabinetInfo.expertNom || 'Expert-Comptable'}`,
    };
  }

  const systemPrompt = buildSystemPrompt(cabinetInfo);
  const userPrompt = buildUserPrompt(clientEmail);

  const aiContent = await callAiApi(provider, apiKey, systemPrompt, userPrompt);
  const htmlBody = aiContent + buildSignatureHtml(cabinetInfo);

  // Derive plain text: sanitize HTML first, then extract text content via DOM parsing
  const sanitized = DOMPurify.sanitize(htmlBody, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const plainText = sanitized.replace(/\n{3,}/g, '\n\n').trim();

  return { subject: replySubject, htmlBody, plainText };
}
