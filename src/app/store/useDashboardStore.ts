/**
 * useDashboardStore.ts
 *
 * Global Zustand store for the accounting firm dashboard.
 * Single source of truth for: ClientKYC, FiscalTask, AIEmailDraft,
 * PricingProposal, DunningStep, and pending n8n async jobs.
 *
 * Async actions POST → 202 + job_id → polling loop.
 * Optimistic UI: state updated immediately, rolled back on error.
 */

import { create } from 'zustand';
import {
  ClientKYC,
  FiscalTask,
  FiscalTaskStatus,
  AIEmailDraft,
  AIEmailDraftStatus,
  PricingProposal,
  PricingInductors,
  PricingLine,
  DunningStep,
  N8nJob,
  UrgencySemantic,
  ProductionStep,
} from '../types/dashboard';
import { apiClient, ApiError } from '../utils/apiClient';
import { toast } from 'sonner';
import { fetchAccountingYears } from '../services/pennylaneApi';
import {
  upsertBalanceSheet,
  getBalanceSheets,
  updateBalanceSheetProduction,
  type BalanceSheetRecord,
} from '../utils/supabaseSync';
import { supabase } from '../utils/supabaseClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute urgency based on days remaining before due_date */
export function computeUrgency(dueDateIso: string): UrgencySemantic {
  const days = Math.ceil(
    (new Date(dueDateIso).getTime() - Date.now()) / 86_400_000,
  );
  if (days <= 7) return 'red';
  if (days <= 21) return 'orange';
  return 'green';
}

/** Simple polling helper with exponential backoff — resolves when job is done or times out. */
async function pollJob(jobId: string, maxMs = 120_000): Promise<N8nJob> {
  const start = Date.now();
  let delay = 2000; // start at 2s, double each attempt, cap at 16s
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, 16_000);
    const job = await apiClient.get<N8nJob>(`/jobs/${jobId}`).catch(() => null);
    if (job && job.status !== 'pending') return job;
  }
  throw new Error(`Job ${jobId} timed out after ${maxMs / 1000}s`);
}

// ─── Pricing constants ────────────────────────────────────────────────────────

const HOURLY_RATE = 120; // € HT per hour

