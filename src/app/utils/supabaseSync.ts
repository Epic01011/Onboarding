/**
 * supabaseSync.ts — Persistance Supabase pour l'onboarding CabinetFlow
 *
 * Tables cibles :
 *   onboarding_cases   — Brouillons et états des dossiers en cours
 *   onboarding_events  — Journal d'audit (audit log) des actions utilisateurs
 *
 * En développement / sans configuration Supabase, les fonctions dégradent
 * silencieusement vers un mode no-op en loguant dans la console.
 *
 * Schéma SQL suggéré (à créer via Supabase Dashboard / migrations) :
 *
 *   CREATE TABLE onboarding_cases (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *     dossier_id   TEXT NOT NULL UNIQUE,
 *     step_id      TEXT NOT NULL DEFAULT 'collecte',
 *     status       TEXT NOT NULL DEFAULT 'draft',
 *     mission_type TEXT CHECK (mission_type IN ('reprise', 'creation')),
 *     client_data  JSONB,
 *     step_statuses JSONB,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   CREATE TABLE onboarding_events (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id      UUID REFERENCES auth.users(id),
 *     dossier_id   TEXT NOT NULL,
 *     event_type   TEXT NOT NULL,
 *     payload      JSONB,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */

import { supabase } from './supabaseClient';
import type { QuoteStatus } from '../store/usePricingStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingCase {
  dossierId: string;
  userId: string;
  stepId: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  /** Native column — mirrors `mission_type` in `onboarding_cases`. Values: 'reprise' | 'creation'. */
  missionType?: 'reprise' | 'creation';
  clientData: Record<string, unknown>;
  stepStatuses: string[];
  updatedAt?: string;
}

export interface OnboardingEvent {
  dossierId: string;
  userId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export type SyncResult =
  | { success: true }
  | { success: false; error: string };

// ─── onboarding_cases ─────────────────────────────────────────────────────────

/**
 * Sauvegarde ou met à jour un brouillon de dossier dans `onboarding_cases`.
 * Utilisé pour la persistance temps réel pendant le parcours d'onboarding.
 */
export async function saveDraftCase(caseData: OnboardingCase): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('onboarding_cases')
      .upsert(
        {
          dossier_id: caseData.dossierId,
          user_id: caseData.userId,
          step_id: caseData.stepId,
          status: caseData.status,
          // Native indexed column — derive from top-level missionType or clientData fallback
          mission_type: caseData.missionType || (caseData.clientData.missionType as string) || null,
          client_data: caseData.clientData,
          step_statuses: caseData.stepStatuses,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'dossier_id' }
      );

