/**
 * usePricingStore.ts
 *
 * Ephemeral Zustand store for the interactive Pricing Engine form.
 * Holds the four sections of the pricing questionnaire and the list of
 * proposals saved during the current session.
 */

import { create } from 'zustand';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type LegalForm = 'SARL' | 'SAS' | 'SASU' | 'EURL' | 'SNC' | 'SCI' | 'EI' | 'LMNP_REEL' | 'LMNP_MICROBIC' | 'ASSO';
export type TaxRegime = 'IS' | 'IR';
export type RevenueRange = '<100k' | '100k-250k' | '250k-500k' | '500k-1M' | '1M-3M' | '3M-5M' | '5M-10M' | '>10M';
export type InvoiceRange = '<10' | '10-20' | '20-40' | '40-80' | '80-200' | '200-500' | '500-1000' | '1000-1500' | '>1500';
export type Digitalization = 'numerique' | 'papier';
export type TvaFrequency = 'Mensuel' | 'Trimestriel' | 'Annuel';
/** All possible lifecycle statuses for a quote, shared with the Supabase schema */
export type QuoteStatus = 'DRAFT' | 'SENT' | 'VALIDATED' | 'SIGNED' | 'PENDING_ONBOARDING';

export interface CompanyProfile {
  /** Numéro SIREN (9 chiffres) */
  siren: string;
  /** Raison sociale (auto-remplie via API SIREN) */
  raisonSociale: string;
  /** Nom du contact principal */
  nomContact: string;
  /** Prénom du contact principal */
  prenomContact: string;
  clientName: string;
  clientEmail: string;
  /** Adresse du siège (rue, etc.) */
  adresse: string;
  /** Code postal */
  codePostal: string;
  /** Ville */
  ville: string;
  activity: string;
  legalForm: LegalForm;
  revenueRange: RevenueRange;
  taxRegime: TaxRegime;
  /** Nombre de lots immobiliers (pour SCI et LMNP_REEL) */
  lotsImmobiliers: number;
}

export interface AccountingMetrics {
  salesInvoices: InvoiceRange;
  purchaseInvoices: InvoiceRange;
  digitalization: Digitalization;
  /** Bilan annuel inclus dans le forfait mensuel */
  bilanCompris: boolean;
  /** Rendez-vous d'atterrissage pré-bilan 1 h */
  rdvAtterrissage: boolean;
  /** Situations comptables trimestrielles */
  situationsTrimestrielles: boolean;
  /** Situations comptables mensuelles */
  situationsMensuelles: boolean;
  /** Assujetti à la TVA */
  isSubjectToTVA: boolean;
  /** Fréquence des déclarations TVA */
  tvaFrequency: TvaFrequency;
}

export interface SocialMetrics {
  bulletinsPerMonth: number;
  /** Dossier multi-établissements (setup 350€) vs mono (200€) */
  multiEtablissement: boolean;
}

/** Service add-on options (checkboxes) that adjust the monthly total */
export interface PricingOptions {
  /** 5 tickets de support / an */
  ticketsSupport5an: boolean;
  /** Ligne WhatsApp dédiée */
  whatsappDedie: boolean;
  /** Appels prioritaires compris */
  appelsPrioritaires: boolean;
  /** Assemblée générale + dépôt des comptes (290 €/an, amorti mensuel) */
  assembleGenerale: boolean;
}

