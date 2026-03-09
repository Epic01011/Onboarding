import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
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
import { isJwtStructurallyValid } from '../utils/jwtVerify';

export function useDossiers() {
  const { accessToken, user } = useAuth();
  const [dossiers, setDossiers] = useState<DossierData[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Load dossiers — backend first, localStorage fallback
  const loadDossiers = useCallback(async () => {
    if (!accessToken || !user) {
      setDossiers(getLocalDossiers());
      setLoading(false);
      initialLoadDone.current = true;
      return;
    }

    if (!isJwtStructurallyValid(accessToken)) {
      toast.error('Votre session a expiré. Veuillez vous reconnecter.');
      setDossiers(getLocalDossiers());
      setLoading(false);
      initialLoadDone.current = true;
      return;
    }

    try {
      setLoading(true);
      const response = await getDossiersBackend(accessToken, user.id);
      const list = response.dossiers as DossierData[];
      if (list && list.length > 0) {
        setDossiers(list);
        // Also sync to local storage for offline access
        list.forEach(d => saveLocalDossier(d));
      } else {
        // Fallback to local
        const local = getLocalDossiers();
        setDossiers(local);
      }
    } catch {
      setDossiers(getLocalDossiers());
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [accessToken, user]);

  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  const createDossier = useCallback(async (): Promise<DossierData> => {
    const newDossier = createNewDossier();
    newDossier.clientData = { ...defaultClientData };

    // Optimistic local update
    saveLocalDossier(newDossier);
    setDossiers(prev => [...prev, newDossier]);

    // Sync to backend
    if (accessToken && user) {
      try {
        await saveDossierBackend(newDossier, accessToken, user.id);
      } catch (err) {
        console.error('[Dossiers] Failed to save new dossier to backend:', err);
      }
    }

    return newDossier;
  }, [accessToken, user]);

  const saveDossier = useCallback(async (dossier: DossierData) => {
    const updated = { ...dossier, updatedAt: new Date().toISOString() };

    // Optimistic local update
    saveLocalDossier(updated);
    setDossiers(prev => {
      const idx = prev.findIndex(d => d.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    // Sync to backend
    if (accessToken && user) {
      try {
        await saveDossierBackend(updated, accessToken, user.id);
      } catch (err) {
        console.error('[Dossiers] Failed to save dossier to backend:', err);
      }
    }
  }, [accessToken, user]);

  const removeDossier = useCallback(async (id: string) => {
    // Optimistic local update
    deleteLocalDossier(id);
    setDossiers(prev => prev.filter(d => d.id !== id));

    // Sync to backend
    if (accessToken && user) {
      try {
        await deleteDossierBackend(id, accessToken, user.id);
      } catch (err) {
        console.error('[Dossiers] Failed to delete dossier from backend:', err);
      }
    }
  }, [accessToken, user]);

  const getDossier = useCallback((id: string): DossierData | null => {
    return dossiers.find(d => d.id === id) ?? getLocalDossier(id);
  }, [dossiers]);

  return {
    dossiers,
    loading,
    createDossier,
    saveDossier,
    removeDossier,
    getDossier,
    reload: loadDossiers,
    initialLoadDone: initialLoadDone.current,
  };
}