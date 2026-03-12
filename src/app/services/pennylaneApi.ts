/**
 * Service Pennylane — API Comptabilité Cabinet
 * Documentation : https://pennylane.readme.io/reference
 *
 * CONFIGURATION :
 *   Clé API saisie dans /setup → stockée dans localStorage (servicesStorage)
 *
 * ENDPOINTS UTILISÉS :
 *   POST /api/external/v1/customers                          → Créer un client
 *   GET  /api/external/v1/customers/{id}                    → Récupérer un client
 *   POST /api/external/v1/customers/{id}/notes              → Ajouter une note
 *   POST /api/external/v1/customers/{id}/tags               → Ajouter des tags
 *   POST /api/external/v1/billing_subscriptions             → Créer un abonnement
 *   GET  /api/external/v1/customers/{id}/accounting_years   → Exercices & échéances
 *   GET  /api/external/v1/customers/{id}/supplier_invoices  → Dettes fournisseur DGFIP
 */

import { getServiceConnections } from '../utils/servicesStorage';
import { delay } from '../utils/delay';
import type { FiscalTask, FiscalTaskType, FiscalTaskStatus, UrgencySemantic } from '../types/dashboard';

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

// ─── Accounting Years (Production / Bilans) ─────────────────────────────────

/** Maps the status of an accounting year in Pennylane to a production state. */
export interface PennylaneAccountingYear {
  /** Internal Pennylane ID for the accounting year record */
  id: string;
  /** SIREN or Pennylane customer ID */
  customer_id: string;
  /** Display name of the customer */
  customer_name: string;
  /** ISO date of the fiscal year start */
  start_date: string;
  /** ISO date of the fiscal year closing (clôture) */
  closing_date: string;
  /** Accounting year status from Pennylane */
  status: 'open' | 'closed' | 'closing_in_progress';
}

/** A single mandatory fiscal deadline for a customer dossier. */
export interface PennylaneFiscalDeadline {
  /** Type of fiscal obligation */
  type: 'liasse_fiscale' | 'tva_ca3' | 'tva_ca12' | 'is_solde' | 'other';
  /** Human-readable label in French */
  label: string;
  /** ISO date — statutory deadline */
  due_date: string;
  /** True if already filed / télétransmis */
  filed: boolean;
}

/** Accounting year enriched with computed fiscal deadlines. */
export interface PennylaneAccountingYearWithDeadlines extends PennylaneAccountingYear {
  /** Mandatory fiscal deadlines derived from the closing date */
  fiscal_deadlines: PennylaneFiscalDeadline[];
  /** Primary deadline used for urgency calculation (liasse fiscale) */
  primary_due_date: string;
}

/**
 * Calcule les deadlines fiscales obligatoires à partir d'une date de clôture.
 * Règles françaises approximatives :
 *   - Liasse fiscale : clôture + 3 mois (IS)
 *   - TVA CA12 annuelle : clôture + 3 mois
 *   - IS Solde : clôture + 3 mois + 15 jours
 *
 * Note : pour une clôture au 31/12, la date exacte peut être ajustée par la
 * réglementation fiscale en vigueur (arrêté ministériel chaque année).
 */
function computeFiscalDeadlines(
  closingDateIso: string,
  status: PennylaneAccountingYear['status'],
): PennylaneFiscalDeadline[] {
  const closing = new Date(closingDateIso);
  const deadlines: PennylaneFiscalDeadline[] = [];

  // Liasse fiscale : clôture + 3 mois, au plus tôt le 2e jour ouvré de mai pour clôture 31/12
  const liasseDate = new Date(closing);
  liasseDate.setMonth(liasseDate.getMonth() + 3);
  deadlines.push({
    type: 'liasse_fiscale',
    label: 'Liasse fiscale',
    due_date: liasseDate.toISOString().split('T')[0],
    filed: status === 'closed',
  });

  // TVA CA12 annuelle : clôture + 3 mois (même règle)
  const tvaDate = new Date(closing);
  tvaDate.setMonth(tvaDate.getMonth() + 3);
  deadlines.push({
    type: 'tva_ca12',
    label: 'TVA CA12 annuelle',
    due_date: tvaDate.toISOString().split('T')[0],
    filed: status === 'closed',
  });

  // IS Solde : clôture + 3 mois + 15 jours
  const isDate = new Date(closing);
  isDate.setMonth(isDate.getMonth() + 3);
  isDate.setDate(isDate.getDate() + 15);
  deadlines.push({
    type: 'is_solde',
    label: 'IS Solde',
    due_date: isDate.toISOString().split('T')[0],
    filed: status === 'closed',
  });

  return deadlines;
}

/**
 * Récupère les dates de clôture d'exercice et les deadlines fiscales obligatoires
 * (liasse fiscale, TVA) pour chaque dossier client.
 *
 * En mode réel (avec clé API), appelle l'endpoint Pennylane accounting_years.
 * En mode démo (sans clé API), retourne des données représentatives.
 */
