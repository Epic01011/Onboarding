/**
 * dashboard.ts — Core domain types for the accounting firm dashboard.
 *
 * Covers: KYC/Onboarding, Fiscal tasks, AI email drafts, Pricing engine,
 * and Dunning (relances).
 *
 * Convention: names in English, UI labels in French.
 */

// ─── Pappers / INSEE API ─────────────────────────────────────────────────────

export interface PappersOfficer {
  name: string;
  role: string;
  birth_year?: number | null;
}

/** Structured response from the Pappers (or INSEE Sirene) API for a French company. */
export interface PappersCompanyResponse {
  /** SIREN (9 digits) */
  company_number: string;
  /** Raison sociale */
  name: string;
  /** Forme juridique code (ex. "SARL", "SAS", "EURL") */
  legal_form_code: string | null;
  /** Libellé forme juridique */
  legal_form_label: string | null;
  /** Statut de l'entreprise (active, liquidée…) */
  status: 'active' | 'liquidated' | 'dissolved' | 'unknown' | null;
  /** Numéro de TVA intracommunautaire */
  vat_number: string | null;
  /** Tranche d'effectif (ex. "10-19", "20-49") */
  workforce_range: string | null;
  /** Date de création (ISO date string) */
  creation_date: string | null;
  /** Code NAF / APE */
  naf_code: string | null;
  /** Libellé activité NAF */
  naf_label: string | null;
  /** Adresse siège social */
  address: string | null;
  /** Code postal */
  postal_code: string | null;
  /** Ville */
  city: string | null;
  /** Capital social en euros */
  share_capital: number | null;
  /** Liste des dirigeants */
  officers: PappersOfficer[];
  /** Dernier SIRET siège */
  siret: string | null;
}

// ─── Client KYC ─────────────────────────────────────────────────────────────

export type OnboardingStatus = 'pending' | 'signed' | 'active';

/** Extends PappersCompanyResponse with internal cabinet-specific fields. */
export interface ClientKYC extends PappersCompanyResponse {
  /** Internal unique ID in the cabinet's system */
  internal_client_id: string;
  /** Computed complexity score used by the pricing engine (0–100) */
  complexity_score: number;
  /** Human-readable complexity label returned by the KYC API */
  complexityLabel: string;
  /** Risk level derived from the complexity score */
  riskScore: 'low' | 'medium' | 'high';
  /** Current onboarding status */
  onboarding_status: OnboardingStatus;
  /** Contact email for the client */
  contact_email: string | null;
  /** Contact phone */
  contact_phone: string | null;
  /** Date the client was created in the system (ISO) */
  created_at: string;
  /** Date of last update (ISO) */
  updated_at: string;
  /** ISO timestamp when the KYC form was submitted */
  submittedAt: string;
  /** Pennylane customer ID — required for fiscal deadline and debt sync */
  pennylane_company_id?: string;
}

// ─── Bidirectional Sync (Impôts.gouv / Pennylane) ───────────────────────────

/** The external system a fiscal task was last synchronised with. */
export type SyncSource = 'impots_gouv' | 'pennylane' | 'manual';

/** Synchronisation state between the cabinet system and an external source. */
export type SyncStatus =
  | 'synced'        // in sync with remote
  | 'pending_push'  // local change not yet pushed to remote
  | 'pending_pull'  // remote change not yet pulled locally
  | 'conflict'      // divergent states — human resolution required
  | 'error';        // sync attempt failed

export interface SyncMetadata {
  source: SyncSource;
  /** ID of the record in the external system */
  external_id?: string;
  /** ISO timestamp of the last successful sync */
  last_synced_at: string;
  sync_status: SyncStatus;
}

// ─── Fiscal & Social Tasks ───────────────────────────────────────────────────

export type FiscalTaskType =
  | 'TVA_CA3'
  | 'TVA_CA12'
  | 'IS_Solde'
  | 'IS_Acompte'
  | 'CVAE'
  | 'CFE'
  | 'DSN'
  | 'LIASSE_FISCALE'
  | 'BILAN'
  | 'DAS2'
  | 'PAIE'
  | 'OTHER';

export type FiscalTaskStatus =
  | 'preparation'
  | 'waiting_docs'
  | 'ready'
  | 'declared';

export type UrgencySemantic = 'green' | 'orange' | 'red';

/** Production step for BILAN tasks, mirrored from Pennylane accounting year status. */
export type ProductionStep =
  | 'not_started'
  | 'data_collection'
  | 'revision'
  | 'final_review'
  | 'certified';

