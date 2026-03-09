/**
 * Service Pennylane — API Comptabilité Cabinet
 * Documentation : https://pennylane.readme.io/reference
 *
 * CONFIGURATION :
 *   Clé API saisie dans /setup → stockée dans localStorage (servicesStorage)
 *
 * ENDPOINTS UTILISÉS :
 *   POST /api/external/v1/customers             → Créer un client
 *   GET  /api/external/v1/customers/{id}        → Récupérer un client
 *   POST /api/external/v1/customers/{id}/notes  → Ajouter une note
 *   POST /api/external/v1/customers/{id}/tags   → Ajouter des tags
 *   POST /api/external/v1/billing_subscriptions → Créer un abonnement
 */

import { getServiceConnections } from '../utils/servicesStorage';
import { delay } from '../utils/delay';

export interface PennylaneCustomer {
  name: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  company_number?: string; // SIREN
  source_id?: string;      // Référence interne
  type?: 'company' | 'individual';
  naf_code?: string;
  registration_date?: string;
  legal_form?: string;
}

export interface PennylaneCreateResult {
  id: string;
  source_id: string;
  name: string;
  email: string;
  label?: string;
  billing_subscription?: {
    id: string;
    status: 'active' | 'pending' | 'cancelled';
    amount?: number;
    currency?: string;
  };
  demo?: boolean;
}

export interface PennylaneNote {
  content: string;
  date?: string;
}

function getPennylaneKey(): string | null {
  const connections = getServiceConnections();
  return connections.pennylane?.apiKey ?? import.meta.env.VITE_PENNYLANE_API_KEY ?? null;
}

const BASE_URL = 'https://app.pennylane.com/api/external/v1';

/**
 * Crée un client dans Pennylane
 */
export async function createPennylaneCustomer(
  customer: PennylaneCustomer
): Promise<{ success: boolean; data?: PennylaneCreateResult; error?: string; demo?: boolean }> {
  await delay(1500);

  const apiKey = getPennylaneKey();

  if (!apiKey) {
    const id = `PNY-${Date.now().toString().slice(-6)}`;
    console.log('[PENNYLANE DEMO] Would create customer:', customer.name);
    return {
      success: true,
      demo: true,
      data: {
        id,
        source_id: id,
        name: customer.name,
        email: customer.email,
        label: customer.name,
        billing_subscription: {
          id: `sub_${Date.now()}`,
          status: 'pending',
        },
        demo: true,
      },
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ customer }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error ?? err.message ?? `Erreur Pennylane (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data: data.customer };
  } catch (err) {
    console.error('[PENNYLANE ERROR]', err);
    return { success: false, error: 'Erreur de connexion à Pennylane' };
  }
}

/**
 * Ajoute une note confidentielle à un client Pennylane
 */
export async function addPennylaneNote(
  customerId: string,
  note: PennylaneNote
): Promise<{ success: boolean; error?: string; demo?: boolean }> {
  await delay(700);

  const apiKey = getPennylaneKey();
  if (!apiKey) {
    console.log('[PENNYLANE DEMO] Would add note to customer:', customerId);
    return { success: true, demo: true };
  }

  try {
    const res = await fetch(`${BASE_URL}/customers/${customerId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    });
    return { success: res.ok };
  } catch {
    return { success: false, error: 'Erreur ajout note Pennylane' };
  }
}

/**
 * Crée un abonnement de facturation pour les honoraires
 */
export async function createBillingSubscription(
  customerId: string,
  params: {
    amount: number;
    label: string;
    periodicity?: 'monthly' | 'quarterly' | 'yearly';
  }
): Promise<{ success: boolean; id?: string; error?: string; demo?: boolean }> {
  await delay(1000);

  const apiKey = getPennylaneKey();
  if (!apiKey) {
    return { success: true, demo: true, id: `sub_${Date.now()}` };
  }

  try {
    const res = await fetch(`${BASE_URL}/billing_subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing_subscription: {
          customer_id: customerId,
          label: params.label,
          amount: params.amount,
          currency: 'EUR',
          periodicity: params.periodicity ?? 'monthly',
        },
      }),
    });

    if (!res.ok) return { success: false, error: `Erreur abonnement Pennylane (${res.status})` };
    const data = await res.json();
    return { success: true, id: data.billing_subscription?.id };
  } catch {
    return { success: false, error: 'Erreur abonnement Pennylane' };
  }
}

/**
 * Déclenche l'envoi du mandat SEPA depuis Pennylane
 */
export async function sendSEPAMandat(
  customerId: string
): Promise<{ success: boolean; mandatUrl?: string; error?: string; demo?: boolean }> {
  await delay(1200);

  const apiKey = getPennylaneKey();
  if (!apiKey) {
    return {
      success: true,
      demo: true,
      mandatUrl: `https://app.pennylane.com/sepa/sign/${Date.now()}`,
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/customers/${customerId}/sepa_mandates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return { success: false, error: `Erreur mandat SEPA (${res.status})` };
    const data = await res.json();
    return { success: true, mandatUrl: data.sepa_mandate?.signing_url };
  } catch {
    return { success: false, error: 'Erreur mandat SEPA Pennylane' };
  }
}