function buildPricingLines(inductors: PricingInductors): PricingLine[] {
  const lines: PricingLine[] = [];

  // Base accounting
  const baseHours = 40 + Math.ceil(inductors.monthly_invoice_volume / 10) * 2;
  lines.push({
    label: 'Tenue comptable & bilan',
    base_hours: baseHours,
    coefficient: 1,
    hours_after_coeff: baseHours,
    hourly_rate: HOURLY_RATE,
    annual_amount: baseHours * HOURLY_RATE,
  });

  // International operations (+60%)
  if (inductors.has_international_ops) {
    const extra = Math.ceil(baseHours * 0.6);
    lines.push({
      label: 'Supplément opérations internationales',
      base_hours: baseHours,
      coefficient: 0.6,
      hours_after_coeff: extra,
      hourly_rate: HOURLY_RATE,
      annual_amount: extra * HOURLY_RATE,
    });
  }

  // Stock management (+20%)
  if (inductors.has_stock_management) {
    const extra = Math.ceil(baseHours * 0.2);
    lines.push({
      label: 'Gestion des stocks',
      base_hours: baseHours,
      coefficient: 0.2,
      hours_after_coeff: extra,
      hourly_rate: HOURLY_RATE,
      annual_amount: extra * HOURLY_RATE,
    });
  }

  // Payroll
  if (inductors.employee_count > 0) {
    const payrollHours = inductors.employee_count * 3;
    lines.push({
      label: `Gestion de la paie (${inductors.employee_count} salarié${inductors.employee_count > 1 ? 's' : ''})`,
      base_hours: payrollHours,
      coefficient: 1,
      hours_after_coeff: payrollHours,
      hourly_rate: HOURLY_RATE,
      annual_amount: payrollHours * HOURLY_RATE,
    });
  }

  // Multiple VAT (+15%)
  if (inductors.has_multiple_vat) {
    const extra = Math.ceil(baseHours * 0.15);
    lines.push({
      label: 'Régimes TVA multiples',
      base_hours: baseHours,
      coefficient: 0.15,
      hours_after_coeff: extra,
      hourly_rate: HOURLY_RATE,
      annual_amount: extra * HOURLY_RATE,
    });
  }

  // Holding (+25%)
  if (inductors.is_holding) {
    const extra = Math.ceil(baseHours * 0.25);
    lines.push({
      label: 'Structure holding / groupe',
      base_hours: baseHours,
      coefficient: 0.25,
      hours_after_coeff: extra,
      hourly_rate: HOURLY_RATE,
      annual_amount: extra * HOURLY_RATE,
    });
  }

  // DAS2 (flat 4h)
  if (inductors.requires_das2) {
    lines.push({
      label: 'Déclaration DAS2',
      base_hours: 4,
      coefficient: 1,
      hours_after_coeff: 4,
      hourly_rate: HOURLY_RATE,
      annual_amount: 4 * HOURLY_RATE,
    });
  }

  return lines;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface DashboardStore {
  clients: ClientKYC[];
  fiscalTasks: FiscalTask[];
  emailDrafts: AIEmailDraft[];
  pricingProposals: PricingProposal[];
  dunningSteps: DunningStep[];
  pendingJobs: N8nJob[];

  /** Balance sheet records from Supabase (enriched from Pennylane sync) */
  balanceSheets: BalanceSheetRecord[];
  /** True while syncBalanceSheetData is running */
  syncingBalanceSheets: boolean;
  /** ISO timestamp of last successful Pennylane sync */
  lastBalanceSheetSync: string | null;
  /** Error message from last balance sheet sync attempt, or null */
  balanceSheetsError: string | null;
  /** Async load status for balance sheets */
  balanceSheetsLoadStatus: 'idle' | 'loading' | 'success' | 'error';

  loadingClients: boolean;
  loadingFiscalTasks: boolean;
  loadingEmailDrafts: boolean;

  fetchClients: () => Promise<void>;
  lookupSiren: (siren: string) => Promise<string>;
  upsertClient: (client: ClientKYC) => void;

  fetchFiscalTasks: (clientId?: string) => Promise<void>;
  updateFiscalTaskStatus: (taskId: string, status: FiscalTaskStatus) => Promise<void>;
  refreshUrgencies: () => void;

  fetchEmailDrafts: () => Promise<void>;
  approveEmailDraft: (id: string, finalDraft: string) => Promise<void>;
  rejectEmailDraft: (id: string) => Promise<void>;
  updateEmailDraftStatus: (id: string, status: AIEmailDraftStatus) => void;

  generatePricingProposal: (clientId: string, clientName: string, inductors: PricingInductors) => PricingProposal;
  requestPdfGeneration: (proposalId: string) => Promise<void>;

  fetchDunningSteps: () => Promise<void>;
  cancelDunningStep: (id: string) => Promise<void>;

  /**
   * Fetches accounting years from Pennylane, computes due_date and urgency,
   * persists each record to Supabase `balance_sheets`, then reloads local state.
   * Shows toast notifications on success/failure.
   */
  syncBalanceSheetData: () => Promise<void>;

  /**
   * Loads balance sheets previously stored in Supabase (no Pennylane call).
   * Used on initial mount to restore state from the DB.
   */
  loadBalanceSheetsFromSupabase: () => Promise<void>;

  /**
   * Updates the production step and/or assigned manager of a single balance
   * sheet record, both locally and in Supabase.
   */
  updateBalanceSheet: (
    pennylaneId: string,
    updates: { productionStep?: ProductionStep; assignedManager?: string }
  ) => Promise<void>;

  /**
   * Returns balance sheets sorted by proximity to closing_date (soonest first).
   * Selector — call inside a component with useDashboardStore(s => s.getProductionPlanning()).
   */
  getProductionPlanning: () => BalanceSheetRecord[];
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  clients: [],
  fiscalTasks: [],
  emailDrafts: [],
  pricingProposals: [],
  dunningSteps: [],
  pendingJobs: [],
  balanceSheets: [],
  syncingBalanceSheets: false,
  lastBalanceSheetSync: null,
  balanceSheetsError: null,
  balanceSheetsLoadStatus: 'idle',
  loadingClients: false,
  loadingFiscalTasks: false,
  loadingEmailDrafts: false,

  // ── Client KYC ──────────────────────────────────────────────────────────────

  fetchClients: async () => {
    set({ loadingClients: true });
    try {
      const clients = await apiClient.get<ClientKYC[]>('/webhook/clients');
      set({ clients, loadingClients: false });
    } catch (err) {
      set({ loadingClients: false });
      if (err instanceof ApiError) toast.error(`Impossible de charger les clients : ${err.message}`);
    }
  },

  lookupSiren: async (siren: string) => {
    const result = await apiClient.post<N8nJob>('/webhook/siren-lookup', { siren });
    const job: N8nJob = { ...result, status: 'pending', created_at: new Date().toISOString() };
    set(s => ({ pendingJobs: [...s.pendingJobs, job] }));

    // Poll in background; update client when done
    pollJob(job.job_id).then(finished => {
      set(s => ({ pendingJobs: s.pendingJobs.filter(j => j.job_id !== job.job_id) }));
      if (finished.status === 'completed' && finished.result) {
        get().upsertClient(finished.result as ClientKYC);
      }
    }).catch(() => {
      set(s => ({ pendingJobs: s.pendingJobs.filter(j => j.job_id !== job.job_id) }));
    });

    return job.job_id;
  },

  upsertClient: (client: ClientKYC) => {
    set(s => {
      const idx = s.clients.findIndex(c => c.internal_client_id === client.internal_client_id);
      if (idx >= 0) {
        const updated = [...s.clients];
        updated[idx] = client;
        return { clients: updated };
      }
      return { clients: [...s.clients, client] };
    });
  },

  // ── Fiscal tasks ─────────────────────────────────────────────────────────────

  fetchFiscalTasks: async (clientId?: string) => {
    set({ loadingFiscalTasks: true });
    try {
      const path = clientId
        ? `/webhook/fiscal-tasks?client_id=${clientId}`
        : '/webhook/fiscal-tasks';
      const tasks = await apiClient.get<FiscalTask[]>(path);
      const refreshed = tasks.map(t => ({ ...t, urgency_semantic: computeUrgency(t.due_date) }));
      set({ fiscalTasks: refreshed, loadingFiscalTasks: false });
    } catch (err) {
      set({ loadingFiscalTasks: false });
      if (err instanceof ApiError) toast.error(`Tâches fiscales : ${err.message}`);
    }
  },

  updateFiscalTaskStatus: async (taskId: string, status: FiscalTaskStatus) => {
    set(s => ({
      fiscalTasks: s.fiscalTasks.map(t =>
        t.id === taskId ? { ...t, status, updated_at: new Date().toISOString() } : t,
      ),
    }));
    try {
      await apiClient.patch(`/webhook/fiscal-tasks/${taskId}`, { status });
    } catch {
      toast.error('Erreur lors de la mise à jour de la tâche.');
      get().fetchFiscalTasks();
    }
  },

  refreshUrgencies: () => {
    set(s => ({
      fiscalTasks: s.fiscalTasks.map(t => ({
        ...t,
        urgency_semantic: computeUrgency(t.due_date),
      })),
    }));
  },

  // ── AI Email Drafts ───────────────────────────────────────────────────────────

  fetchEmailDrafts: async () => {
    set({ loadingEmailDrafts: true });
    try {
      const drafts = await apiClient.get<AIEmailDraft[]>('/webhook/email-drafts');
      set({ emailDrafts: drafts, loadingEmailDrafts: false });
    } catch (err) {
      set({ loadingEmailDrafts: false });
      if (err instanceof ApiError) toast.error(`Inbox IA : ${err.message}`);
    }
  },

  approveEmailDraft: async (id: string, finalDraft: string) => {
    const prev = get().emailDrafts.find(d => d.id === id);
    set(s => ({
      emailDrafts: s.emailDrafts.map(d =>
        d.id === id
          ? { ...d, status: 'approved', final_draft: finalDraft, reviewed_at: new Date().toISOString() }
          : d,
      ),
    }));
    try {
      await apiClient.patch(`/webhook/email-drafts/${id}`, { status: 'approved', final_draft: finalDraft });
    } catch {
      if (prev) set(s => ({ emailDrafts: s.emailDrafts.map(d => (d.id === id ? prev : d)) }));
      toast.error("Erreur lors de l'approbation du brouillon.");
    }
  },

  rejectEmailDraft: async (id: string) => {
    const prev = get().emailDrafts.find(d => d.id === id);
    set(s => ({
      emailDrafts: s.emailDrafts.map(d =>
        d.id === id ? { ...d, status: 'rejected', reviewed_at: new Date().toISOString() } : d,
      ),
    }));
    try {
      await apiClient.patch(`/webhook/email-drafts/${id}`, { status: 'rejected' });
    } catch {
      if (prev) set(s => ({ emailDrafts: s.emailDrafts.map(d => (d.id === id ? prev : d)) }));
      toast.error('Erreur lors du rejet du brouillon.');
    }
  },

  updateEmailDraftStatus: (id: string, status: AIEmailDraftStatus) => {
    set(s => ({
      emailDrafts: s.emailDrafts.map(d => (d.id === id ? { ...d, status } : d)),
    }));
  },

  // ── Pricing Engine ────────────────────────────────────────────────────────────

  generatePricingProposal: (clientId: string, clientName: string, inductors: PricingInductors) => {
    const lines = buildPricingLines(inductors);
    const total_hours = lines.reduce((acc, l) => acc + l.hours_after_coeff, 0);
    const total_annual_ht = lines.reduce((acc, l) => acc + l.annual_amount, 0);
    const monthly_ht = Math.ceil(total_annual_ht / 12);

    const proposal: PricingProposal = {
      id: crypto.randomUUID(),
      client_id: clientId,
      client_name: clientName,
      inductors,
      lines,
      total_hours,
      total_annual_ht,
      monthly_ht,
      created_at: new Date().toISOString(),
    };

    set(s => ({ pricingProposals: [...s.pricingProposals, proposal] }));
    return proposal;
  },

  requestPdfGeneration: async (proposalId: string) => {
    const proposal = get().pricingProposals.find(p => p.id === proposalId);
    if (!proposal) return;
    try {
      const job = await apiClient.post<N8nJob>('/webhook/pricing-pdf', { proposal });
      set(s => ({
        pendingJobs: [...s.pendingJobs, { ...job, status: 'pending', created_at: new Date().toISOString() }],
      }));

      pollJob(job.job_id).then(done => {
        set(s => ({
          pendingJobs: s.pendingJobs.filter(j => j.job_id !== job.job_id),
          pricingProposals: s.pricingProposals.map(p =>
            p.id === proposalId
              ? { ...p, pdf_job_id: job.job_id, pdf_url: (done.result as { url?: string })?.url }
              : p,
          ),
        }));
        toast.success('Proposition commerciale PDF générée !');
      }).catch(() => {
        toast.error('Impossible de générer le PDF.');
        set(s => ({ pendingJobs: s.pendingJobs.filter(j => j.job_id !== job.job_id) }));
      });
    } catch (err) {
      if (err instanceof ApiError) toast.error(`PDF : ${err.message}`);
    }
  },

  // ── Dunning ────────────────────────────────────────────────────────────────────

  fetchDunningSteps: async () => {
    try {
      const steps = await apiClient.get<DunningStep[]>('/webhook/dunning');
      set({ dunningSteps: steps });
    } catch (err) {
      if (err instanceof ApiError) toast.error(`Relances : ${err.message}`);
    }
  },

  cancelDunningStep: async (id: string) => {
    const prev = get().dunningSteps.find(d => d.id === id);
    set(s => ({
      dunningSteps: s.dunningSteps.map(d =>
        d.id === id ? { ...d, status: 'cancelled' } : d,
      ),
    }));
    try {
      await apiClient.patch(`/webhook/dunning/${id}`, { status: 'cancelled' });
    } catch {
      if (prev) set(s => ({ dunningSteps: s.dunningSteps.map(d => (d.id === id ? prev : d)) }));
      toast.error("Erreur lors de l'annulation de la relance.");
    }
  },

  // ── Balance Sheets (Suivi des Bilans — Pennylane + Supabase) ─────────────────

  syncBalanceSheetData: async () => {
    set({ syncingBalanceSheets: true, balanceSheetsError: null, balanceSheetsLoadStatus: 'loading' });

    // Get current authenticated user for Supabase writes
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ syncingBalanceSheets: false, balanceSheetsLoadStatus: 'error', balanceSheetsError: 'Non authentifié' });
      toast.error('Vous devez être connecté pour synchroniser les bilans.');
      return;
    }

    // 1. Fetch accounting years from Pennylane
    const result = await fetchAccountingYears();

    if (!result.success || !result.data) {
      const errorMsg = result.error ?? 'Impossible de récupérer les exercices comptables.';
      set({ syncingBalanceSheets: false, balanceSheetsLoadStatus: 'error', balanceSheetsError: errorMsg });
      toast.error(`Pennylane : ${errorMsg}`);
      return;
    }

    const years = result.data;
    const now = new Date().toISOString();
    const syncErrors: string[] = [];

    // 2. For each accounting year, compute due_date (closing + 4 months), urgency, upsert to Supabase
    for (const year of years) {
      const closingDate = new Date(year.closing_date);
      const dueDateObj = new Date(closingDate);
      dueDateObj.setMonth(dueDateObj.getMonth() + 4);
      const dueDate = dueDateObj.toISOString().split('T')[0];

      // Map Pennylane status → production_step default (if new record)
      const existingRecord = get().balanceSheets.find(b => b.pennylaneId === year.id);
      const productionStep: ProductionStep = existingRecord?.productionStep ?? (
        year.status === 'closed' ? 'certified' :
        year.status === 'closing_in_progress' ? 'revision' :
        'not_started'
      );

      const urgencySemantic: UrgencySemantic = computeUrgency(dueDate);

      const record: BalanceSheetRecord = {
        userId: user.id,
        pennylaneId: year.id,
        customerId: year.customer_id,
        customerName: year.customer_name,
        startDate: year.start_date,
        closingDate: year.closing_date,
        pennylaneStatus: year.status,
        productionStep,
        assignedManager: existingRecord?.assignedManager,
        dueDate,
        urgencySemantic,
      };

      const syncResult = await upsertBalanceSheet(record);
      if (!syncResult.success) {
        syncErrors.push(`${year.customer_name}: ${syncResult.error}`);
      }
    }

    // 3. Reload from Supabase so UI reflects persisted state
    const fetchResult = await getBalanceSheets(user.id);
    if (fetchResult.success) {
      set({
        balanceSheets: fetchResult.data,
        syncingBalanceSheets: false,
        lastBalanceSheetSync: now,
        balanceSheetsLoadStatus: syncErrors.length > 0 ? 'error' : 'success',
        balanceSheetsError: syncErrors.length > 0 ? `${syncErrors.length} erreur(s) de sync` : null,
      });
    } else {
      set({
        syncingBalanceSheets: false,
        lastBalanceSheetSync: now,
        balanceSheetsLoadStatus: 'error',
        balanceSheetsError: fetchResult.error,
      });
    }

    // 4. Notify result
    if (syncErrors.length > 0) {
      toast.error(`Sync Pennylane partielle — ${syncErrors.length} erreur(s) : ${syncErrors[0]}`);
    } else {
      const isDemo = result.demo;
      toast.success(
        isDemo
          ? `Sync Pennylane (démo) — ${years.length} bilan(s) synchronisé(s)`
          : `Sync Pennylane — ${years.length} bilan(s) mis à jour`
      );
    }
  },

  loadBalanceSheetsFromSupabase: async () => {
    set({ balanceSheetsLoadStatus: 'loading', balanceSheetsError: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ balanceSheetsLoadStatus: 'idle' });
      return;
    }

    const result = await getBalanceSheets(user.id);
    if (result.success) {
      set({ balanceSheets: result.data, balanceSheetsLoadStatus: 'success' });
    } else {
      set({ balanceSheetsLoadStatus: 'error', balanceSheetsError: result.error });
    }
  },

  updateBalanceSheet: async (
    pennylaneId: string,
    updates: { productionStep?: ProductionStep; assignedManager?: string }
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Vous devez être connecté pour modifier un bilan.');
      return;
    }

    // Optimistic update
    set(s => ({
      balanceSheets: s.balanceSheets.map(b =>
        b.pennylaneId === pennylaneId
          ? {
              ...b,
              ...(updates.productionStep !== undefined && { productionStep: updates.productionStep }),
              ...(updates.assignedManager !== undefined && { assignedManager: updates.assignedManager }),
              updatedAt: new Date().toISOString(),
            }
          : b
      ),
    }));

    const result = await updateBalanceSheetProduction(user.id, pennylaneId, {
      productionStep: updates.productionStep,
      assignedManager: updates.assignedManager,
    });

    if (!result.success) {
      // Roll back optimistic update by reloading from Supabase
      const fetchResult = await getBalanceSheets(user.id);
      if (fetchResult.success) set({ balanceSheets: fetchResult.data });
      toast.error(`Erreur mise à jour bilan : ${result.error}`);
    }
  },

  getProductionPlanning: () => {
    return [...get().balanceSheets].sort((a, b) =>
      new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime()
    );
  },
}));
