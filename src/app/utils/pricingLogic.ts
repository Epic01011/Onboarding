/**
 * pricingLogic.ts
 *
 * Pure TypeScript pricing engine.
 * No mocks — implements the actual tariff schedule.
 *
 * Social rates (cabinet tariff document):
 *   - Bulletin de salaire       : 30 €/bulletin
 *   - DSN mensuelle             : 10 €/mois (si salariés)
 *   - Mise en place mono-établissement  : 200 € (one-time)
 *   - Mise en place multi-établissements: 350 € (one-time)
 *
 * Comptabilité rates:
 *   - TAUX_HORAIRE_TENUE     : 90 €/h  (tenue comptable — collaborateur)
 *   - TAUX_HORAIRE_REVISION  : 200 €/h (révision & clôture — expert-comptable)
 *   - COEFF_NUMERISATION     : 0.7  (minoration 30% si 100% numérisé)
 *   - COEFF_PAPIER           : 1.3  (majoration 30% si documents papier)
 *
 * Révision & clôture :
 *   Le temps annuel de révision combine deux composantes :
 *   1. Base incompressible par forme juridique + régime fiscal + lots (getRevisionBaseHours)
 *   2. Bonus lié au chiffre d'affaires, modulé par la complexité de la forme (getRevisionCABonus)
 *
 * Integration fees (débours uniques):
 *   - Paramétrage, conformité LAB, KBIS, FEC : 490 €
 *
 * Options / add-ons (monthly):
 *   - 5 tickets support / an    : +21 €/mois
 *   - Ligne WhatsApp dédiée     : +35 €/mois
 *   - Appels prioritaires compris: +45 €/mois
 */

import type {
  CompanyProfile,
  AccountingMetrics,
  SocialMetrics,
  PricingOptions,
  InvoiceRange,
  LegalForm,
  RevenueRange,
  Digitalization,
  TvaFrequency,
} from '../store/usePricingStore';

import type { TaxRegime } from '../store/usePricingStore';

// ─── Rates & constants ────────────────────────────────────────────────────────

/** Taux horaire tenue comptable (collaborateur) */
export const TAUX_HORAIRE_TENUE     = 90;  // €/h
/** Taux horaire révision & clôture (expert-comptable) */
export const TAUX_HORAIRE_REVISION  = 200; // €/h
/** Coefficient si 100 % numérisé — minoration 30 % */
export const COEFF_NUMERISATION     = 0.7;
/** Coefficient si documents papier — majoration 30 % */
export const COEFF_PAPIER           = 1.3;

export const SETUP_FEES   = 490; // € — frais uniques d'intégration cabinet

// Social
export const BULLETIN_RATE     = 30;  // €/bulletin
export const DSN_MONTHLY_FEE   = 10;  // €/mois si bulletins > 0
export const SOCIAL_SETUP_MONO  = 200; // € one-time — mono-établissement
export const SOCIAL_SETUP_MULTI = 350; // € one-time — multi-établissements

// Accounting option
export const BILAN_COMPRIS_MONTHLY = 25; // €/mois
export const ATTERRISSAGE_MONTHLY = Math.ceil(200 / 12); // 1 h expert (200 €) ÷ 12 mois ≈ 17 €/mois
export const SITUATIONS_TRIM_MONTHLY = 25; // €/mois — situations trimestrielles
export const SITUATIONS_MENS_MONTHLY = 50; // €/mois — situations mensuelles

// Add-on options (monthly)
export const OPTION_PRICES = {
  ticketsSupport5an:   21,              // 5 tickets/an ÷ 12 ≈ 21 €/mois
  whatsappDedie:       35,              // Ligne WhatsApp dédiée
  appelsPrioritaires:  45,              // Appels prioritaires compris
  assembleGenerale:    Math.ceil(299 / 12), // AG + dépôt comptes — 299 €/an → 25 €/mois
} as const;

// TVA impact — heures annuelles supplémentaires selon la fréquence des déclarations
export const TVA_ANNUAL_HOURS: Record<TvaFrequency, number> = {
  Mensuel:      6,   // 12 déclarations × 0.5 h
  Trimestriel:  2,   // 4 déclarations × 0.5 h
  Annuel:       0.5, // 1 déclaration × 0.5 h
};

// ─── Per-event tariff table (displayed informationally in the UI) ─────────────