export interface SavedQuote {
  id: string;
  /** Supabase row id — set after successful persistence */
  supabaseId?: string;
  /** Lifecycle status in the database */
  status: QuoteStatus;
  clientName: string;
  /** SIREN du prospect/client (9 chiffres) — set from companyProfile at save time */
  siren?: string;
  /** Email du contact principal — set from companyProfile at save time */
  contactEmail?: string;
  /** Raison sociale légale (distinct de clientName qui peut être le nom du contact) */
  raisonSociale?: string;
  /** Adresse du siège social */
  adresse?: string;
  /** Code postal du siège social */
  codePostal?: string;
  /** Ville du siège social */
  ville?: string;
  /** Secteur d'activité / code NAF */
  activity?: string;
  legalForm: LegalForm;
  revenueRange: RevenueRange;
  taxRegime: TaxRegime;
  digitalization: Digitalization;
  bulletinsPerMonth: number;
  multiEtablissement: boolean;
  bilanCompris: boolean;
  rdvAtterrissage: boolean;
  options: PricingOptions;
  /** Volume de factures de vente — sert à contextualiser l'offre dans l'email */
  salesInvoices?: InvoiceRange;
  /** Volume de factures d'achat */
  purchaseInvoices?: InvoiceRange;
  monthlyAccountingPrice: number;
  monthlyClosurePrice: number;
  monthlySocialPrice: number;
  monthlyOptionsPrice: number;
  setupFees: number;
  totalMonthlyHT: number;
  createdAt: string;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface PricingStore {
  companyProfile: CompanyProfile;
  accounting: AccountingMetrics;
  social: SocialMetrics;
  options: PricingOptions;
  savedQuotes: SavedQuote[];

  setCompanyProfile: <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => void;
  setAccounting: <K extends keyof AccountingMetrics>(key: K, value: AccountingMetrics[K]) => void;
  setSocial: <K extends keyof SocialMetrics>(key: K, value: SocialMetrics[K]) => void;
  setOption: <K extends keyof PricingOptions>(key: K, value: boolean) => void;
  saveQuote: (quote: SavedQuote) => void;
  removeQuote: (id: string) => void;
  updateQuoteStatus: (id: string, status: QuoteStatus, supabaseId?: string) => void;
  resetPricingForm: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_COMPANY: CompanyProfile = {
  siren: '',
  raisonSociale: '',
  nomContact: '',
  prenomContact: '',
  clientName: '',
  clientEmail: '',
  adresse: '',
  codePostal: '',
  ville: '',
  activity: '',
  legalForm: 'SARL',
  revenueRange: '100k-250k',
  taxRegime: 'IS',
  lotsImmobiliers: 1,
};

const DEFAULT_ACCOUNTING: AccountingMetrics = {
  salesInvoices: '10-20',
  purchaseInvoices: '20-40',
  digitalization: 'numerique',
  bilanCompris: false,
  rdvAtterrissage: false,
  situationsTrimestrielles: false,
  situationsMensuelles: false,
  isSubjectToTVA: true,
  tvaFrequency: 'Mensuel',
};

const DEFAULT_SOCIAL: SocialMetrics = {
  bulletinsPerMonth: 0,
  multiEtablissement: false,
};

const DEFAULT_OPTIONS: PricingOptions = {
  ticketsSupport5an: false,
  whatsappDedie: false,
  appelsPrioritaires: false,
  assembleGenerale: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePricingStore = create<PricingStore>(set => ({
  companyProfile: DEFAULT_COMPANY,
  accounting: DEFAULT_ACCOUNTING,
  social: DEFAULT_SOCIAL,
  options: DEFAULT_OPTIONS,
  savedQuotes: [],

  setCompanyProfile: (key, value) =>
    set(s => ({ companyProfile: { ...s.companyProfile, [key]: value } })),

  setAccounting: (key, value) =>
    set(s => ({ accounting: { ...s.accounting, [key]: value } })),

  setSocial: (key, value) =>
    set(s => ({ social: { ...s.social, [key]: value } })),

  setOption: (key, value) =>
    set(s => ({ options: { ...s.options, [key]: value } })),

  saveQuote: quote =>
    set(s => ({ savedQuotes: [quote, ...s.savedQuotes] })),

  removeQuote: id =>
    set(s => ({ savedQuotes: s.savedQuotes.filter(q => q.id !== id) })),

  updateQuoteStatus: (id, status, supabaseId) =>
    set(s => ({
      savedQuotes: s.savedQuotes.map(q =>
        q.id === id ? { ...q, status, ...(supabaseId !== undefined ? { supabaseId } : {}) } : q
      ),
    })),

  resetPricingForm: () =>
    set({
      companyProfile: DEFAULT_COMPANY,
      accounting: DEFAULT_ACCOUNTING,
      social: DEFAULT_SOCIAL,
      options: DEFAULT_OPTIONS,
    }),
}));
