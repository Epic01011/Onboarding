import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function — /api/generate-ai-email
 *
 * Proxy CORS-safe pour les appels aux APIs IA (Claude Anthropic, OpenAI).
 * La clé API est transmise depuis le client dans le corps de la requête
 * (elle appartient au cabinet et est déchiffrée côté client avant envoi).
 *
 * POST /api/generate-ai-email
 * Body JSON :
 * {
 *   provider: 'claude' | 'openai' | 'perplexity',
 *   apiKey: string,
 *   systemPrompt: string,
 *   userPrompt: string,
 *   model?: string,       // optionnel, utilise le modèle par défaut du provider
 *   maxTokens?: number,   // optionnel, défaut 2048
 * }
 *
 * Response JSON :
 * { content: string }    // Contenu HTML généré par l'IA
 *
 * Error responses use semantically correct HTTP status codes:
 *   401 — API key rejected by the AI provider
 *   429 — Rate limit / quota exceeded
 *   504 — Upstream AI API timed out (>25 s)
 *   500 — Other upstream error
 */

/** Timeout for upstream AI API calls (ms). Must be < Vercel's 30 s limit. */
const UPSTREAM_TIMEOUT_MS = 25_000;

interface GenerateEmailBody {
  provider: 'claude' | 'openai' | 'perplexity';
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
}

// ─── Upstream timeout helper ─────────────────────────────────────────────────

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

/** Map an upstream HTTP status code to the gateway-level HTTP status to return. */
function mapHttpStatus(upstreamStatus: number): number {
  if (upstreamStatus === 401) return 401;
  if (upstreamStatus === 429) return 429;
  return 500;
}

/** Map an AbortError to gateway status 504. */
function mapErrorStatus(err: unknown): number {
  if (err instanceof Error && err.name === 'AbortError') return 504;
  return 500;
}

// ─── Claude (Anthropic) ──────────────────────────────────────────────────────

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const { signal, clear } = withTimeout(UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = err?.error?.message ?? `Anthropic API error ${response.status}`;
      const gatewayStatus = mapHttpStatus(response.status);
      throw Object.assign(new Error(msg), { gatewayStatus });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    return data.content?.find((b) => b.type === 'text')?.text ?? '';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('Anthropic API timed out'), { gatewayStatus: mapErrorStatus(err) });
    }
    throw err;
  } finally {
    clear();
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const { signal, clear } = withTimeout(UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = err?.error?.message ?? `OpenAI API error ${response.status}`;
      const gatewayStatus = mapHttpStatus(response.status);
      throw Object.assign(new Error(msg), { gatewayStatus });
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('OpenAI API timed out'), { gatewayStatus: mapErrorStatus(err) });
    }
    throw err;
  } finally {
    clear();
  }
}

// ─── Perplexity ──────────────────────────────────────────────────────────────

async function callPerplexity(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const { signal, clear } = withTimeout(UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = err?.error?.message ?? `Perplexity API error ${response.status}`;
      const gatewayStatus = mapHttpStatus(response.status);
      throw Object.assign(new Error(msg), { gatewayStatus });
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('Perplexity API timed out'), { gatewayStatus: mapErrorStatus(err) });
    }
    throw err;
  } finally {
    clear();
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const allowedOrigin =
    process.env.ALLOWED_ORIGIN ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { provider, apiKey, systemPrompt, userPrompt, model, maxTokens } = (req.body ?? {}) as Partial<GenerateEmailBody>;

  if (!provider || !apiKey || !systemPrompt || !userPrompt) {
    res.status(400).json({ error: 'Missing required fields: provider, apiKey, systemPrompt, userPrompt' });
    return;
  }

  if (provider !== 'claude' && provider !== 'openai' && provider !== 'perplexity') {
    res.status(400).json({ error: 'provider must be "claude", "openai" or "perplexity"' });
    return;
  }

  const tokens = maxTokens ?? 2048;

  try {
    let content: string;
    if (provider === 'claude') {
      content = await callClaude(apiKey, systemPrompt, userPrompt, model ?? 'claude-3-5-sonnet-20241022', tokens);
    } else if (provider === 'perplexity') {
      content = await callPerplexity(apiKey, systemPrompt, userPrompt, model ?? 'sonar-pro', tokens);
    } else {
      content = await callOpenAI(apiKey, systemPrompt, userPrompt, model ?? 'gpt-4o-mini', tokens);
    }
    res.status(200).json({ content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = (err as { gatewayStatus?: number }).gatewayStatus ?? 500;
    console.error(`[generate-ai-email] ${status} error:`, message);
    res.status(status).json({ error: message });
  }
}