/** Tariff items charged per event (shown in the form, not in the monthly quote) */
export const SOCIAL_EVENT_TARIFF = [
  { label: "Entrée d'un salarié",                  price: 50,  unit: '€ / embauche' },
  { label: "Départ d'un salarié (solde de tout compte)", price: 90, unit: '€ / départ' },
  { label: "Déclaration unique d'embauche",         price: 23,  unit: '€ / embauche' },
  { label: "Attestation maladie / maternité / AT",  price: 25,  unit: '€ / attestation' },
  { label: "Simulation de paie",                    price: 45,  unit: '€ / simulation' },
  { label: "Contrat de travail",                    price: 85,  unit: '€ / contrat' },
  { label: "Procédure de licenciement simple",      price: 250, unit: '€' },
  { label: "Document CSP",                          price: 250, unit: '€' },
  { label: "Contrats complexes",                    price: 85,  unit: '€/h' },
  { label: "Courriers divers",                      price: 80,  unit: '€/h' },
  { label: "Conseil RH",                            price: 170, unit: '€/h' },
  { label: "Assistance contrôle URSSAF",            price: 170, unit: '€/h' },
  { label: "Audit social",                          price: 150, unit: '€/h' },
  { label: "Demande d'échéancier / Appel caisses",  price: 100, unit: '€/h' },
  { label: "Adhésions caisses mutuelle & prévoyance", price: 80, unit: '€/h' },
];

// ─── Lookup tables ────────────────────────────────────────────────────────────

const INVOICE_MIDPOINTS: Record<InvoiceRange, number> = {
  '<10':       5,
  '10-20':     15,
  '20-40':     30,
  '40-80':     60,
  '80-200':    140,
  '200-500':   350,
  '500-1000':  750,
  '1000-1500': 1250,
  '>1500':     2000,
};

const DIGITALIZATION_COEFF: Record<Digitalization, number> = {
  numerique: COEFF_NUMERISATION, // 0.7 — minoration 30 %
  papier:    COEFF_PAPIER,       // 1.3 — majoration 30 %
};

/**
 * Temps de tenue comptable brut (heures/mois) selon le volume total de pièces.
 * Renvoie null si le volume dépasse 1 500 pièces/mois (→ "Sur devis").
 *
 * Tranches basées sur la somme factures vente + factures achat.
 */
function getTenureHoursPerMonth(totalMidpoint: number): number | null {
  if (totalMidpoint < 10)   return 0.5;
  if (totalMidpoint < 20)   return 1;
  if (totalMidpoint < 40)   return 2;
  if (totalMidpoint < 80)   return 3.5;
  if (totalMidpoint < 200)  return 7;
  if (totalMidpoint < 500)  return 12;
  if (totalMidpoint < 1000) return 20;
  if (totalMidpoint <= 1500) return 30;
  return null; // Sur devis
}

/**
 * Temps de révision & clôture annuel incompressible (heures) selon la forme juridique,
 * le régime fiscal et le nombre de lots immobiliers (SCI / LMNP).
 * Ne tient pas compte du CA — c'est le plancher par structure.
 */
export function getRevisionBaseHours(
  legalForm: LegalForm,
  taxRegime: TaxRegime,
  lotsImmobiliers: number,
): number {
  const lots = Math.max(0, lotsImmobiliers - 1); // lots supplémentaires au-delà du 1er
  switch (legalForm) {
    case 'SASU':
    case 'EURL':
      return 6 + (taxRegime === 'IS' ? 4 : 0);
    case 'EI':
      return 5;
    case 'SARL':
    case 'SAS':
      return 8 + (taxRegime === 'IS' ? 4 : 0);
    case 'SNC':
      return 8;
    case 'SCI':
      if (taxRegime === 'IS') return 6 + lots * 1.5;
      return 3 + lots * 0.5;
    case 'LMNP_REEL':
      return 5 + lots * 1.75; // midpoint de la fourchette 1,5 h – 2 h
    case 'LMNP_MICROBIC':
      return 0.5; // midpoint de la fourchette 0 – 1 h (déclaration 2042 C-PRO)
    default:
      return 8;
  }
}

/**
 * Heures supplémentaires de révision liées au chiffre d'affaires (brutes),
 * modulées par le coefficient de complexité de la forme juridique.
 *
 * Ce bonus représente la charge additionnelle : plus d'écritures, davantage
 * d'ajustements comptables, de rubriques fiscales et de contrôles internes.
 */
const REVENUE_REVISION_BONUS: Record<RevenueRange, number> = {
  '<100k':     0,   // Structure simple — base incompressible suffit
  '100k-250k': 1,   // PME en développement
  '250k-500k': 2,   // PME établie
  '500k-1M':   4,   // PME significative
  '1M-3M':     7,   // ETI émergente
  '3M-5M':     10,  // ETI confirmée
  '5M-10M':    14,  // Grande PME
  '>10M':      20,  // Grande entreprise / groupe
};

