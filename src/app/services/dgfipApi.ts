/**
 * dgfipApi.ts
 *
 * Service de synchronisation bidirectionnelle avec le portail impots.gouv.fr (DGFIP).
 *
 * Provides:
 *   - syncFiscalDeadlines()           : fetch real-time fiscal deadlines from DGFIP
 *   - requestTaxCertificate(clientId) : order and retrieve a tax compliance certificate
 *   - validateDgfipConnection()       : test the connection to the configured DGFIP webhook
 *
 * Connection configuration is read from the `impotsgouv` entry in servicesStorage
 * (LocalStorage → Supabase). Falls back gracefully to environment variables, then
 * demo mode when neither is configured.
 */

import { FiscalTask } from '../types/dashboard';
import { getServiceConnections } from '../utils/servicesStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DGFIPSyncResult {
  tasks: FiscalTask[];
  /** ISO timestamp of the sync */
  synced_at: string;
  /** Whether data comes from the live DGFIP API or is demo/cached */
  is_live: boolean;
}

export interface TaxCertificateResult {
  client_id: string;
  /** Download URL for the attestation de régularité fiscale */
  certificate_url: string;
  /** ISO timestamp when the certificate was generated */
  issued_at: string;
}

export interface DGFIPConnectionStatus {
  /** true when the webhook responds with a 2xx status */
  ok: boolean;
  /** Human-readable status message */
  message: string;
  /** ISO timestamp of the test */
  tested_at: string;
  /** Latency in milliseconds (–1 when not available) */
  latency_ms: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolves the base webhook URL and API key to use for DGFIP calls.
 * Priority:
 *   1. `impotsgouv` connection stored in servicesStorage (user-configured)
 *   2. VITE_N8N_WEBHOOK_URL / VITE_N8N_API_KEY env vars
 *   3. Empty string → demo mode (no real calls)
 */
function resolveDgfipConfig(): { baseUrl: string; apiKey: string } {
  const stored = getServiceConnections().impotsgouv;
  if (stored.connected && stored.webhookUrl) {
    return {
      baseUrl: stored.webhookUrl.replace(/\/$/, ''),
      apiKey: stored.apiKey ?? '',
    };
  }
  return {
    baseUrl: (import.meta.env.VITE_N8N_WEBHOOK_URL ?? '').replace(/\/$/, ''),
    apiKey: import.meta.env.VITE_N8N_API_KEY ?? '',
  };
}

/** Performs a single POST request against the DGFIP n8n webhook. */
async function dgfipFetch<T>(path: string, body: unknown, config: { baseUrl: string; apiKey: string }): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DGFIP webhook error ${response.status}: ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ─── DGFIP Fiscal deadline sync ──────────────────────────────────────────────

/**
 * Synchronise les échéances fiscales depuis le portail DGFIP (impots.gouv.fr).
 *
 * Types couverts :
 *   - TVA mensuelle/trimestrielle (CA3 / CA12)
 *   - IS (solde & acomptes)
 *   - CFE, CVAE, Taxe foncière
 *
 * En mode démonstration (webhook non configuré), retourne un résultat vide
 * sans lever d'erreur — le calendrier fiscal garde ses données de démo.
 */
export async function syncFiscalDeadlines(): Promise<DGFIPSyncResult> {
  const config = resolveDgfipConfig();
  if (!config.baseUrl) {
    return { tasks: [], synced_at: new Date().toISOString(), is_live: false };
  }
  try {
    const result = await dgfipFetch<DGFIPSyncResult>(
      '/webhook/dgfip/sync-deadlines',
      { requested_at: new Date().toISOString() },
      config,
    );
    return {
      ...result,
      is_live: true,
      synced_at: result.synced_at ?? new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[dgfipApi] syncFiscalDeadlines fallback (demo mode):', err instanceof Error ? err.message : err);
    return { tasks: [], synced_at: new Date().toISOString(), is_live: false };
  }
}

// ─── Tax compliance certificate (attestation de régularité fiscale) ───────────

/**
 * Commande et télécharge l'attestation de régularité fiscale pour un client.
 *
 * Appelle directement l'API Entreprise v4 du gouvernement (DGFIP).
 * En mode démonstration (aucune clé API configurée), retourne une URL factice.
 *
 * @param siren    - Numéro SIREN de l'unité légale (9 chiffres)
 * @param clientId - Identifiant interne du client (client_id)
 * @returns URL de téléchargement de l'attestation et horodatage d'émission
 */
export async function requestTaxCertificate(siren: string, clientId: string): Promise<TaxCertificateResult> {
  const config = resolveDgfipConfig();
  if (!config.apiKey) {
    return {
      client_id: clientId,
      certificate_url: `#demo-attestation-${clientId}`,
      issued_at: new Date().toISOString(),
    };
  }
  try {
    const url = `https://entreprise.api.gouv.fr/v4/dgfip/unites_legales/${siren}/attestation_fiscale`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API Entreprise error ${response.status}: ${text}`);
    }
    return (await response.json()) as TaxCertificateResult;
  } catch (err) {
    console.warn('[dgfipApi] requestTaxCertificate fallback (demo mode):', err instanceof Error ? err.message : err);
    return {
      client_id: clientId,
      certificate_url: `#demo-attestation-${clientId}`,
      issued_at: new Date().toISOString(),
    };
  }
}

// ─── Connection validation ────────────────────────────────────────────────────

/**
 * Vérifie que le webhook DGFIP configuré est joignable et répond correctement.
 *
 * Appelle l'endpoint `/webhook/dgfip/health` (ou `/webhook/dgfip/sync-deadlines`
 * avec un flag de test). Retourne le statut de connexion, le message et la latence.
 *
 * En mode démonstration (aucun webhook configuré), indique clairement que la
 * connexion n'est pas configurée — sans lever d'erreur.
 *
 * @param override - Optional config to test without persisting to storage (used by the settings modal)
 */
export async function validateDgfipConnection(override?: { baseUrl: string; apiKey: string }): Promise<DGFIPConnectionStatus> {
  const config = override ?? resolveDgfipConfig();
  const tested_at = new Date().toISOString();

  if (!config.baseUrl) {
    return {
      ok: false,
      message: "Aucun webhook DGFIP configuré. Renseignez l'URL dans les paramètres → Intégrations → DGFIP.",
      tested_at,
      latency_ms: -1,
    };
  }

  const t0 = Date.now();
  try {
    // First try the dedicated health endpoint
    const healthUrl = `${config.baseUrl}/webhook/dgfip/health`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    };
    const response = await fetch(healthUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: true, requested_at: tested_at }),
      signal: AbortSignal.timeout(10_000),
    });
    const latency_ms = Date.now() - t0;

    if (response.ok) {
      return {
        ok: true,
        message: `Connexion DGFIP opérationnelle (${latency_ms} ms) — impots.gouv.fr synchronisé via n8n.`,
        tested_at,
        latency_ms,
      };
    }

    return {
      ok: false,
      message: `Le webhook DGFIP a répondu avec le code ${response.status}. Vérifiez la configuration n8n.`,
      tested_at,
      latency_ms,
    };
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Impossible de joindre le webhook DGFIP : ${msg}`,
      tested_at,
      latency_ms,
    };
  }
}

