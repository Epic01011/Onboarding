/**
 * Service JeSignExpert — Signature Electronique (basé sur Universign API)
 * Documentation : https://apps.universign.com/docs
 *
 * CONFIGURATION :
 *   Clé API saisie dans /setup → stockée dans localStorage (servicesStorage)
 *   Sandbox : https://api.sandbox.universign.com/v1
 *   Production : https://api.universign.com/v1
 *
 * FLOW DE SIGNATURE :
 *   1. POST /v1/transactions          → Créer une transaction (draft)
 *   2. POST /v1/files                 → Upload le PDF (multipart)
 *   3. POST /v1/transactions/{id}/documents    → Ajouter le fichier à la transaction
 *   4. POST /v1/transactions/{id}/documents/{docId}/fields → Ajouter champ signature
 *   5. POST /v1/transactions/{id}/signatures   → Assigner un signataire au champ
 *   6. POST /v1/transactions/{id}/start        → Démarrer la transaction
 *   7. GET  /v1/transactions/{id}              → Vérifier le statut
 */

import { getServiceConnections } from '../utils/servicesStorage';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface JeSignSigner {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
}

export interface JeSignSignatureRequest {
  name: string;
  signers: JeSignSigner[];
  documentBase64?: string;
  documentName?: string;
  externalId?: string;
  /** Type de document : statuts, ldm, mandat, m0, etc. */
  documentType?: string;
}

export interface JeSignSignatureResult {
  id: string;
  status: 'draft' | 'started' | 'completed' | 'expired' | 'canceled';
  name: string;
  signingUrl?: string;
  signers: Array<{
    id: string;
    email: string;
    status: 'waiting' | 'notified' | 'signed' | 'declined' | 'error';
    signatureLink?: string;
  }>;
  demo?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function getJeSignKey(): string | null {
  const connections = getServiceConnections();
  return connections.jesignexpert?.apiKey ?? import.meta.env.VITE_JESIGNEXPERT_API_KEY ?? null;
}

function getBaseUrl(apiKey: string): string {
  // Les clés sandbox commencent souvent par "sandbox_" ou "test_"
  const isSandbox = apiKey.startsWith('sandbox_') || apiKey.startsWith('test_');
  return isSandbox
    ? 'https://api.sandbox.universign.com/v1'
    : 'https://api.universign.com/v1';
}

function simulateDelay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/* ─── Demo data ─────────────────────────────────────────────────────────── */

function createDemoResult(request: JeSignSignatureRequest): JeSignSignatureResult {
  const txId = `jse_tx_${Date.now()}`;
  return {
    id: txId,
    status: 'started',
    name: request.name,
    signingUrl: `https://app.jesignexpert.com/sign/${txId}`,
    signers: request.signers.map((s, i) => ({
      id: `jse_signer_${i}_${Date.now()}`,
      email: s.email,
      status: 'notified',
      signatureLink: `https://app.jesignexpert.com/sign/${txId}/signer_${i}`,
    })),
    demo: true,
  };
}

/* ─── API Functions ─────────────────────────────────────────────────────── */

/**
 * Crée une transaction de signature JeSignExpert et notifie les signataires.
 * En mode démo (pas de clé API), simule le processus complet.
 */
export async function createSignatureTransaction(
  request: JeSignSignatureRequest
): Promise<{ success: boolean; data?: JeSignSignatureResult; error?: string; demo?: boolean }> {
  await simulateDelay(1200);

  const apiKey = getJeSignKey();

  // Mode démo si pas de clé API
  if (!apiKey) {
    console.log('[JESIGNEXPERT DEMO] Simulation de signature :', request.name);
    console.log('[JESIGNEXPERT DEMO] Signataires :', request.signers.map(s => s.email).join(', '));
    console.log('[JESIGNEXPERT DEMO] Document :', request.documentName ?? 'Aucun');
    return {
      success: true,
      demo: true,
      data: createDemoResult(request),
    };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // 1. Créer la transaction (draft)
    const txRes = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: request.name,
        ...(request.externalId ? { custom_id: request.externalId } : {}),
      }),
    });

    if (!txRes.ok) {
      const err = await txRes.json().catch(() => ({}));
      return { success: false, error: err.message ?? `Erreur JeSignExpert (${txRes.status})` };
    }

    const tx = await txRes.json();
    const txId = tx.id;

    // 2. Upload du document PDF si fourni
    let docId: string | null = null;
    if (request.documentBase64 && request.documentName) {
      // Upload fichier
      const fileRes = await fetch(`${baseUrl}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: request.documentName,
          content: request.documentBase64,
        }),
      });

      if (fileRes.ok) {
        const file = await fileRes.json();

        // 3. Attacher le document à la transaction
        const docRes = await fetch(`${baseUrl}/transactions/${txId}/documents`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ file_id: file.id }),
        });

        if (docRes.ok) {
          const doc = await docRes.json();
          docId = doc.id;

          // 4. Ajouter un champ de signature sur le document
          await fetch(`${baseUrl}/transactions/${txId}/documents/${docId}/fields`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              type: 'signature',
              page: 1,
              x: 100,
              y: 100,
              width: 200,
              height: 60,
            }),
          });
        }
      }
    }

    // 5. Ajouter les signataires
    const signerResults: JeSignSignatureResult['signers'] = [];
    for (const signer of request.signers) {
      const signerRes = await fetch(`${baseUrl}/transactions/${txId}/participants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          first_name: signer.firstName,
          last_name: signer.lastName,
          email: signer.email,
          ...(signer.phoneNumber ? { phone: signer.phoneNumber } : {}),
          role: 'signer',
        }),
      });

      if (signerRes.ok) {
        const signerData = await signerRes.json();
        signerResults.push({
          id: signerData.id,
          email: signer.email,
          status: 'waiting',
          signatureLink: signerData.url,
        });
      }
    }

    // 6. Démarrer la transaction (envoie les emails)
    const startRes = await fetch(`${baseUrl}/transactions/${txId}/start`, {
      method: 'POST',
      headers,
    });

    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      return { success: false, error: err.message ?? 'Erreur lors du démarrage de la transaction' };
    }

    return {
      success: true,
      data: {
        id: txId,
        status: 'started',
        name: request.name,
        signingUrl: tx.url,
        signers: signerResults.map(s => ({ ...s, status: 'notified' as const })),
      },
    };
  } catch (err) {
    console.error('[JESIGNEXPERT ERROR]', err);
    return { success: false, error: 'Erreur de connexion a JeSignExpert' };
  }
}

