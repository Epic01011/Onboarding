/**
 * apiClient.ts
 *
 * Centralized fetch utility for all frontend → n8n webhook calls.
 * - Attaches `x-api-key` header from VITE_N8N_API_KEY env variable.
 * - Handles HTTP error codes explicitly (401, 403, 5xx…).
 * - Returns typed responses; never exposes keys in source.
 */

const N8N_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL ?? '';
const N8N_API_KEY = import.meta.env.VITE_N8N_API_KEY ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Low-level fetch wrapper — adds auth header and handles HTTP errors. */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${N8N_BASE_URL}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(N8N_API_KEY ? { 'x-api-key': N8N_API_KEY } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) throw new ApiError(401, 'Non autorisé — vérifiez votre clé API n8n.');
    if (response.status === 403) throw new ApiError(403, 'Accès refusé.');
    if (response.status >= 500) throw new ApiError(response.status, `Erreur serveur n8n (${response.status}): ${body}`);
    throw new ApiError(response.status, `Erreur HTTP ${response.status}: ${body}`);
  }

  // 202 Accepted — async job
  if (response.status === 202) {
    return (await response.json()) as T;
  }

  // 204 No Content — callers must handle undefined for void endpoints
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
