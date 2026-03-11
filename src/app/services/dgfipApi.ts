/**
 * dgfipApi.ts
 *
 * Service de synchronisation bidirectionnelle avec le portail impots.gouv.fr (DGFIP).
 *
 * Provides:
 *   - syncFiscalDeadlines()         : fetch real-time fiscal deadlines from DGFIP
 *   - requestTaxCertificate(clientId): order and retrieve a tax compliance certificate
 *
 * Falls back gracefully when the DGFIP API / n8n webhook is not configured
 * (demo mode — no credentials needed).
 */

import { FiscalTask } from '../types/dashboard';
import { apiClient, ApiError } from '../utils/apiClient';

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
  try {
    const result = await apiClient.post<DGFIPSyncResult>(
      '/webhook/dgfip/sync-deadlines',
      { requested_at: new Date().toISOString() },
    );
    return {
      ...result,
      is_live: true,
      synced_at: result.synced_at ?? new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof ApiError) {
      // Webhook not configured or DGFIP unreachable — silently fall back
      console.warn('[dgfipApi] syncFiscalDeadlines fallback (demo mode):', err.message);
    }
    return {
      tasks: [],
      synced_at: new Date().toISOString(),
      is_live: false,
    };
  }
}

// ─── Tax compliance certificate (attestation de régularité fiscale) ───────────

/**
 * Commande et télécharge l'attestation de régularité fiscale pour un client.
 *
 * En mode démonstration, retourne une URL factice pour permettre de tester
 * l'interface sans connexion réelle à la DGFIP.
 *
 * @param clientId - Identifiant interne du client (client_id)
 * @returns URL de téléchargement de l'attestation et horodatage d'émission
 */
export async function requestTaxCertificate(clientId: string): Promise<TaxCertificateResult> {
  try {
    const result = await apiClient.post<TaxCertificateResult>(
      '/webhook/dgfip/tax-certificate',
      { client_id: clientId, requested_at: new Date().toISOString() },
    );
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      // Webhook not configured — return a demo fallback URL
      console.warn('[dgfipApi] requestTaxCertificate fallback (demo mode):', err.message);
    }
    // Demo mode: return a placeholder certificate URL
    return {
      client_id: clientId,
      certificate_url: `#demo-attestation-${clientId}`,
      issued_at: new Date().toISOString(),
    };
  }
}