    if (error) {
      console.warn('[supabaseSync] saveDraftCase error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] saveDraftCase exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Récupère un brouillon de dossier depuis `onboarding_cases`.
 */
export async function getDraftCase(
  dossierId: string
): Promise<{ success: true; data: OnboardingCase } | { success: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('onboarding_cases')
      .select('*')
      .eq('dossier_id', dossierId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Dossier introuvable' };
    }

    return {
      success: true,
      data: {
        dossierId: data.dossier_id as string,
        userId: data.user_id as string,
        stepId: data.step_id as string,
        status: data.status as OnboardingCase['status'],
        missionType: (data.mission_type as OnboardingCase['missionType']) ?? undefined,
        clientData: (data.client_data as Record<string, unknown>) ?? {},
        stepStatuses: (data.step_statuses as string[]) ?? [],
        updatedAt: data.updated_at as string,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

/**
 * Marque un dossier comme complété ou archivé dans `onboarding_cases`.
 */
export async function updateCaseStatus(
  dossierId: string,
  status: OnboardingCase['status']
): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('onboarding_cases')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('dossier_id', dossierId);

    if (error) {
      console.warn('[supabaseSync] updateCaseStatus error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

// ─── onboarding_events ────────────────────────────────────────────────────────

/**
 * Enregistre un événement dans le journal d'audit `onboarding_events`.
 *
 * Exemples d'eventType :
 *   - 'step_completed'     — Étape validée
 *   - 'document_uploaded'  — Document téléversé
 *   - 'signature_sent'     — LDM envoyée en signature
 *   - 'kyc_scored'         — Score de risque LCB-FT calculé
 *   - 'sepa_signed'        — Mandat SEPA signé
 *   - 'dossier_closed'     — Dossier clôturé
 */
export async function logOnboardingEvent(event: OnboardingEvent): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('onboarding_events')
      .insert({
        dossier_id: event.dossierId,
        user_id: event.userId,
        event_type: event.eventType,
        payload: event.payload ?? null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[supabaseSync] logOnboardingEvent error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] logOnboardingEvent exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Récupère l'historique d'audit d'un dossier depuis `onboarding_events`.
 */
export async function getOnboardingEvents(
  dossierId: string
): Promise<{ success: true; events: OnboardingEvent[] } | { success: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('onboarding_events')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const events: OnboardingEvent[] = (data ?? []).map(row => ({
      dossierId: row.dossier_id as string,
      userId: row.user_id as string,
      eventType: row.event_type as string,
      payload: (row.payload as Record<string, unknown>) ?? undefined,
    }));

    return { success: true, events };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

// ─── clients & quotes ─────────────────────────────────────────────────────────

/**
 * Schéma SQL suggéré :
 *
 *   CREATE TABLE clients (
 *     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_name     TEXT NOT NULL,
 *     client_email    TEXT,
 *     siret           TEXT,
 *     legal_form      TEXT,
 *     tax_regime      TEXT,
 *     secteur_activite TEXT,
 *     created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   CREATE TABLE quotes (
 *     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
 *     status          TEXT NOT NULL DEFAULT 'PENDING_ONBOARDING',
 *     monthly_total   NUMERIC,
 *     setup_fees      NUMERIC,
 *     quote_data      JSONB,
 *     created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */

export interface ClientRecord {
  clientName: string;
  clientEmail?: string;
  siret?: string;
  /** Numéro SIREN */
  siren?: string;
  /** Raison sociale */
  raisonSociale?: string;
  /** Nom du contact */
  nomContact?: string;
  /** Prénom du contact */
  prenomContact?: string;
  /** Adresse du siège */
  adresse?: string;
  /** Code postal */
  codePostal?: string;
  /** Ville */
  ville?: string;
  legalForm?: string;
  taxRegime?: string;
  /** Secteur d'activité (code NAF + libellé) */
  secteurActivite?: string;
}

export interface QuoteRecord {
  status: QuoteStatus;
  monthlyTotal: number;
  setupFees: number;
  quoteData: Record<string, unknown>;
}

export type SaveClientQuoteResult =
  | { success: true; clientId: string; quoteId: string }
  | { success: false; error: string };

/**
 * Insère ou met à jour un client et son devis associé dans Supabase.
 * Utilisé lors de la validation d'une proposition dans le moteur de pricing.
 *
 * Stratégie de déduplication des clients :
 *  - Email fourni    → upsert par `client_email` (contrainte UNIQUE).
 *  - Pas d'email     → recherche d'abord par SIREN, puis par nom (ilike).
 *                      Si trouvé : UPDATE. Sinon : INSERT.
 *                      Évite la création de doublons clients à chaque génération.
 */
export async function saveClientAndQuote(
  client: ClientRecord,
  quote: QuoteRecord
): Promise<SaveClientQuoteResult> {
  try {
    let clientId: string;

    // ── Payload commun (sans client_email) ──────────────────────────────────
    const basePayload = {
      client_name: client.clientName,
      // siret n'est fourni que s'il est explicitement connu — on ne génère
      // plus de SIRET fictif à partir du SIREN pour éviter des données corrompues.
      siret: client.siret ?? null,
      siren: client.siren ?? null,
      raison_sociale: client.raisonSociale ?? null,
      nom_contact: client.nomContact ?? null,
      prenom_contact: client.prenomContact ?? null,
      adresse: client.adresse ?? null,
      code_postal: client.codePostal ?? null,
      ville: client.ville ?? null,
      legal_form: client.legalForm ?? null,
      tax_regime: client.taxRegime ?? null,
      secteur_activite: client.secteurActivite ?? null,
    };

    if (client.clientEmail) {
      // ── Email fourni : upsert par contrainte UNIQUE client_email ──────────
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .upsert(
          { ...basePayload, client_email: client.clientEmail },
          { onConflict: 'client_email', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (clientError || !clientData) {
        const msg = clientError?.message ?? 'Impossible de créer le client';
        console.warn('[supabaseSync] saveClientAndQuote — client upsert error:', msg);
        return { success: false, error: msg };
      }
      clientId = clientData.id as string;
    } else {
      // ── Pas d'email : déduplication par SIREN puis par nom ───────────────
      // PostgreSQL traite chaque NULL comme distinct pour les contraintes UNIQUE,
      // donc on ne peut pas utiliser onConflict:'client_email' avec NULL.
      // On cherche manuellement un client existant pour l'UPDATE plutôt qu'INSERT.
      let existingClientId: string | null = null;

      if (client.siren && client.siren.trim()) {
        const { data: bySiren } = await supabase
          .from('clients')
          .select('id')
          .eq('siren', client.siren.trim())
          .maybeSingle();
        if (bySiren) existingClientId = bySiren.id as string;
      }

      if (!existingClientId && client.clientName?.trim()) {
        const { data: byName } = await supabase
          .from('clients')
          .select('id')
          .ilike('client_name', client.clientName.trim())
          .maybeSingle();
        if (byName) existingClientId = byName.id as string;
      }

      if (existingClientId) {
        // Client connu — mise à jour des données sans changer l'email
        const { error: updateError } = await supabase
          .from('clients')
          .update({ ...basePayload, client_email: null })
          .eq('id', existingClientId);

        if (updateError) {
          console.warn('[supabaseSync] saveClientAndQuote — client update error:', updateError.message);
          return { success: false, error: updateError.message };
        }
        clientId = existingClientId;
      } else {
        // Nouveau client sans email — insertion
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .insert({ ...basePayload, client_email: null })
          .select('id')
          .single();

        if (clientError || !clientData) {
          const msg = clientError?.message ?? 'Impossible de créer le client';
          console.warn('[supabaseSync] saveClientAndQuote — client insert error:', msg);
          return { success: false, error: msg };
        }
        clientId = clientData.id as string;
      }
    }

    // ── Insertion du devis lié au client ─────────────────────────────────────
    // Chaque génération crée un nouveau devis (comparaison multiple possible).
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        client_id: clientId,
        status: quote.status,
        monthly_total: quote.monthlyTotal,
        setup_fees: quote.setupFees,
        quote_data: quote.quoteData,
      })
      .select('id')
      .single();

    if (quoteError || !quoteData) {
      const msg = quoteError?.message ?? 'Impossible de créer le devis';
      console.warn('[supabaseSync] saveClientAndQuote — quote insert error:', msg);
      return { success: false, error: msg };
    }

    return { success: true, clientId, quoteId: quoteData.id as string };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] saveClientAndQuote exception:', message);
    return { success: false, error: message };
  }
}

// ─── saveProspectAndQuote ─────────────────────────────────────────────────────

/**
 * Paramètres pour la création d'un devis lié à un prospect.
 *
 * Utilisé par le bouton "Valider et générer la proposition" du moteur de
 * tarification. Contrairement à `saveClientAndQuote`, cette fonction n'insère
 * rien dans la table `clients` — le client ne sera créé qu'au moment de la
 * conversion via "Valider pour Lettre de Mission".
 */
export interface SaveProspectQuoteParams {
  /** Raison sociale / nom de l'entreprise */
  companyName: string;
  /** SIREN (9 chiffres, optionnel) */
  siren?: string | null;
  /** SIRET (14 chiffres, optionnel) */
  siret?: string | null;
  /** Adresse du siège (colonne `address` dans prospects) */
  address?: string | null;
  /** Ville (colonne `city` dans prospects) */
  city?: string | null;
  /** Code postal (colonne `postal_code` dans prospects) */
  postalCode?: string | null;
  /** Nom complet du contact (colonne `contact_name` dans prospects) */
  contactName?: string | null;
  /** Email du contact */
  contactEmail?: string | null;
  /** Secteur d'activité */
  secteurActivite?: string | null;
  /** Forme juridique */
  legalForm?: string | null;
}

export type SaveProspectQuoteResult =
  | { success: true; prospectId: string; quoteId: string }
  | { success: false; error: string };

/**
 * Insère ou met à jour le prospect ET crée le devis associé.
 *
 * Stratégie :
 *  - Recherche un prospect existant par SIREN puis par nom.
 *  - Upsert le prospect dans la table `prospects` (colonnes English : address,
 *    city, postal_code, contact_name).
 *  - Insère le devis en liant `prospect_id` (pas de `client_id` tant que le
 *    prospect n'est pas converti en client).
 *
 * Cette fonction est appelée par le bouton "Valider et générer la proposition".
 * Elle NE touche PAS à la table `clients`.
 */
export async function saveProspectAndQuote(
  prospect: SaveProspectQuoteParams,
  quote: QuoteRecord
): Promise<SaveProspectQuoteResult> {
  try {
    // ── 1. Upsert the prospect ──────────────────────────────────────────────
    let prospectId: string;

    const prospectPayload = {
      company_name: prospect.companyName,
      siren: prospect.siren ?? null,
      siret: prospect.siret ?? null,
      address: prospect.address ?? null,
      city: prospect.city ?? null,
      postal_code: prospect.postalCode ?? null,
      contact_name: prospect.contactName ?? null,
      contact_email: prospect.contactEmail ?? null,
      secteur_activite: prospect.secteurActivite ?? null,
      legal_form: prospect.legalForm ?? null,
      status: 'en-negociation',
      kanban_column: 'en-negociation',
      updated_at: new Date().toISOString(),
    };

    // Try to find an existing prospect first
    let existingId: string | null = null;

    if (prospect.siren && prospect.siren.trim()) {
      const { data: bySiren } = await supabase
        .from('prospects')
        .select('id')
        .eq('siren', prospect.siren.trim())
        .maybeSingle();
      if (bySiren) existingId = (bySiren as { id: string }).id;
    }

    if (!existingId && prospect.companyName.trim()) {
      const { data: byName } = await supabase
        .from('prospects')
        .select('id')
        .ilike('company_name', prospect.companyName.trim())
        .maybeSingle();
      if (byName) existingId = (byName as { id: string }).id;
    }

    if (existingId) {
      // Update existing prospect
      const { error: updateError } = await supabase
        .from('prospects')
        .update({ ...prospectPayload, pricing_data: quote.quoteData })
        .eq('id', existingId);

      if (updateError) {
        console.warn('[supabaseSync] saveProspectAndQuote — prospect update error:', updateError.message);
        return { success: false, error: updateError.message };
      }
      prospectId = existingId;
    } else {
      // Insert new prospect
      const { data: newProspect, error: insertError } = await supabase
        .from('prospects')
        .insert({ ...prospectPayload, pricing_data: quote.quoteData })
        .select('id')
        .single();

      if (insertError || !newProspect) {
        const msg = insertError?.message ?? 'Impossible de créer le prospect';
        console.warn('[supabaseSync] saveProspectAndQuote — prospect insert error:', msg);
        return { success: false, error: msg };
      }
      prospectId = (newProspect as { id: string }).id;
    }

    // ── 2. Compute the next version number for this prospect ────────────────
    const { count: existingCount } = await supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('prospect_id', prospectId);
    const nextVersion = (existingCount ?? 0) + 1;

    // ── 3. Insert the quote linked to the prospect (no client_id yet) ───────
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        prospect_id: prospectId,
        status: quote.status,
        monthly_total: quote.monthlyTotal,
        setup_fees: quote.setupFees,
        quote_data: quote.quoteData,
        version: nextVersion,
      })
      .select('id')
      .single();

    if (quoteError || !quoteData) {
      const msg = quoteError?.message ?? 'Impossible de créer le devis';
      console.warn('[supabaseSync] saveProspectAndQuote — quote insert error:', msg);
      return { success: false, error: msg };
    }

    return { success: true, prospectId, quoteId: (quoteData as { id: string }).id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] saveProspectAndQuote exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Récupère tous les clients dont un devis est au statut "SIGNED".
 * Utilisé pour alimenter le module d'Onboarding interconnecté.
 */
export interface SignedClient {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  siret: string | null;
  legalForm: string | null;
  taxRegime: string | null;
  /** Secteur d'activité (code NAF + libellé) */
  activity: string | null;
  quoteId: string;
  monthlyTotal: number;
  setupFees: number;
  quoteData: Record<string, unknown>;
}

/** Safely cast a Supabase join record to a plain key-value map. */
function asClientRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export async function getSignedClients(): Promise<
  { success: true; clients: SignedClient[] } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, monthly_total, setup_fees, quote_data, clients(id, client_name, client_email, siret, legal_form, tax_regime, secteur_activite)')
      .eq('status', 'SIGNED');

    if (error) {
      return { success: false, error: error.message };
    }

    const clients: SignedClient[] = (data ?? [])
      .filter(row => row.clients !== null)
      .map(row => {
        const c = asClientRecord(row.clients);
        return {
          clientId: c.id as string,
          clientName: (c.client_name as string) ?? '',
          clientEmail: (c.client_email as string | null) ?? null,
          siret: (c.siret as string | null) ?? null,
          legalForm: (c.legal_form as string | null) ?? null,
          taxRegime: (c.tax_regime as string | null) ?? null,
          activity: (c.secteur_activite as string | null) ?? null,
          quoteId: row.id as string,
          monthlyTotal: (row.monthly_total as number) ?? 0,
          setupFees: (row.setup_fees as number) ?? 0,
          quoteData: (row.quote_data as Record<string, unknown>) ?? {},
        };
      });

    return { success: true, clients };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

/**
 * Met à jour le statut d'un devis dans la table `quotes`.
 * Utilisé pour passer un devis de DRAFT → VALIDATED (ou autre transition).
 *
 * Utilise `.select('id').single()` après l'UPDATE pour détecter le cas où
 * aucune ligne ne correspond à `quoteId` (échec silencieux corrigé).
 */
export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteRecord['status']
): Promise<SyncResult> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId)
      .select('id')
      .single();

    if (error) {
      // Inclut le cas PGRST116 (aucune ligne ne correspond à l'id fourni)
      console.warn('[supabaseSync] updateQuoteStatus error:', error.message);
      return { success: false, error: error.message };
    }
    if (!data) {
      const msg = `Devis introuvable (id: ${quoteId})`;
      console.warn('[supabaseSync] updateQuoteStatus:', msg);
      return { success: false, error: msg };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] updateQuoteStatus exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Récupère tous les devis ayant le statut "VALIDATED" avec les données client.
 * Utilisé pour alimenter le sélecteur de propositions dans le Moteur LDM.
 */
export interface ValidatedQuote {
  quoteId: string;
  clientName: string;
  clientEmail: string | null;
  siret: string | null;
  legalForm: string | null;
  taxRegime: string | null;
  /** Secteur d'activité (code NAF + libellé) */
  activity: string | null;
  monthlyTotal: number;
  setupFees: number;
  quoteData: Record<string, unknown>;
  /** Statut du devis — présent uniquement quand explicitement sélectionné depuis Supabase */
  status?: QuoteStatus;
}

export async function getValidatedQuotes(): Promise<
  { success: true; quotes: ValidatedQuote[] } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, monthly_total, setup_fees, quote_data, clients(id, client_name, client_email, siret, legal_form, tax_regime, secteur_activite)')
      .eq('status', 'VALIDATED')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const quotes: ValidatedQuote[] = (data ?? [])
      .filter(row => row.clients !== null)
      .map(row => {
        const c = asClientRecord(row.clients);
        return {
          quoteId: row.id as string,
          clientName: (c.client_name as string) ?? '',
          clientEmail: (c.client_email as string | null) ?? null,
          siret: (c.siret as string | null) ?? null,
          legalForm: (c.legal_form as string | null) ?? null,
          taxRegime: (c.tax_regime as string | null) ?? null,
          activity: (c.secteur_activite as string | null) ?? null,
          monthlyTotal: (row.monthly_total as number) ?? 0,
          setupFees: (row.setup_fees as number) ?? 0,
          quoteData: (row.quote_data as Record<string, unknown>) ?? {},
        };
      });

    return { success: true, quotes };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

/**
 * Récupère les devis aux statuts "VALIDATED" et "SENT" pour la page Lettre de Mission.
 * Inclut le champ `status` pour permettre le suivi visuel de la signature électronique.
 */
export async function getQuotesForLDM(): Promise<
  { success: true; quotes: ValidatedQuote[] } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, status, monthly_total, setup_fees, quote_data, clients(id, client_name, client_email, siret, legal_form, tax_regime, secteur_activite)')
      .in('status', ['VALIDATED', 'SENT'])
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const quotes: ValidatedQuote[] = (data ?? [])
      .filter(row => row.clients !== null)
      .map(row => {
        const c = asClientRecord(row.clients);
        return {
          quoteId: row.id as string,
          status: (row.status as QuoteStatus) ?? 'VALIDATED',
          clientName: (c.client_name as string) ?? '',
          clientEmail: (c.client_email as string | null) ?? null,
          siret: (c.siret as string | null) ?? null,
          legalForm: (c.legal_form as string | null) ?? null,
          taxRegime: (c.tax_regime as string | null) ?? null,
          activity: (c.secteur_activite as string | null) ?? null,
          monthlyTotal: (row.monthly_total as number) ?? 0,
          setupFees: (row.setup_fees as number) ?? 0,
          quoteData: (row.quote_data as Record<string, unknown>) ?? {},
        };
      });

    return { success: true, quotes };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

/**
 * Récupère tous les devis ayant le statut "SENT" avec les données client.
 * Utilisé pour les métriques d'analyse (ex : valeur totale des devis envoyés).
 */
export async function getSentQuotes(): Promise<
  { success: true; quotes: ValidatedQuote[]; totalMrr: number; totalSetupFees: number } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, monthly_total, setup_fees, quote_data, clients(id, client_name, client_email, siret, legal_form, tax_regime, secteur_activite)')
      .eq('status', 'SENT')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const quotes: ValidatedQuote[] = (data ?? [])
      .filter(row => row.clients !== null)
      .map(row => {
        const c = asClientRecord(row.clients);
        return {
          quoteId: row.id as string,
          clientName: (c.client_name as string) ?? '',
          clientEmail: (c.client_email as string | null) ?? null,
          siret: (c.siret as string | null) ?? null,
          legalForm: (c.legal_form as string | null) ?? null,
          taxRegime: (c.tax_regime as string | null) ?? null,
          activity: (c.secteur_activite as string | null) ?? null,
          monthlyTotal: (row.monthly_total as number) ?? 0,
          setupFees: (row.setup_fees as number) ?? 0,
          quoteData: (row.quote_data as Record<string, unknown>) ?? {},
        };
      });

    const totalMrr = quotes.reduce((sum, q) => sum + q.monthlyTotal, 0);
    const totalSetupFees = quotes.reduce((sum, q) => sum + q.setupFees, 0);

    return { success: true, quotes, totalMrr, totalSetupFees };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

/**
 * Supprime définitivement un devis de la table `quotes`.
 */
export async function deleteQuote(quoteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId);

    if (error) {
      console.warn('[supabaseSync] deleteQuote error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] deleteQuote exception:', message);
    return { success: false, error: message };
  }
}

// ─── LDM data ─────────────────────────────────────────────────────────────────

/** Champs de la Lettre de Mission à persister dans `quote_data` pour la liaison
 *  automatique lors de la création d'un dossier d'onboarding. */
export interface LdmFormData {
  missionsSelectionnees?: string[];
  clientSiren?: string;
  clientRaisonSociale?: string;
  clientNom?: string;
  clientPrenom?: string;
  clientGenre?: string;
  clientStatutDirigeant?: string;
  clientAdresse?: string;
  clientCodePostal?: string;
  clientVille?: string;
  clientActivite?: string;
  clientEmail?: string;
  clientFormeJuridique?: string;
  prixAnnuel?: string;
  telephone?: string;
  signatureId?: string;
  signatureProvider?: string;
}

/**
 * Fusionne les données de la Lettre de Mission dans le champ `quote_data` du devis.
 * Appelé après l'envoi en signature depuis le Moteur LDM afin de garantir que
 * toutes les informations seront disponibles lors de la création du dossier d'onboarding.
 */
export async function updateQuoteLdmData(
  quoteId: string,
  ldmData: LdmFormData
): Promise<SyncResult> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('quotes')
      .select('quote_data')
      .eq('id', quoteId)
      .single();

    if (fetchError) {
      console.warn('[supabaseSync] updateQuoteLdmData fetch error:', fetchError.message);
      return { success: false, error: fetchError.message };
    }

    const mergedData = {
      ...((existing?.quote_data as Record<string, unknown>) ?? {}),
      ...ldmData,
    };

    const { error } = await supabase
      .from('quotes')
      .update({ quote_data: mergedData })
      .eq('id', quoteId);

    if (error) {
      console.warn('[supabaseSync] updateQuoteLdmData update error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] updateQuoteLdmData exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Met à jour le statut d'un devis à SIGNED et sauvegarde l'URL SharePoint
 * de la Lettre de Mission signée dans le champ `quote_data.lettreMissionSharepointUrl`.
 */
export async function updateQuoteSharepointUrl(
  quoteId: string,
  sharepointUrl: string
): Promise<SyncResult> {
  try {
    // First fetch current quote_data to merge
    const { data: existing, error: fetchError } = await supabase
      .from('quotes')
      .select('quote_data')
      .eq('id', quoteId)
      .single();

    if (fetchError) {
      console.warn('[supabaseSync] updateQuoteSharepointUrl fetch error:', fetchError.message);
      return { success: false, error: fetchError.message };
    }

    const mergedData = {
      ...((existing?.quote_data as Record<string, unknown>) ?? {}),
      lettreMissionSharepointUrl: sharepointUrl,
    };

    const { error } = await supabase
      .from('quotes')
      .update({ status: 'SIGNED', quote_data: mergedData })
      .eq('id', quoteId);

    if (error) {
      console.warn('[supabaseSync] updateQuoteSharepointUrl update error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] updateQuoteSharepointUrl exception:', message);
    return { success: false, error: message };
  }
}

// ─── Prospect ↔ Pricing integration ──────────────────────────────────────────

/**
 * Sauvegarde les données de tarification dans la colonne `pricing_data` d'un
 * prospect existant (ou crée un nouveau prospect si aucun n'est trouvé).
 *
 * Stratégie de recherche :
 *  1. Par SIREN (si fourni et non vide)
 *  2. Par nom d'entreprise exact (fallback)
 *
 * La colonne `pricing_data` stocke l'objet JSON complet de la proposition
 * (prix mensuels, services choisis, frais d'intégration, etc.).
 */
export interface SaveProposalToProspectParams {
  /** SIREN du prospect (9 chiffres) */
  siren?: string;
  /** Raison sociale / nom de l'entreprise */
  companyName: string;
  /** Email du contact principal */
  contactEmail?: string;
  /** Données de tarification à persister */
  pricingData: Record<string, unknown>;
}

export async function saveProposalToProspect(
  params: SaveProposalToProspectParams
): Promise<SyncResult> {
  const { siren, companyName, contactEmail, pricingData } = params;

  try {
    // 1. Try to find an existing prospect
    let existingId: string | null = null;

    if (siren && siren.trim()) {
      const { data: bySiren } = await supabase
        .from('prospects')
        .select('id')
        .eq('siren', siren.trim())
        .maybeSingle();
      if (bySiren) existingId = bySiren.id as string;
    }

    if (!existingId && companyName.trim()) {
      const { data: byName } = await supabase
        .from('prospects')
        .select('id')
        .ilike('company_name', companyName.trim())
        .maybeSingle();
      if (byName) existingId = byName.id as string;
    }

    if (existingId) {
      // 2a. Update the existing prospect's pricing_data
      const { error } = await supabase
        .from('prospects')
        .update({
          pricing_data: pricingData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);

      if (error) {
        console.warn('[supabaseSync] saveProposalToProspect — update error:', error.message);
        return { success: false, error: error.message };
      }
    } else {
      // 2b. Create a new prospect record
      const { error } = await supabase
        .from('prospects')
        .insert({
          company_name: companyName.trim(),
          siren: siren?.trim() || null,
          contact_email: contactEmail || null,
          pricing_data: pricingData,
          status: 'en-negociation',
          kanban_column: 'en-negociation',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('[supabaseSync] saveProposalToProspect — insert error:', error.message);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] saveProposalToProspect exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Récupère les données de tarification (`pricing_data`) associées à un
 * prospect, identifié par son SIREN ou sa raison sociale.
 *
 * Retourne null si aucun prospect correspondant n'est trouvé.
 */
export async function getProspectPricingData(
  siren?: string | null,
  companyName?: string | null
): Promise<{ success: true; prospectId: string; pricingData: Record<string, unknown> | null } | { success: false; error: string }> {
  try {
    let row: { id: string; pricing_data: unknown } | null = null;

    if (siren && siren.trim()) {
      const { data } = await supabase
        .from('prospects')
        .select('id, pricing_data')
        .eq('siren', siren.trim())
        .maybeSingle();
      if (data) row = data as { id: string; pricing_data: unknown };
    }

    if (!row && companyName && companyName.trim()) {
      const { data } = await supabase
        .from('prospects')
        .select('id, pricing_data')
        .ilike('company_name', companyName.trim())
        .maybeSingle();
      if (data) row = data as { id: string; pricing_data: unknown };
    }

    if (!row) {
      return { success: false, error: 'Prospect introuvable' };
    }

    return {
      success: true,
      prospectId: row.id,
      pricingData: (row.pricing_data as Record<string, unknown> | null) ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] getProspectPricingData exception:', message);
    return { success: false, error: message };
  }
}

// ─── Prospect → Client conversion ─────────────────────────────────────────────

export type ConvertProspectResult =
  | { success: true; clientId: string; alreadyExisted: boolean }
  | { success: false; error: string };

/**
 * Convertit un prospect en client dans Supabase.
 *
 * Étapes :
 *  1. Retrouve le prospect par SIREN ou par nom d'entreprise.
 *  2. Upsert (ou insert) un enregistrement dans la table `clients` en copiant
 *     les informations de base du prospect (nom, email, adresse, forme juridique…).
 *  3. Met à jour le statut du prospect à 'client_converti'.
 *
 * @param siren        SIREN du prospect (9 chiffres, optionnel).
 * @param companyName  Raison sociale utilisée comme fallback de recherche.
 * @param contactEmail Email du contact (optionnel).
 * @param pricingData  Données de tarification à persister éventuellement (optionnel).
 */
export async function convertProspectToClient(params: {
  siren?: string | null;
  companyName: string;
  contactEmail?: string | null;
  pricingData?: Record<string, unknown>;
}): Promise<ConvertProspectResult> {
  const { siren, companyName, contactEmail, pricingData } = params;

  try {
    // 1. Find the prospect
    let prospect: Record<string, unknown> | null = null;

    if (siren && siren.trim()) {
      const { data } = await supabase
        .from('prospects')
        .select('*')
        .eq('siren', siren.trim())
        .maybeSingle();
      if (data) prospect = data as Record<string, unknown>;
    }

    if (!prospect && companyName.trim()) {
      const { data } = await supabase
        .from('prospects')
        .select('*')
        .ilike('company_name', companyName.trim())
        .maybeSingle();
      if (data) prospect = data as Record<string, unknown>;
    }

    // 2. Insert or upsert into `clients`
    // The `clients` table uses French column names (adresse, code_postal, ville).
    // The `prospects` table uses English column names (address, postal_code, city, contact_name).
    const clientName = (prospect?.company_name as string | undefined) ?? companyName;
    const email = (prospect?.contact_email as string | undefined) ?? contactEmail ?? null;
    const sirenVal = (prospect?.siren as string | undefined) ?? siren ?? null;
    const siretVal = (prospect?.siret as string | undefined) ?? null;

    const clientPayload = {
      client_name: clientName,
      siren: sirenVal,
      siret: siretVal,
      // Map prospects English columns → clients French columns
      adresse: (prospect?.address as string | undefined) ?? null,
      code_postal: (prospect?.postal_code as string | undefined) ?? null,
      ville: (prospect?.city as string | undefined) ?? null,
      legal_form: (prospect?.legal_form as string | undefined) ?? null,
      forme_juridique: (prospect?.forme_juridique as string | undefined) ?? null,
      secteur_activite: (prospect?.secteur_activite as string | undefined) ?? null,
    };

    let clientId: string;
    let alreadyExisted = false;

    if (email) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .upsert(
          { ...clientPayload, client_email: email, email },
          { onConflict: 'client_email', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (clientError || !clientData) {
        const msg = clientError?.message ?? 'Impossible de créer le client';
        console.warn('[supabaseSync] convertProspectToClient — client upsert error:', msg);
        return { success: false, error: msg };
      }
      clientId = clientData.id as string;
    } else {
      // Check if a client with the same company name already exists
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .ilike('client_name', clientName)
        .maybeSingle();

      if (existing) {
        clientId = existing.id as string;
        alreadyExisted = true;
      } else {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .insert({ ...clientPayload, client_email: null, email: null })
          .select('id')
          .single();

        if (clientError || !clientData) {
          const msg = clientError?.message ?? 'Impossible de créer le client';
          console.warn('[supabaseSync] convertProspectToClient — client insert error:', msg);
          return { success: false, error: msg };
        }
        clientId = clientData.id as string;
      }
    }

    // 3. Update prospect status to 'client_converti' (if prospect was found)
    if (prospect?.id) {
      const updatePayload: Record<string, unknown> = {
        status: 'client_converti',
        kanban_column: 'gagne',
        updated_at: new Date().toISOString(),
      };
      if (pricingData) updatePayload.pricing_data = pricingData;

      const { error: prospectUpdateError } = await supabase
        .from('prospects')
        .update(updatePayload)
        .eq('id', prospect.id as string);

      if (prospectUpdateError) {
        console.warn('[supabaseSync] convertProspectToClient — prospect status update error:', prospectUpdateError.message);
        // Client was successfully created — return success but log the CRM update failure.
      }
    }

    return { success: true, clientId, alreadyExisted };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] convertProspectToClient exception:', message);
    return { success: false, error: message };
  }
}

// ─── Sent Emails Log ──────────────────────────────────────────────────────────

export interface SentEmailRecord {
  id: string;
  userId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  htmlContent: string;
  emailType: string | null;
  demo: boolean;
  messageId: string | null;
  sentAt: string;
}

/**
 * Persists a record of a sent email to the `sent_emails` table.
 * Called automatically by sendEmail() in emailService.ts.
 * Never throws — returns a SyncResult.
 */
export async function logSentEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlContent: string;
  emailType?: string;
  demo?: boolean;
  messageId?: string;
}): Promise<SyncResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('sent_emails').insert({
      user_id: user?.id ?? null,
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName ?? null,
      subject: params.subject,
      html_content: params.htmlContent,
      email_type: params.emailType ?? null,
      demo: params.demo ?? false,
      message_id: params.messageId ?? null,
    });
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    console.warn('[supabaseSync] logSentEmail:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
  }
}

/**
 * Fetches the 100 most recent sent emails for the current user.
 */
export async function getSentEmails(): Promise<{
  success: boolean;
  emails: SentEmailRecord[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('sent_emails')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const emails: SentEmailRecord[] = (data ?? []).map(row => ({
      id: row.id as string,
      userId: row.user_id as string | null,
      recipientEmail: row.recipient_email as string,
      recipientName: row.recipient_name as string | null,
      subject: row.subject as string,
      htmlContent: row.html_content as string,
      emailType: row.email_type as string | null,
      demo: row.demo as boolean,
      messageId: row.message_id as string | null,
      sentAt: row.sent_at as string,
    }));
    return { success: true, emails };
  } catch (err: unknown) {
    console.warn('[supabaseSync] getSentEmails:', err instanceof Error ? err.message : err);
    return { success: false, emails: [], error: err instanceof Error ? err.message : 'Erreur inconnue' };
  }
}

/**
 * Deletes one or more sent email records for the current user by their IDs.
 * Returns a SyncResult (never throws).
 */
export async function deleteEmailRecords(ids: string[]): Promise<SyncResult> {
  if (ids.length === 0) return { success: true };
  try {
    const { error } = await supabase
      .from('sent_emails')
      .delete()
      .in('id', ids);
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    console.warn('[supabaseSync] deleteEmailRecords:', err instanceof Error ? err.message : err);
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
  }
}

// ─── ProspectQuote (quotes listed in the prospect detail view) ────────────────

export interface ProspectQuote {
  id: string;
  version: number;
  status: string;
  monthlyTotal: number;
  setupFees: number;
  createdAt: string;
  acceptToken: string | null;
  quoteData: Record<string, unknown>;
}

/**
 * Récupère tous les devis associés à un prospect, triés du plus récent au plus
 * ancien.
 *
 * Utilisé par la vue détaillée d'un prospect (Sheet) dans Prospection.tsx pour
 * afficher le tableau des devis avec versioning.
 */
export async function getQuotesByProspect(
  prospectId: string
): Promise<{ success: true; quotes: ProspectQuote[] } | { success: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, version, status, monthly_total, setup_fees, created_at, accept_token, quote_data')
      .eq('prospect_id', prospectId)
      .order('version', { ascending: false });

    if (error) {
      console.warn('[supabaseSync] getQuotesByProspect error:', error.message);
      return { success: false, error: error.message };
    }

    const quotes: ProspectQuote[] = (data ?? []).map(row => ({
      id: row.id as string,
      version: (row.version as number) ?? 1,
      status: row.status as string,
      monthlyTotal: (row.monthly_total as number) ?? 0,
      setupFees: (row.setup_fees as number) ?? 0,
      createdAt: row.created_at as string,
      acceptToken: (row.accept_token as string | null) ?? null,
      quoteData: (row.quote_data as Record<string, unknown>) ?? {},
    }));

    return { success: true, quotes };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] getQuotesByProspect exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Génère un token UUID d'acceptation pour un devis et le persiste en base.
 * Passe simultanément le statut du devis à 'SENT'.
 *
 * Retourne le token généré pour construction du lien magique d'acceptation.
 */
export async function generateQuoteAcceptToken(
  quoteId: string
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  try {
    // Generate a v4-style UUID token client-side via crypto
    const token = crypto.randomUUID();

    const { error } = await supabase
      .from('quotes')
      .update({ accept_token: token, status: 'SENT' })
      .eq('id', quoteId);

    if (error) {
      console.warn('[supabaseSync] generateQuoteAcceptToken error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, token };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.warn('[supabaseSync] generateQuoteAcceptToken exception:', message);
    return { success: false, error: message };
  }
}
