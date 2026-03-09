/**
 * useOnboardingDraftStore.ts
 *
 * Zustand store with `persist` middleware providing instant localStorage
 * persistence for onboarding draft sessions.
 *
 * This store complements the debounced Supabase sync in OnboardingFlow.tsx by:
 *  - Offering zero-latency draft recovery after page refresh
 *  - Storing onboarding metadata that doesn't belong in DossierData
 *    (e.g. the Supabase prospects.id created transparently on first input)
 *  - Exposing a `savedAt` timestamp to drive the "auto-saved" indicator
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ClientData, StepStatus } from '../context/OnboardingContext';

export interface OnboardingDraftEntry {
  clientData: ClientData;
  currentStep: number;
  stepStatuses: StepStatus[];
  /** Supabase prospects.id — populated after auto-prospect creation on Step 1 */
  prospectId: string | null;
  /** ISO timestamp of the last local save */
  savedAt: string;
}

interface OnboardingDraftStore {
  /** dossierId → draft entry */
  drafts: Record<string, OnboardingDraftEntry>;

  /** Write / update a draft for a given dossier */
  saveDraft: (
    dossierId: string,
    entry: Omit<OnboardingDraftEntry, 'savedAt'>
  ) => void;

  /** Read back the latest draft for a given dossier, or null if none */
  getDraft: (dossierId: string) => OnboardingDraftEntry | null;

  /** Remove a draft (e.g. after onboarding is fully completed) */
  clearDraft: (dossierId: string) => void;
}

export const useOnboardingDraftStore = create<OnboardingDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},

      saveDraft: (dossierId, entry) =>
        set(s => ({
          drafts: {
            ...s.drafts,
            [dossierId]: { ...entry, savedAt: new Date().toISOString() },
          },
        })),

      getDraft: dossierId => get().drafts[dossierId] ?? null,

      clearDraft: dossierId =>
        set(s => {
          const { [dossierId]: _removed, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'cabinetflow_onboarding_drafts' }
  )
);
