/**
 * Service Yousign — API Signature Électronique
 * Documentation : https://developers.yousign.com/docs/
 *
 * CONFIGURATION :
 *   Clé API saisie dans /setup → stockée dans localStorage (servicesStorage)
 *   Sandbox : https://api-sandbox.yousign.app/v3
 *   Production : https://api.yousign.app/v3  (clé commençant par ys_live_)
 *
 * ENDPOINTS UTILISÉS :
 *   POST /v3/signature_requests           → Créer une demande de signature
 *   POST /v3/signature_requests/{id}/signers  → Ajouter des signataires
 *   POST /v3/signature_requests/{id}/documents → Ajouter des documents
 *   POST /v3/signature_requests/{id}/activate  → Activer & notifier
 *   GET  /v3/signature_requests/{id}       → Vérifier le statut
 */

import { getServiceConnections } from '../utils/servicesStorage';
import { delay } from '../utils/delay';

export interface YousignSigner {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  locale?: 'fr' | 'en' | 'de' | 'es' | 'it';
}

export interface YousignSignatureRequest {
  name: string;
  signers: YousignSigner[];
  documentBase64?: string;
  documentName?: string;
  externalId?: string;
}

export interface YousignSignatureResult {
  id: string;
  status: 'draft' | 'ongoing' | 'done' | 'expired' | 'canceled';
  name: string;
  signingUrl?: string;
  signers: Array<{
    id: string;
    email: string;
    status: 'initiated' | 'notified' | 'declined' | 'signed';
    signatureLink?: string;
  }>;
  demo?: boolean;
}

function getYousignKey(): string | null {
  const connections = getServiceConnections();
  return connections.yousign?.apiKey ?? import.meta.env.VITE_YOUSIGN_API_KEY ?? null;
}

function getBaseUrl(apiKey: string): string {
  return apiKey.startsWith('ys_live_')
    ? 'https://api.yousign.app/v3'
    : 'https://api-sandbox.yousign.app/v3';
}

/**
 * Crée une demande de signature Yousign et notifie les signataires
 */
export async function createSignatureRequest(
  request: YousignSignatureRequest
): Promise<{ success: boolean; data?: YousignSignatureResult; error?: string; demo?: boolean }> {
  await delay(1200);

  const apiKey = getYousignKey();

  // Mode démo si pas de clé API
  if (!apiKey) {
    console.log('[YOUSIGN DEMO] Would create signature request:', request.name);
    return {
      success: true,
      demo: true,
      data: {
        id: `ys_req_${Date.now()}`,
        status: 'ongoing',
        name: request.name,
        signingUrl: `https://app.yousign.com/sign/${Date.now()}`,
        signers: request.signers.map((s, i) => ({
          id: `ys_signer_${i}`,
          email: s.email,
          status: 'notified',
          signatureLink: `https://app.yousign.com/sign/${Date.now()}_${i}`,
        })),
        demo: true,
      },
    };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);

    // 1. Créer la demande de signature
    const createRes = await fetch(`${baseUrl}/signature_requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: request.name,
        delivery_mode: 'email',
        ...(request.externalId ? { external_id: request.externalId } : {}),
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return { success: false, error: err.message ?? `Erreur Yousign (${createRes.status})` };
    }

    const signatureRequest = await createRes.json();
    const reqId = signatureRequest.id;

    // 2. Ajouter le document (si fourni en base64)
    if (request.documentBase64 && request.documentName) {
      await fetch(`${baseUrl}/signature_requests/${reqId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nature: 'signable_document',
          name: request.documentName,
          content: request.documentBase64,
        }),
      });
    }

    // 3. Ajouter les signataires
    const signerResults: YousignSignatureResult['signers'] = [];
    for (const signer of request.signers) {
      const signerRes = await fetch(`${baseUrl}/signature_requests/${reqId}/signers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          info: {
            first_name: signer.firstName,
            last_name: signer.lastName,
            email: signer.email,
            ...(signer.locale ? { locale: signer.locale } : {}),
          },
          fields: [],
          signature_level: 'electronic_signature',
        }),
      });
      if (signerRes.ok) {
        const signerData = await signerRes.json();
        signerResults.push({
          id: signerData.id,
          email: signer.email,
          status: 'initiated',
          signatureLink: signerData.signature_link,
        });
      }
    }

    // 4. Activer la demande (envoie les emails aux signataires)
    await fetch(`${baseUrl}/signature_requests/${reqId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return {
      success: true,
      data: {
        id: reqId,
        status: 'ongoing',
        name: request.name,
        signingUrl: signatureRequest.signing_url,
        signers: signerResults,
      },
    };
  } catch (err) {
    console.error('[YOUSIGN ERROR]', err);
    return { success: false, error: 'Erreur de connexion à Yousign' };
  }
}

/**
 * Télécharge le PDF signé d'une demande de signature Yousign
 */
export async function downloadYousignDocument(
  signatureId: string
): Promise<{ success: boolean; data?: Blob; demo?: boolean; error?: string }> {
  await delay(800);

  const apiKey = getYousignKey();
  if (!apiKey) {
    console.log('[YOUSIGN DEMO] Téléchargement du document signé simulé pour', signatureId);
    return { success: true, demo: true };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);
    const res = await fetch(`${baseUrl}/signature_requests/${signatureId}/documents/download`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { success: false, error: `Erreur HTTP ${res.status}` };

    const blob = await res.blob();
    return { success: true, data: blob };
  } catch {
    return { success: false, error: 'Erreur lors du téléchargement Yousign' };
  }
}

/**
 * Vérifie le statut d'une demande de signature
 */
export async function getSignatureStatus(
  requestId: string
): Promise<{ success: boolean; status?: string; signerStatus?: string; demo?: boolean; error?: string }> {
  await delay(500);

  const apiKey = getYousignKey();
  if (!apiKey) {
    return { success: true, status: 'ongoing', signerStatus: 'notified', demo: true };
  }

  try {
    const baseUrl = getBaseUrl(apiKey);
    const res = await fetch(`${baseUrl}/signature_requests/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { success: false, error: `Statut HTTP ${res.status}` };

    const data = await res.json();
    return {
      success: true,
      status: data.status,
      signerStatus: data.signers?.[0]?.status,
    };
  } catch {
    return { success: false, error: 'Erreur statut Yousign' };
  }
}