export async function fetchFiscalDeadlines(): Promise<{
  success: boolean;
  data?: PennylaneAccountingYearWithDeadlines[];
  error?: string;
  demo?: boolean;
}> {
  await delay(800);

  const apiKey = getPennylaneKey();

  if (!apiKey) {
    const now = new Date();
    const demoYears: PennylaneAccountingYear[] = [
      {
        id: 'acc_001',
        customer_id: 'cust_001',
        customer_name: 'SARL Martin & Associés',
        start_date: `${now.getFullYear() - 1}-01-01`,
        closing_date: `${now.getFullYear() - 1}-12-31`,
        status: 'closing_in_progress',
      },
      {
        id: 'acc_002',
        customer_id: 'cust_002',
        customer_name: 'SAS Dupont Tech',
        start_date: `${now.getFullYear() - 1}-07-01`,
        closing_date: `${now.getFullYear()}-06-30`,
        status: 'open',
      },
      {
        id: 'acc_003',
        customer_id: 'cust_003',
        customer_name: 'EURL Bernard Conseil',
        start_date: `${now.getFullYear() - 1}-01-01`,
        closing_date: `${now.getFullYear() - 1}-12-31`,
        status: 'closed',
      },
    ];

    const data: PennylaneAccountingYearWithDeadlines[] = demoYears.map(year => {
      const fiscal_deadlines = computeFiscalDeadlines(year.closing_date, year.status);
      const primary = fiscal_deadlines.find(d => d.type === 'liasse_fiscale');
      return {
        ...year,
        fiscal_deadlines,
        primary_due_date: primary?.due_date ?? fiscal_deadlines[0].due_date,
      };
    });

    console.log('[PENNYLANE DEMO] fetchFiscalDeadlines — returning demo data');
    return { success: true, demo: true, data };
  }

  try {
    const res = await fetch(`${BASE_URL}/accounting_years`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (err as { error?: string; message?: string }).error
          ?? (err as { message?: string }).message
          ?? `Erreur Pennylane (${res.status})`,
      };
    }

    const json = await res.json() as { accounting_years?: PennylaneAccountingYear[] };
    const years: PennylaneAccountingYear[] = json.accounting_years ?? [];

    const data: PennylaneAccountingYearWithDeadlines[] = years.map(year => {
      const fiscal_deadlines = computeFiscalDeadlines(year.closing_date, year.status);
      const primary = fiscal_deadlines.find(d => d.type === 'liasse_fiscale');
      return {
        ...year,
        fiscal_deadlines,
        primary_due_date: primary?.due_date ?? fiscal_deadlines[0].due_date,
      };
    });

    return { success: true, data };
  } catch (err) {
    console.error('[PENNYLANE ERROR] fetchFiscalDeadlines', err);
    return { success: false, error: 'Erreur de connexion à Pennylane' };
  }
}

/**
 * Récupère les exercices comptables depuis Pennylane
 * pour alimenter le module Suivi des Bilans.
 */