/** Coefficient de complexité appliqué au bonus CA lors de la révision */
const LEGAL_FORM_REVISION_COEFF: Record<LegalForm, number> = {
  EI:            0.8,
  LMNP_REEL:     0.85,
  LMNP_MICROBIC: 0.3,
  SCI:           0.8,
  EURL:          1.0,
  SARL:          1.1,
  SASU:          1.1,
  SAS:           1.2,
  SNC:           1.3,
  ASSO:          0.9,
};

/**
 * Heures de révision additionnelles dues au volume du CA, pour une forme donnée.
 * Renvoie 0 pour les CA inférieurs à 100 k€.
 */
export function getRevisionCABonus(
  revenueRange: RevenueRange,
  legalForm: LegalForm,
): number {
  const raw = REVENUE_REVISION_BONUS[revenueRange];
  if (raw === 0) return 0;
  return raw * LEGAL_FORM_REVISION_COEFF[legalForm];
}

/**
 * Temps de révision & clôture annuel total (heures) :
 * base incompressible (forme + régime + lots) + bonus CA.
 *
 * Le paramètre `revenueRange` est optionnel et vaut '<100k' par défaut
 * (aucun bonus CA) — utile pour les previews de l'UI où seule la base
 * est connue, ou dans les tests unitaires. En production, `calculateQuote`
 * appelle directement `getRevisionBaseHours` + `getRevisionCABonus` pour
 * avoir accès aux deux valeurs séparément.
 */
export function getRevisionHours(
  legalForm: LegalForm,
  taxRegime: TaxRegime,
  lotsImmobiliers: number,
  revenueRange: RevenueRange = '<100k',
): number {
  return getRevisionBaseHours(legalForm, taxRegime, lotsImmobiliers)
    + getRevisionCABonus(revenueRange, legalForm);
}

// ─── Gestion juridique — secrétariat annuel (tarif par forme juridique) ───────

/** Prix annuel du secrétariat juridique récurrent selon la forme juridique */
export function getSecretariatJuridiqueAnnuel(legalForm: LegalForm): number | null {
  switch (legalForm) {
    case 'SCI':
    case 'EURL':
    case 'SASU':
    case 'SARL':
    case 'SAS':
      return 299; // Dépôt des comptes + PV d'AG — 299 €/an = 25 €/mois hors débours
    default:
      return null; // EI, SNC, LMNP — pas de secrétariat juridique standard
  }
}

/** Tarifs des prestations juridiques exceptionnelles (à l'acte) */
export const JURIDIQUE_ACTE_TARIFF = [
  { label: 'Attestations particulières',     price: 'à partir de 100', unit: '€', note: '' },
  { label: 'Transfert de siège social',      price: '500 – 880', unit: '€', note: 'Varie selon le changement de ressort de greffe' },
  { label: 'Changement de dirigeant',        price: '800',       unit: '€', note: 'Rédaction d\'acte et formalités' },
  { label: 'Cession de parts sociales',      price: '800',       unit: '€', note: 'Rédaction de l\'acte et enregistrement' },
  { label: 'Augmentation de capital',        price: '1 000',     unit: '€', note: 'Numéraire ou apport en nature' },
  { label: 'Dissolution et liquidation',     price: '1 000',     unit: '€', note: 'Inclut les deux phases : dissolution puis radiation' },
] as const;

// ─── Result type ──────────────────────────────────────────────────────────────

export interface PricingResult {
  /** Mensuel — tenue comptable (collaborateur) */
  monthlyAccountingPrice: number;
  /** Mensuel — clôture / liasse fiscale (expert-comptable) */
  monthlyClosurePrice: number;
  /** Mensuel — gestion sociale (bulletins + DSN) */
  monthlySocialPrice: number;
  /** Mensuel — options add-ons (bilan compris, tickets, WhatsApp, appels) */
  monthlyOptionsPrice: number;
  /** Frais uniques intégration cabinet (débours) */
  setupFees: number;
  /** Frais uniques — mise en place dossier social */
  socialSetupFees: number;
  /** Total mensuel HT = accounting + closure + social + options */
  totalMonthlyHT: number;