/** Represents a fiscal/social obligation in the calendar. */
export interface FiscalTask {
  id: string;
  client_id: string;
  /** Display name for the client (denormalized for UI performance) */
  client_name: string;
  task_type: FiscalTaskType;
  /** ISO date string — legal deadline */
  due_date: string;
  status: FiscalTaskStatus;
  /** Color indicator based on proximity to due_date */
  urgency_semantic: UrgencySemantic;
  /** Optional note */
  note?: string;
  /** Who is assigned */
  assigned_to?: string;
  /** ISO date when last updated */
  updated_at: string;
  /** Bidirectional sync metadata (Impôts.gouv / Pennylane) */
  sync?: SyncMetadata;
  /** True when data has been certified directly by the DGFIP portal */
  is_dgfip_certified?: boolean;
  /** True when a discrepancy is detected between accounting data (e.g. Pennylane) and DGFIP fiscal accounts */
  mismatch_alert?: boolean;
  /** Download URL for the tax compliance certificate (attestation de régularité fiscale) */
  tax_compliance_certificate_url?: string;

  // ── BILAN-specific fields (populated via Pennylane sync) ──────────────────
  /** ISO date of the fiscal year closing (from Pennylane) — BILAN tasks only */
  closing_date?: string;
  /** Current production step for balance sheet preparation — BILAN tasks only */
  production_step?: ProductionStep;
  /** Collaborateur assigned to coordinate the balance sheet — BILAN tasks only */
  assigned_manager?: string;
}

// ─── AI Email Draft (RAG BOFiP) ──────────────────────────────────────────────

export type AIEmailDraftStatus = 'pending_review' | 'approved' | 'rejected';

/** Represents a draft generated by the RAG fiscal pipeline. */
export interface AIEmailDraft {
  id: string;
  client_id: string;
  /** Display name for the client */
  client_name: string;
  /** Original email text received from the client */
  original_email_text: string;
  /** Draft generated by the AI (to be reviewed before sending) */
  ai_generated_draft: string;
  /** List of BOFiP / legal references cited */
  bofip_sources_cited: string[];
  status: AIEmailDraftStatus;
  /** Subject line extracted from the original email */
  subject?: string;
  /** Received date (ISO) */
  received_at: string;
  /** When the draft was generated (ISO) */
  drafted_at: string;
  /** Validated/modified draft text (if the accountant edited the AI draft) */
  final_draft?: string;
  /** Who validated / rejected */
  reviewed_by?: string;
  /** ISO date of review */
  reviewed_at?: string;
}

// ─── Pricing Engine ──────────────────────────────────────────────────────────

/** Complexity inductors that affect pricing. */
export interface PricingInductors {
  /** Average monthly invoice volume */
  monthly_invoice_volume: number;
  /** Does the company deal with international transactions? */
  has_international_ops: boolean;
  /** Does the company manage stock? */
  has_stock_management: boolean;
  /** Number of employees (for payroll) */
  employee_count: number;
  /** Does the company have multiple VAT regimes? */
  has_multiple_vat: boolean;
  /** Is the company a holding or group structure? */
  is_holding: boolean;
  /** Does the company require DAS2 declaration? */
  requires_das2: boolean;
}

/** A line item in the pricing proposal. */
export interface PricingLine {
  label: string;
  base_hours: number;
  coefficient: number;
  hours_after_coeff: number;
  hourly_rate: number;
  annual_amount: number;
}

/** Full pricing proposal for a client. */
export interface PricingProposal {
  id: string;
  client_id: string;
  client_name: string;
  inductors: PricingInductors;
  lines: PricingLine[];
  total_hours: number;
  total_annual_ht: number;
  monthly_ht: number;
  created_at: string;
  /** n8n job id for async PDF generation */
  pdf_job_id?: string;
  pdf_url?: string;
}

// ─── Dunning / Relances ──────────────────────────────────────────────────────

export type DunningStepType =
  | 'email_j_minus_3'
  | 'email_j_plus_7'
  | 'email_j_plus_15'
  | 'sms_j_plus_15'
  | 'email_j_plus_30'
  | 'lrar_j_plus_45';

export type DunningStatus = 'scheduled' | 'sent' | 'acknowledged' | 'cancelled';

export interface DunningStep {
  id: string;
  client_id: string;
  client_name: string;
  step_type: DunningStepType;
  /** Invoice or document reference */
  reference: string;
  amount_due?: number;
  status: DunningStatus;
  scheduled_at: string;
  sent_at?: string;
}

// ─── n8n async job ──────────────────────────────────────────────────────────

/** Represents a pending n8n async job (202 Accepted). */
export interface N8nJob {
  job_id: string;
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  created_at: string;
}

// ─── Client (Dossier) — Zéro Robot fields ────────────────────────────────────

/**
 * Lightweight client record used by fiscal panels and API connectors.
 * `siren` is the legal identifier; `pennylane_company_id` links the dossier
 * to Pennylane for deadline and debt sync.
 */
export interface Client {
  /** Internal unique ID */
  id: string;
  /** Raison sociale */
  name: string;
  /** SIREN (9 digits) — used by API Entreprise for tax certificates */
  siren: string;
  /** Pennylane customer ID — used for fiscal deadline and debt sync */
  pennylane_company_id?: string;
  /** Contact email */
  email?: string;
}