export async function fetchAccountingYears(): Promise<{
  success: boolean;
  data?: PennylaneAccountingYear[];
  error?: string;
  demo?: boolean;
}> {
  await delay(1000);

  const apiKey = getPennylaneKey();

  if (!apiKey) {
    const now = new Date();
    const demoData: PennylaneAccountingYear[] = [
      {
        id: 'acc_001',
        customer_id: 'cust_001',
        customer_name: 'SARL Martin & Associés',
        start_date: `${now.getFullYear() - 1}-01-01`,
        closing_date: `${now.getFullYear() - 1}-12-31`,
        status: 'closing_in_progress',
      },
      {
        id: 'acc_002',
        customer_id: 'cust_002',
        customer_name: 'SAS Dupont Tech',
        start_date: `${now.getFullYear() - 1}-07-01`,
        closing_date: `${now.getFullYear()}-06-30`,
        status: 'open',
      },
      {
        id: 'acc_003',
        customer_id: 'cust_003',
        customer_name: 'EURL Bernard Conseil',
        start_date: `${now.getFullYear() - 1}-01-01`,
        closing_date: `${now.getFullYear() - 1}-12-31`,
        status: 'closed',
      },
      {
        id: 'acc_004',
        customer_id: 'cust_004',
        customer_name: 'SCI Les Oliviers',
        start_date: `${now.getFullYear() - 1}-01-01`,
        closing_date: `${now.getFullYear() - 1}-12-31`,
        status: 'closing_in_progress',
      },
      {
        id: 'acc_005',
        customer_id: 'cust_005',
        customer_name: 'SARL Petit Commerce',
        start_date: `${now.getFullYear() - 1}-01-01`,
        closing_date: `${now.getFullYear() - 1}-12-31`,
        status: 'open',
      },
    ];
    console.log('[PENNYLANE DEMO] fetchAccountingYears — returning demo data');
    return { success: true, demo: true, data: demoData };
  }

  try {
    const res = await fetch(`${BASE_URL}/accounting_years`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.error ?? err.message ?? `Erreur Pennylane (${res.status})`,
      };
    }

    const data = await res.json();
    return { success: true, data: data.accounting_years ?? [] };
  } catch (err) {
    console.error('[PENNYLANE ERROR] fetchAccountingYears', err);
    return { success: false, error: 'Erreur de connexion à Pennylane' };
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

// ─── Fiscal deadlines per company (Zéro Robot approach) ─────────────────────

/** Raw deadline entry returned by the Pennylane API for a company. */
interface PennylaneRawDeadline {
  id?: string;
  type: string;
  label?: string;
  due_date: string;
  status?: string;
}

/**
 * Calcule l'urgence d'une échéance à partir de la date limite.
 * - vert  : plus de 30 jours
 * - orange : 8–30 jours
 * - rouge  : 7 jours ou moins (ou dépassée)
 */
function computeUrgency(dueDateIso: string): UrgencySemantic {
  const diff = Math.ceil((new Date(dueDateIso).getTime() - Date.now()) / 86_400_000);
  if (diff <= 7) return 'red';
  if (diff <= 30) return 'orange';
  return 'green';
}

/** Maps a raw Pennylane deadline type string to our FiscalTaskType. */
function mapTaskType(raw: string): FiscalTaskType {
  const normalized = raw.toUpperCase();
  if (normalized.includes('TVA') && normalized.includes('CA3')) return 'TVA_CA3';
  if (normalized.includes('TVA') && normalized.includes('CA12')) return 'TVA_CA12';
  if (normalized.includes('TVA')) return 'TVA_CA3';
  if (normalized.includes('IS') && normalized.includes('ACOMPTE')) return 'IS_Acompte';
  if (normalized.includes('IS')) return 'IS_Solde';
  if (normalized.includes('CFE')) return 'CFE';
  if (normalized.includes('CVAE')) return 'CVAE';
  if (normalized.includes('DSN')) return 'DSN';
  if (normalized.includes('LIASSE') || normalized.includes('FISCALE')) return 'LIASSE_FISCALE';
  if (normalized.includes('BILAN')) return 'BILAN';
  if (normalized.includes('DAS2')) return 'DAS2';
  if (normalized.includes('PAIE')) return 'PAIE';
  return 'OTHER';
}

/** Maps a Pennylane filing status to our FiscalTaskStatus. */
function mapTaskStatus(raw: string | undefined): FiscalTaskStatus {
  if (!raw) return 'preparation';
  const s = raw.toLowerCase();
  if (s === 'filed' || s === 'télétransmis' || s === 'declared') return 'declared';
  if (s === 'ready' || s === 'prêt') return 'ready';
  if (s === 'waiting_docs' || s === 'en_attente') return 'waiting_docs';
  return 'preparation';
}

/**
 * Récupère les prochaines échéances fiscales (TVA, IS, CFE, etc.) pour une
 * entreprise spécifique depuis l'API Pennylane, puis les mappe vers FiscalTask[].
 *
 * En mode démo (pas de clé API), retourne des données représentatives.
 *
 * @param pennylaneCompanyId - Identifiant Pennylane du client (customer id)
 */
export async function getFiscalDeadlines(
  pennylaneCompanyId: string,
): Promise<{ success: boolean; data?: FiscalTask[]; error?: string; demo?: boolean }> {
  await delay(700);

  const apiKey = getPennylaneKey();

  if (!apiKey) {
    const now = new Date();
    const demoTasks: FiscalTask[] = [
      {
        id: `demo-tva-${pennylaneCompanyId}`,
        client_id: pennylaneCompanyId,
        client_name: 'Client (démo)',
        task_type: 'TVA_CA3',
        due_date: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString().split('T')[0],
        status: 'preparation',
        urgency_semantic: 'orange',
        updated_at: now.toISOString(),
        sync: { source: 'pennylane', last_synced_at: now.toISOString(), sync_status: 'synced' },
      },
      {
        id: `demo-is-${pennylaneCompanyId}`,
        client_id: pennylaneCompanyId,
        client_name: 'Client (démo)',
        task_type: 'IS_Solde',
        due_date: new Date(now.getFullYear(), now.getMonth() + 4, 15).toISOString().split('T')[0],
        status: 'preparation',
        urgency_semantic: 'green',
        updated_at: now.toISOString(),
        sync: { source: 'pennylane', last_synced_at: now.toISOString(), sync_status: 'synced' },
      },
    ];
    return { success: true, demo: true, data: demoTasks };
  }

  try {
    const res = await fetch(`${BASE_URL}/customers/${pennylaneCompanyId}/accounting_years`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
      return {
        success: false,
        error: err.error ?? err.message ?? `Erreur Pennylane (${res.status})`,
      };
    }

    const json = await res.json() as {
      accounting_years?: Array<{
        id: string;
        customer_id: string;
        customer_name?: string;
        closing_date: string;
        status: PennylaneAccountingYear['status'];
        fiscal_deadlines?: PennylaneRawDeadline[];
      }>;
    };

    const synced_at = new Date().toISOString();
    const tasks: FiscalTask[] = [];

    for (const year of json.accounting_years ?? []) {
      const deadlines: PennylaneRawDeadline[] = year.fiscal_deadlines ?? computeFiscalDeadlines(year.closing_date, year.status).map(d => ({
        id: undefined,
        type: d.type,
        label: d.label,
        due_date: d.due_date,
        status: d.filed ? 'filed' : 'preparation',
      }));

      for (const dl of deadlines) {
        const taskType = mapTaskType(dl.type);
        const taskStatus = mapTaskStatus(dl.status);
        const urgency = computeUrgency(dl.due_date);
        tasks.push({
          id: dl.id ?? `${year.id}-${dl.type}`,
          client_id: pennylaneCompanyId,
          client_name: year.customer_name ?? pennylaneCompanyId,
          task_type: taskType,
          due_date: dl.due_date,
          status: taskStatus,
          urgency_semantic: urgency,
          updated_at: synced_at,
          sync: { source: 'pennylane', last_synced_at: synced_at, sync_status: 'synced' },
        });
      }
    }

    return { success: true, data: tasks };
  } catch (err) {
    console.error('[PENNYLANE ERROR] getFiscalDeadlines', err);
    return { success: false, error: 'Erreur de connexion à Pennylane' };
  }
}

// ─── Fiscal debts via Pennylane supplier invoices ────────────────────────────

/** A fiscal debt entry (montant dû au fournisseur DGFIP). */
export interface FiscalDebtEntry {
  /** Internal Pennylane invoice id */
  id: string;
  /** Type of tax debt (TVA, IS, CFE…) */
  tax_type: string;
  /** Amount due in euros */
  amount: number;
  /** ISO due date */
  due_date: string;
  /** Pennylane invoice status */
  status: string;
}

/**
 * Récupère les dettes fiscales envers la DGFIP (fournisseur) depuis la
 * comptabilité Pennylane d'une entreprise.
 *
 * Filtre les factures fournisseur dont le fournisseur est "DGFIP" ou "Trésor Public".
 * En mode démo, retourne des données fictives représentatives.
 *
 * @param pennylaneCompanyId - Identifiant Pennylane du client
 */
export async function getFiscalDebts(
  pennylaneCompanyId: string,
): Promise<{ success: boolean; data?: FiscalDebtEntry[]; error?: string; demo?: boolean }> {
  await delay(600);

  const apiKey = getPennylaneKey();

  if (!apiKey) {
    const now = new Date();
    const demoDebts: FiscalDebtEntry[] = [
      {
        id: `demo-debt-tva-${pennylaneCompanyId}`,
        tax_type: 'TVA',
        amount: 2340.5,
        due_date: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString().split('T')[0],
        status: 'pending',
      },
    ];
    return { success: true, demo: true, data: demoDebts };
  }

  try {
    // Fetch all unpaid supplier invoices then filter client-side for DGFIP / Trésor Public
    const res = await fetch(
      `${BASE_URL}/customers/${pennylaneCompanyId}/supplier_invoices?status=unpaid`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
      return {
        success: false,
        error: err.error ?? err.message ?? `Erreur Pennylane (${res.status})`,
      };
    }

    const json = await res.json() as {
      supplier_invoices?: Array<{
        id: string;
        label?: string;
        supplier_name?: string;
        total_amount?: number;
        due_date?: string;
        status?: string;
      }>;
    };

    const DGFIP_SUPPLIERS = ['dgfip', 'trésor public', 'tresor public', 'direction générale des finances publiques'];
    const data: FiscalDebtEntry[] = (json.supplier_invoices ?? [])
      .filter(inv => {
        const name = (inv.supplier_name ?? inv.label ?? '').toLowerCase();
        return DGFIP_SUPPLIERS.some(s => name.includes(s));
      })
      .map(inv => ({
        id: inv.id,
        tax_type: inv.label ?? 'DGFIP',
        amount: inv.total_amount ?? 0,
        due_date: inv.due_date ?? new Date().toISOString().split('T')[0],
        status: inv.status ?? 'unknown',
      }));

    return { success: true, data };
  } catch (err) {
    console.error('[PENNYLANE ERROR] getFiscalDebts', err);
    return { success: false, error: 'Erreur de connexion à Pennylane' };
  }
}