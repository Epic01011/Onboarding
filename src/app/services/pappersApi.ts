/**
 * Service Pappers / Dirigeants
 *
 * Récupère les dirigeants d'une entreprise via l'API gouvernementale gratuite
 * (recherche-entreprises.api.gouv.fr) — même infrastructure que sirenApi.ts.
 *
 * Stratégie en 3 niveaux :
 *  1. Appel direct (timeout 5 s)
 *  2. Fallback via proxies CORS en parallèle
 *  3. Retourne une erreur propre si tout échoue (le processus n'est pas bloqué)
 */

export interface DirigeantItem {
  nom: string;
  prenom: string;
  qualite: string;
}

export type PappersResult =
  | { success: true; dirigeants: DirigeantItem[] }
  | { success: false; error: string };

const API_BASE = 'https://recherche-entreprises.api.gouv.fr';

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://cors.sh/${url}`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDirigeantsPappers(siren: string): Promise<PappersResult> {
  const cleanSiren = siren.replace(/[\s\-.]/g, '');

  if (!/^\d{9}$/.test(cleanSiren)) {
    return { success: false, error: 'Le numéro SIREN doit comporter exactement 9 chiffres.' };
  }

  const apiUrl = `${API_BASE}/search?q=${cleanSiren}&page=1&per_page=1`;

  // ── 1. Appel direct ────────────────────────────────────────────────────────
  try {
    const data = await fetchWithTimeout(apiUrl, 5000);
    if (data) {
      return { success: true, dirigeants: parseDirigeants(data) };
    }
  } catch (err) {
    console.warn('[Pappers] Appel direct échoué :', err);
  }

  // ── 2. Fallback proxies CORS — essai en parallèle ─────────────────────────
  try {
    const proxyData = await Promise.any(
      CORS_PROXIES.map(async buildUrl => {
        const data = await fetchWithTimeout(buildUrl(apiUrl), 6000);
        if (!data) throw new Error('Réponse vide');
        return data;
      })
    );
    if (proxyData) {
      return { success: true, dirigeants: parseDirigeants(proxyData) };
    }
  } catch (err) {
    console.warn('[Pappers] Tous les proxies ont échoué :', err);
  }

  // ── 3. Aucune source disponible ────────────────────────────────────────────
  return {
    success: false,
    error: "Impossible de récupérer les dirigeants depuis l'API.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(
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

    // allorigins wraps the response in { contents: '...' }
    const parsed = typeof json?.contents === 'string' ? JSON.parse(json.contents) : json;

    if (!parsed?.results?.length) return null;
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function parseDirigeants(json: Record<string, unknown>): DirigeantItem[] {
  const results = json.results as Record<string, unknown>[];
  const r = results[0] as Record<string, unknown>;
  const rawDirigeants = r?.dirigeants as Record<string, unknown>[] | undefined;

  if (!rawDirigeants?.length) return [];

  return rawDirigeants.map(d => ({
    nom: (d.nom as string) ?? '',
    prenom: (d.prenoms as string) ?? (d.prenom as string) ?? '',
    qualite: (d.qualite as string) ?? '',
  }));
}