  // ─ Détails affichage sidebar ─
  annualInvoiceHours: number;
  /** Heures de révision totales (base + bonus CA) */
  closureAdjustedHours: number;
  /** Heures incompressibles de révision (forme juridique + régime + lots) */
  revisionBaseHours: number;
  /** Heures additionnelles de révision dues au CA */
  revisionCABonus: number;
  /** Vrai si le volume de pièces dépasse 1 500 / mois → tarification sur devis */
  surDevis: boolean;
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export function calculateQuote(
  company: CompanyProfile,
  accounting: AccountingMetrics,
  social: SocialMetrics,
  options: PricingOptions,
): PricingResult {
  // ── 1. Tenue comptable ────────────────────────────────────────────────────
  const salesMid    = INVOICE_MIDPOINTS[accounting.salesInvoices];
  const purchaseMid = INVOICE_MIDPOINTS[accounting.purchaseInvoices];
  const totalMid    = salesMid + purchaseMid;
  const digitCoeff  = DIGITALIZATION_COEFF[accounting.digitalization];

  // Temps de tenue brut selon la table de volumétrie
  const tenureHoursPerMonth = getTenureHoursPerMonth(totalMid);
  const surDevis = tenureHoursPerMonth === null;

  // Heures annuelles de tenue = heures brutes × 12 × coeff format
  const annualInvoiceHours = surDevis ? 0 : (tenureHoursPerMonth! * 12 * digitCoeff);

  // heures TVA annuelles selon assujettissement et fréquence
  const tvaHoursPerYear = accounting.isSubjectToTVA
    ? TVA_ANNUAL_HOURS[accounting.tvaFrequency]
    : 0;

  const monthlyAccountingPrice = surDevis ? 0 : Math.ceil(
    ((annualInvoiceHours + tvaHoursPerYear) * TAUX_HORAIRE_TENUE) / 12,
  );

  // ── 2. Révision & clôture (liasse fiscale) ────────────────────────────────
  const revisionBaseHours = getRevisionBaseHours(
    company.legalForm,
    company.taxRegime,
    company.lotsImmobiliers ?? 1,
  );
  const revisionCABonus = getRevisionCABonus(company.revenueRange, company.legalForm);
  const closureAdjustedHours = revisionBaseHours + revisionCABonus;
  const monthlyClosurePrice = Math.ceil((closureAdjustedHours * TAUX_HORAIRE_REVISION) / 12);

  // ── 3. Social (tarif cabinet réel) ───────────────────────────────────────
  const bulletins = social.bulletinsPerMonth;
  // Bulletins de salaire : 30 €/bulletin + DSN mensuelle 10 €
  const monthlySocialPrice = bulletins > 0
    ? bulletins * BULLETIN_RATE + DSN_MONTHLY_FEE
    : 0;

  // Frais de mise en place dossier social (one-time)
  const socialSetupFees = bulletins > 0
    ? (social.multiEtablissement ? SOCIAL_SETUP_MULTI : SOCIAL_SETUP_MONO)
    : 0;

  // ── 4. Options add-ons ────────────────────────────────────────────────────
  const bilanMontly = accounting.bilanCompris ? BILAN_COMPRIS_MONTHLY : 0;
  const atterrissageMontly = accounting.rdvAtterrissage ? ATTERRISSAGE_MONTHLY : 0;
  const situationsTrimMontly = accounting.situationsTrimestrielles ? SITUATIONS_TRIM_MONTHLY : 0;
  const situationsMensMontly = accounting.situationsMensuelles ? SITUATIONS_MENS_MONTHLY : 0;

  // Secrétariat juridique annuel (montant dynamique selon la forme juridique)
  const secretariatAnnuel = getSecretariatJuridiqueAnnuel(company.legalForm);
  const secretariatMontly = options.assembleGenerale && secretariatAnnuel !== null
    ? Math.ceil(secretariatAnnuel / 12)
    : options.assembleGenerale ? OPTION_PRICES.assembleGenerale : 0;

  const optionsMonthly =
    (options.ticketsSupport5an  ? OPTION_PRICES.ticketsSupport5an  : 0) +
    (options.whatsappDedie      ? OPTION_PRICES.whatsappDedie      : 0) +
    (options.appelsPrioritaires ? OPTION_PRICES.appelsPrioritaires : 0);
  const monthlyOptionsPrice = bilanMontly + atterrissageMontly + situationsTrimMontly + situationsMensMontly + secretariatMontly + optionsMonthly;

  // ── 5. Total ──────────────────────────────────────────────────────────────
  const totalMonthlyHT =
    monthlyAccountingPrice + monthlyClosurePrice + monthlySocialPrice + monthlyOptionsPrice;

  return {
    monthlyAccountingPrice,
    monthlyClosurePrice,
    monthlySocialPrice,
    monthlyOptionsPrice,
    setupFees: SETUP_FEES,
    socialSetupFees,
    totalMonthlyHT,
    annualInvoiceHours,
    closureAdjustedHours,
    revisionBaseHours,
    revisionCABonus,
    surDevis,
  };
}