/**
 * Vérifie le statut d'une transaction de signature
 */
export async function getTransactionStatus(
  transactionId: string
): Promise<{ success: boolean; status?: string; signerStatuses?: Array<{ email: string; status: string }>; demo?: boolean; error?: string }> {
  await simulateDelay(500);

  const apiKey = getJeSignKey();
  if (!apiKey) {
    return { success: true, status: 'started', signerStatuses: [], demo: true };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);
    const res = await fetch(`${baseUrl}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { success: false, error: `Statut HTTP ${res.status}` };

    const data = await res.json();
    return {
      success: true,
      status: data.status,
      signerStatuses: data.participants?.map((p: { email: string; status: string }) => ({
        email: p.email,
        status: p.status,
      })),
    };
  } catch {
    return { success: false, error: 'Erreur lors de la verification du statut' };
  }
}

/**
 * Télécharge un document signé
 */
export async function downloadSignedDocument(
  transactionId: string,
  documentId?: string
): Promise<{ success: boolean; data?: Blob; demo?: boolean; error?: string }> {
  await simulateDelay(800);

  const apiKey = getJeSignKey();
  if (!apiKey) {
    console.log('[JESIGNEXPERT DEMO] Telechargement du document signe simulé');
    return { success: true, demo: true };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);
    const endpoint = documentId
      ? `${baseUrl}/transactions/${transactionId}/documents/${documentId}/download`
      : `${baseUrl}/transactions/${transactionId}/documents/download`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { success: false, error: `Erreur HTTP ${res.status}` };

    const blob = await res.blob();
    return { success: true, data: blob };
  } catch {
    return { success: false, error: 'Erreur lors du telechargement' };
  }
}

/**
 * Télécharge le PDF signé d'une transaction JeSignExpert.
 * Alias public de downloadSignedDocument pour cohérence avec yousignApi.
 */
export async function downloadJeSignDocument(
  transactionId: string
): Promise<{ success: boolean; data?: Blob; demo?: boolean; error?: string }> {
  return downloadSignedDocument(transactionId);
}

/**
 * Annule une transaction en cours
 */
export async function cancelTransaction(
  transactionId: string
): Promise<{ success: boolean; error?: string; demo?: boolean }> {
  await simulateDelay(600);

  const apiKey = getJeSignKey();
  if (!apiKey) {
    console.log('[JESIGNEXPERT DEMO] Annulation simulee de la transaction', transactionId);
    return { success: true, demo: true };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);
    const res = await fetch(`${baseUrl}/transactions/${transactionId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { success: false, error: `Erreur HTTP ${res.status}` };
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur lors de l\'annulation' };
  }
}
