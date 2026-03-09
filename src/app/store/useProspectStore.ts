/**
 * useProspectStore.ts
 *
 * Zustand store for the Prospection CRM module.
 * Manages prospects in the Supabase `prospects` table.
 *
 * Key actions:
 *   - fetchProspects          — load all prospects from Supabase
 *   - addProspect             — insert a new prospect
 *   - batchImportProspects    — bulk insert from Excel/CSV import
 *   - updateProspectStatus    — change status / kanban_column
 *   - updateProspectFields    — partial update of any prospect fields
 *   - deleteProspect          — remove a prospect
 *   - enrichProspectData      — merge enriched data (dirigeants, adresse, …)
 *   - convertProspectToClient — convert an accepted prospect into a client record
 *   - setSelectedSecteur      — filter helper for the Kanban/table views
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '../utils/supabaseClient';
import { router } from '../routes';

/** Returns true when a Supabase/PostgREST error indicates the user session has expired or is invalid. */
function isAuthError(error: { code?: string; message?: string; status?: number }): boolean {
  return (
    error.code === 'PGRST301' ||
    error.code === 'PGRST302' ||
    error.status === 401 ||
    (error.message?.toLowerCase().includes('jwt') ?? false) ||
    (error.message?.toLowerCase().includes('expired') ?? false)
  );
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export type ProspectStatus =
  | 'a-contacter'
  | 'email-envoye'
  | 'en-negociation'
  | 'gagne'
  | 'perdu'
  | 'client_converti';

export interface ProspectRow {
  id: string;
  company_name: string;
  siren: string | null;
  siret: string | null;
  naf_code: string | null;
  secteur_activite: string | null;
  /** Single combined contact name (replaces legacy contact_nom / contact_prenom) */
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  /** Street address (English column name in live DB) */
  address: string | null;
  /** Postal / ZIP code (English column name in live DB) */
  postal_code: string | null;
  /** City (English column name in live DB) */
  city: string | null;
  legal_form: string | null;
  forme_juridique: string | null;
  libelle_forme_juridique: string | null;
  libelle_naf: string | null;
  effectif: string | null;
  departement: string | null;
  date_creation: string | null;
  capital_social: string | null;
  categorie_entreprise: string | null;
  dirigeant_principal: Record<string, unknown> | null;
  telephone: string | null;
  status: string;
  kanban_column: string;
  /** JSON blob from the Pricing Engine */
  pricing_data: Record<string, unknown> | null;
  call_logs: string[];
  dirigeants: unknown[];
  open_count: number;
  clicked: boolean;
  email_sent_at: string | null;
  icebreaker_ia: string | null;
  sequence_step: number;
  next_follow_up_date: string | null;
  source: string | null;
  notes: string | null;
  user_id: string | null;
  /** Score de chaleur du lead (0-100) */
  score: number | null;
  /** Valeur financière estimée du contrat (€) */
  estimated_value: number | null;
  /** Date de la prochaine action commerciale (ISO date string) */
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Minimal input for creating a new prospect */
export interface ProspectInput {
  company_name: string;
  siren?: string | null;
  siret?: string | null;
  naf_code?: string | null;
  secteur_activite?: string | null;
  /** Single combined contact name */
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  telephone?: string | null;
  /** Street address (English column name in live DB) */
  address?: string | null;
  /** Postal / ZIP code (English column name in live DB) */
  postal_code?: string | null;
  /** City (English column name in live DB) */
  city?: string | null;
  legal_form?: string | null;
  forme_juridique?: string | null;
  libelle_forme_juridique?: string | null;
  libelle_naf?: string | null;
  effectif?: string | null;
  departement?: string | null;
  date_creation?: string | null;
  capital_social?: string | null;
  categorie_entreprise?: string | null;
  dirigeant_principal?: Record<string, unknown> | null;
  status?: string;
  kanban_column?: string;
  pricing_data?: Record<string, unknown> | null;
  dirigeants?: unknown[];
  source?: string | null;
  notes?: string | null;
  user_id?: string | null;
  call_logs?: string[];
  open_count?: number | null;
  clicked?: boolean | null;
  email_sent_at?: string | null;
  icebreaker_ia?: string | null;
  sequence_step?: number | null;
  next_follow_up_date?: string | null;
  /** Score de chaleur du lead (0-100) */
  score?: number | null;
  /** Valeur financière estimée du contrat (€) */
  estimated_value?: number | null;
  /** Date de la prochaine action commerciale (ISO date string) */
  next_action_date?: string | null;
}

export type ProspectSyncResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type BatchImportResult =
  | { success: true; added: number; skipped: number }
  | { success: false; error: string };

export type ConvertResult =
  | { success: true; clientId: string }
  | { success: false; error: string };

// ─── Store shape ──────────────────────────────────────────────────────────────

interface ProspectStore {
  prospects: ProspectRow[];
  loading: boolean;
  error: string | null;
  selectedSecteur: string | null;

  fetchProspects: () => Promise<void>;

  addProspect: (input: ProspectInput) => Promise<ProspectSyncResult>;

  batchImportProspects: (
    inputs: ProspectInput[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<BatchImportResult>;

  updateProspectStatus: (
    id: string,
    status: string,
    kanbanColumn?: string
  ) => Promise<ProspectSyncResult>;

  updateProspectFields: (
    id: string,
    fields: Partial<ProspectInput>
  ) => Promise<ProspectSyncResult>;

  deleteProspect: (id: string) => Promise<ProspectSyncResult>;

  enrichProspectData: (
    id: string,
    data: Partial<ProspectInput>
  ) => Promise<ProspectSyncResult>;

  /**
   * Converts an accepted prospect into a new client record.
   *
   * Steps:
   *  1. Fetch the prospect from Supabase.
   *  2. Insert a new row in the `clients` table with the prospect's basic info.
   *  3. Update the prospect's status to 'client_converti'.
   *
   * Returns the new clientId on success.
   */
  convertProspectToClient: (prospectId: string) => Promise<ConvertResult>;

  setSelectedSecteur: (secteur: string | null) => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useProspectStore = create<ProspectStore>((set, get) => ({
  prospects: [],
  loading: false,
  error: null,
  selectedSecteur: null,

  // ── fetchProspects ──────────────────────────────────────────────────────────

  fetchProspects: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isAuthError(error)) {
          toast.error('Votre session a expiré. Veuillez vous reconnecter.');
          set({ loading: false, error: error.message });
          router.navigate('/auth');
          return;
        }
        set({ loading: false, error: error.message });
        return;
      }
      set({ prospects: (data ?? []) as ProspectRow[], loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      set({ loading: false, error: message });
    }
  },

  // ── addProspect ─────────────────────────────────────────────────────────────

  addProspect: async (input: ProspectInput): Promise<ProspectSyncResult> => {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .insert({
          company_name: input.company_name,
          siren: input.siren ?? null,
          siret: input.siret ?? null,
          naf_code: input.naf_code ?? null,
          secteur_activite: input.secteur_activite ?? null,
          contact_name: input.contact_name ?? null,
          contact_email: input.contact_email ?? null,
          contact_phone: input.contact_phone ?? null,
          telephone: input.telephone ?? null,
          address: input.address ?? null,
          postal_code: input.postal_code ?? null,
          city: input.city ?? null,
          legal_form: input.legal_form ?? null,
          forme_juridique: input.forme_juridique ?? null,
          libelle_forme_juridique: input.libelle_forme_juridique ?? null,
          libelle_naf: input.libelle_naf ?? null,
          effectif: input.effectif ?? null,
          departement: input.departement ?? null,
          date_creation: input.date_creation ?? null,
          capital_social: input.capital_social ?? null,
          categorie_entreprise: input.categorie_entreprise ?? null,
          dirigeant_principal: input.dirigeant_principal ?? null,
          status: input.status ?? 'a-contacter',
          kanban_column: input.kanban_column ?? 'a-contacter',
          pricing_data: input.pricing_data ?? null,
          dirigeants: input.dirigeants ?? [],
          source: input.source ?? null,
          notes: input.notes ?? null,
          score: input.score ?? null,
          estimated_value: input.estimated_value ?? null,
          next_action_date: input.next_action_date ?? null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        const msg = error?.message ?? 'Impossible de créer le prospect';
        console.warn('[useProspectStore] addProspect error:', msg);
        return { success: false, error: msg };
      }

      set(s => ({ prospects: [data as ProspectRow, ...s.prospects] }));
      return { success: true, id: (data as ProspectRow).id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.warn('[useProspectStore] addProspect exception:', message);
      return { success: false, error: message };
    }
  },

  // ── batchImportProspects ────────────────────────────────────────────────────

  batchImportProspects: async (
    inputs: ProspectInput[],
    onProgress?: (done: number, total: number) => void
  ): Promise<BatchImportResult> => {
    if (inputs.length === 0) return { success: true, added: 0, skipped: 0 };
    try {
      const rows = inputs.map(input => ({
        company_name: input.company_name,
        siren: input.siren ?? null,
        siret: input.siret ?? null,
        naf_code: input.naf_code ?? null,
        secteur_activite: input.secteur_activite ?? null,
        contact_name: input.contact_name ?? null,
        contact_email: input.contact_email ?? null,
        contact_phone: input.contact_phone ?? null,
        telephone: input.telephone ?? null,
        address: input.address ?? null,
        postal_code: input.postal_code ?? null,
        city: input.city ?? null,
        legal_form: input.legal_form ?? null,
        forme_juridique: input.forme_juridique ?? null,
        libelle_forme_juridique: input.libelle_forme_juridique ?? null,
        libelle_naf: input.libelle_naf ?? null,
        effectif: input.effectif ?? null,
        departement: input.departement ?? null,
        date_creation: input.date_creation ?? null,
        capital_social: input.capital_social ?? null,
        categorie_entreprise: input.categorie_entreprise ?? null,
        dirigeant_principal: input.dirigeant_principal ?? null,
        status: input.status ?? 'a-contacter',
        kanban_column: input.kanban_column ?? 'a-contacter',
        pricing_data: input.pricing_data ?? null,
        dirigeants: input.dirigeants ?? [],
        source: input.source ?? null,
        notes: input.notes ?? null,
        score: input.score ?? null,
        estimated_value: input.estimated_value ?? null,
        next_action_date: input.next_action_date ?? null,
        updated_at: new Date().toISOString(),
      }));

      // Insert in batches of 50, reporting progress.
      // Rows with a non-null SIREN are upserted (dedup by siren).
      // Rows without a SIREN are inserted directly (can't dedup by siren).
      const BATCH_SIZE = 50;
      let added = 0;
      let skipped = 0;
      const allInserted: ProspectRow[] = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const withSiren = batch.filter(r => r.siren != null);
        const withoutSiren = batch.filter(r => r.siren == null);

        // Upsert rows that have a SIREN (dedup by siren UNIQUE constraint)
        if (withSiren.length > 0) {
          const { data, error } = await supabase
            .from('prospects')
            .upsert(withSiren, { onConflict: 'siren', ignoreDuplicates: true })
            .select();

          if (error) {
            console.warn('[useProspectStore] batchImportProspects upsert error:', error.message);
            return { success: false, error: error.message };
          }

          const insertedWithSiren = (data ?? []) as ProspectRow[];
          added += insertedWithSiren.length;
          skipped += withSiren.length - insertedWithSiren.length;
          allInserted.push(...insertedWithSiren);
        }

        // Insert rows that have no SIREN (no dedup possible)
        if (withoutSiren.length > 0) {
          const { data, error } = await supabase
            .from('prospects')
            .insert(withoutSiren)
            .select();

          if (error) {
            console.warn('[useProspectStore] batchImportProspects insert error:', error.message);
            return { success: false, error: error.message };
          }

          const insertedWithoutSiren = (data ?? []) as ProspectRow[];
          added += insertedWithoutSiren.length;
          allInserted.push(...insertedWithoutSiren);
        }

        onProgress?.(Math.min(i + BATCH_SIZE, rows.length), rows.length);
      }

      set(s => ({ prospects: [...allInserted, ...s.prospects] }));
      return { success: true, added, skipped };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.warn('[useProspectStore] batchImportProspects exception:', message);
      return { success: false, error: message };
    }
  },

  // ── updateProspectStatus ────────────────────────────────────────────────────

  updateProspectStatus: async (
    id: string,
    status: string,
    kanbanColumn?: string
  ): Promise<ProspectSyncResult> => {
    const column = kanbanColumn ?? status;
    try {
      const { error } = await supabase
        .from('prospects')
        .update({ status, kanban_column: column, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.warn('[useProspectStore] updateProspectStatus error:', error.message);
        return { success: false, error: error.message };
      }

      set(s => ({
        prospects: s.prospects.map(p =>
          p.id === id ? { ...p, status, kanban_column: column } : p
        ),
      }));
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.warn('[useProspectStore] updateProspectStatus exception:', message);
      return { success: false, error: message };
    }
  },

  // ── updateProspectFields ────────────────────────────────────────────────────

  updateProspectFields: async (
    id: string,
    fields: Partial<ProspectInput>
  ): Promise<ProspectSyncResult> => {
    try {
      const { error } = await supabase
        .from('prospects')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.warn('[useProspectStore] updateProspectFields error:', error.message);
        return { success: false, error: error.message };
      }

      set(s => ({
        prospects: s.prospects.map(p =>
          p.id === id ? { ...p, ...(fields as Partial<ProspectRow>) } : p
        ),
      }));
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.warn('[useProspectStore] updateProspectFields exception:', message);
      return { success: false, error: message };
    }
  },

  // ── deleteProspect ──────────────────────────────────────────────────────────

  deleteProspect: async (id: string): Promise<ProspectSyncResult> => {
    try {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('[useProspectStore] deleteProspect error:', error.message);
        return { success: false, error: error.message };
      }

      set(s => ({ prospects: s.prospects.filter(p => p.id !== id) }));
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.warn('[useProspectStore] deleteProspect exception:', message);
      return { success: false, error: message };
    }
  },

  // ── enrichProspectData ──────────────────────────────────────────────────────

  enrichProspectData: async (
    id: string,
    data: Partial<ProspectInput>
  ): Promise<ProspectSyncResult> => {
    return get().updateProspectFields(id, data);
  },

  // ── convertProspectToClient ─────────────────────────────────────────────────

  convertProspectToClient: async (prospectId: string): Promise<ConvertResult> => {
    try {
      // 1. Fetch the prospect
      const { data: prospectData, error: fetchError } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', prospectId)
        .single();

      if (fetchError || !prospectData) {
        const msg = fetchError?.message ?? 'Prospect introuvable';
        console.warn('[useProspectStore] convertProspectToClient — fetch error:', msg);
        return { success: false, error: msg };
      }

      const p = prospectData as ProspectRow;
      const clientName = p.company_name;
      const contactName = p.contact_name ?? clientName;

      // 2. Insert a new row in `clients`
      // The `clients` table uses French column names (adresse, code_postal, ville)
      let clientId: string;

      const clientPayload = {
        client_name: clientName,
        siren: p.siren ?? null,
        siret: p.siret ?? null,
        adresse: p.address ?? null,
        code_postal: p.postal_code ?? null,
        ville: p.city ?? null,
        legal_form: p.legal_form ?? null,
        forme_juridique: p.forme_juridique ?? null,
        secteur_activite: p.secteur_activite ?? null,
      };

      if (p.contact_email) {
        // Upsert by email to avoid duplicates
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .upsert(
            { ...clientPayload, client_email: p.contact_email, email: p.contact_email },
            { onConflict: 'client_email', ignoreDuplicates: false }
          )
          .select('id')
          .single();

        if (clientError || !clientData) {
          const msg = clientError?.message ?? 'Impossible de créer le client';
          console.warn('[useProspectStore] convertProspectToClient — client upsert error:', msg);
          return { success: false, error: msg };
        }
        clientId = clientData.id as string;
      } else {
        // No email — always insert
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .insert({ ...clientPayload, client_email: null, email: null })
          .select('id')
          .single();

        if (clientError || !clientData) {
          const msg = clientError?.message ?? 'Impossible de créer le client';
          console.warn('[useProspectStore] convertProspectToClient — client insert error:', msg);
          return { success: false, error: msg };
        }
        clientId = clientData.id as string;
      }

      // 3. Update prospect status to 'client_converti'
      const { error: updateError } = await supabase
        .from('prospects')
        .update({
          status: 'client_converti',
          kanban_column: 'gagne',
          updated_at: new Date().toISOString(),
        })
        .eq('id', prospectId);

      if (updateError) {
        console.warn('[useProspectStore] convertProspectToClient — status update error:', updateError.message);
        // Client was created — return success even if status update failed
      }

      // Update local store
      set(s => ({
        prospects: s.prospects.map(pr =>
          pr.id === prospectId
            ? { ...pr, status: 'client_converti', kanban_column: 'gagne' }
            : pr
        ),
      }));

      console.info(
        `[useProspectStore] Prospect "${p.company_name}" converti en client (id: ${clientId}, contact: ${contactName})`
      );

      return { success: true, clientId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.warn('[useProspectStore] convertProspectToClient exception:', message);
      return { success: false, error: message };
    }
  },

  // ── setSelectedSecteur ──────────────────────────────────────────────────────

  setSelectedSecteur: (secteur: string | null) => {
    set({ selectedSecteur: secteur });
  },
}));
