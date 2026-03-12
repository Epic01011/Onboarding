/**
 * dgfipApi.ts
 *
 * Service d'accès aux données fiscales via l'API Entreprise de l'État (approche Zéro Robot).
 *
 * Provides:
 *   - requestTaxCertificate(siren, clientId) : obtient l'attestation de régularité fiscale
 *     directement depuis l'API Entreprise v4 (entreprise.api.gouv.fr).
 *
 * Le token d'accès est lu depuis la variable d'environnement VITE_API_ENTREPRISE_TOKEN.
 * En l'absence de token, la fonction retourne une URL de démonstration statique.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxCertificateResult {
  client_id: string;
  /** Download URL for the attestation de régularité fiscale */
  certificate_url: string;
  /** ISO timestamp when the certificate was generated */
  issued_at: string;
}

// ─── Tax compliance certificate (attestation de régularité fiscale) ───────────

/**
 * Obtient l'attestation de régularité fiscale pour un client.
 *
 * Appelle directement l'API Entreprise v4 du gouvernement (DGFIP) :
 *   GET https://entreprise.api.gouv.fr/v4/dgfip/unites_legales/{siren}/attestation_fiscale
 *
 * En mode démonstration (token absent), retourne une URL statique factice.
 *
 * @param siren    - Numéro SIREN de l'unité légale (9 chiffres)
 * @param clientId - Identifiant interne du client
 * @returns URL de téléchargement de l'attestation et horodatage d'émission
 */
export async function requestTaxCertificate(siren: string, clientId: string): Promise<TaxCertificateResult> {
  const token = import.meta.env.VITE_API_ENTREPRISE_TOKEN as string | undefined;

  if (!token) {
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
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
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

