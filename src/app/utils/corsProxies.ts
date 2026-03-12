/**
 * Shared CORS proxy configuration and fetch utility for external API calls.
 *
 * Used by services that need fallback CORS proxies when the target API
 * does not natively support cross-origin requests from the browser.
 */

/**
 * Ordered list of CORS proxy builders. Each function takes a target URL
 * and returns a proxied URL to try.
 */
export const CORS_PROXIES: Array<(url: string) => string> = [
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://cors.sh/${url}`,
];

/**
 * Performs a GET request with a configurable timeout.
 *
 * - Unwraps allorigins responses automatically (`{ contents: '...' }` wrapper).
 * - Returns `null` when the server responds but the `results` array is absent
 *   or empty. **Note:** this utility is designed for APIs that return a
 *   `{ results: [...] }` envelope (e.g. recherche-entreprises.api.gouv.fr).
 * - Throws on network/abort errors so callers can distinguish "empty result"
 *   from "request failed".
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // allorigins wraps the response body in { contents: '...' }
    let parsed: Record<string, unknown> = json;
    if (typeof json?.contents === 'string') {
      try {
        parsed = JSON.parse(json.contents);
      } catch {
        return null;
      }
    }

    const results = parsed?.results;
    if (!Array.isArray(results) || results.length === 0) return null;
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
