/**
 * useDossiersStore.ts
 *
 * Zustand store for dossiers — replaces DossiersContext / useDossiers hook.
 *
 * Auth credentials (accessToken, userId) are injected via initDossiers() which
 * is called by the DossiersInitializer component whenever the authenticated user
 * changes. All async actions read credentials from the store state, so no React
 * context or hook is needed inside the store itself.
 */

import { create } from 'zustand';
import {
  getAllDossiers as getLocalDossiers,
  getDossier as getLocalDossier,
  saveDossier as saveLocalDossier,
  deleteDossier as deleteLocalDossier,
  createNewDossier,
  DossierData,
} from '../utils/localStorage';
import {
  getDossiersBackend,
  saveDossierBackend,
  deleteDossierBackend,
} from '../utils/backendApi';
import { defaultClientData } from '../context/OnboardingContext';

// ─── Store shape ──────────────────────────────────────────────────────────────

interface DossiersStore {
  // Public state
  dossiers: DossierData[];
  loading: boolean;
  initialLoadDone: boolean;

  // Internal auth — set by DossiersInitializer, used by async actions
  _accessToken: string | null;
  _userId: string | null;

  // Actions
  /** Called by DossiersInitializer on mount and whenever auth changes. */
  initDossiers: (accessToken: string | null, userId: string | null) => Promise<void>;
  /** Re-fetch dossiers from backend (or localStorage fallback). */
  reload: () => Promise<void>;
  createDossier: () => Promise<DossierData>;
  saveDossier: (dossier: DossierData) => Promise<void>;
  removeDossier: (id: string) => Promise<void>;
  getDossier: (id: string) => DossierData | null;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useDossiersStore = create<DossiersStore>((set, get) => ({
  dossiers: [],
  loading: true,
  initialLoadDone: false,
  _accessToken: null,
  _userId: null,

  // ── Auth bootstrap ──────────────────────────────────────────────────────────

  initDossiers: async (accessToken, userId) => {
    set({ _accessToken: accessToken, _userId: userId });
    await get().reload();
  },

  // ── Load ────────────────────────────────────────────────────────────────────

  reload: async () => {
    const { _accessToken, _userId } = get();

    if (!_accessToken || !_userId) {
      set({ dossiers: getLocalDossiers(), loading: false, initialLoadDone: true });
      return;
    }

    try {
      set({ loading: true });
      const response = await getDossiersBackend(_accessToken, _userId);
      const list = Array.isArray(response.dossiers)
        ? (response.dossiers as DossierData[])
        : [];
      if (list.length > 0) {
        // Sync backend data to localStorage for offline access
        list.forEach(d => saveLocalDossier(d));
        set({ dossiers: list, loading: false, initialLoadDone: true });
      } else {
        set({ dossiers: getLocalDossiers(), loading: false, initialLoadDone: true });
      }
    } catch {
      set({ dossiers: getLocalDossiers(), loading: false, initialLoadDone: true });
    }
  },

  // ── Mutations ───────────────────────────────────────────────────────────────

  createDossier: async () => {
    const { _accessToken, _userId } = get();
    const newDossier = createNewDossier();
    newDossier.clientData = { ...defaultClientData };

    // Optimistic local update
    saveLocalDossier(newDossier);
    set(s => ({ dossiers: [...s.dossiers, newDossier] }));

    // Sync to backend
    if (_accessToken && _userId) {
      try {
        await saveDossierBackend(newDossier, _accessToken, _userId);
      } catch (err) {
        console.error('[Dossiers] Failed to save new dossier to backend:', err);
      }
    }

    return newDossier;
  },

  saveDossier: async (dossier) => {
    const { _accessToken, _userId } = get();
    const updated = { ...dossier, updatedAt: new Date().toISOString() };

    // Optimistic local update
    saveLocalDossier(updated);
    set(s => {
      const idx = s.dossiers.findIndex(d => d.id === updated.id);
      if (idx >= 0) {
        const copy = [...s.dossiers];
        copy[idx] = updated;
        return { dossiers: copy };
      }
      return { dossiers: [...s.dossiers, updated] };
    });

    // Sync to backend
    if (_accessToken && _userId) {
      try {
        await saveDossierBackend(updated, _accessToken, _userId);
      } catch (err) {
        console.error('[Dossiers] Failed to save dossier to backend:', err);
      }
    }
  },

  removeDossier: async (id) => {
    const { _accessToken, _userId } = get();

    // Optimistic local update
    deleteLocalDossier(id);
    set(s => ({ dossiers: s.dossiers.filter(d => d.id !== id) }));

    // Sync to backend
    if (_accessToken && _userId) {
      try {
        await deleteDossierBackend(id, _accessToken, _userId);
      } catch (err) {
        console.error('[Dossiers] Failed to delete dossier from backend:', err);
      }
    }
  },

  getDossier: (id) => {
    const { dossiers } = get();
    return dossiers.find(d => d.id === id) ?? getLocalDossier(id);
  },
}));
