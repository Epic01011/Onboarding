import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useDossiersStore } from '../store/useDossiersStore';

/**
 * DossiersInitializer
 *
 * Zero-render component that bridges the Auth context into the Zustand
 * dossiers store. Render it once inside <AuthProvider> (e.g. in App.tsx)
 * instead of the old <DossiersProvider> wrapper.
 */
export function DossiersInitializer() {
  const { accessToken, user } = useAuth();

  useEffect(() => {
    useDossiersStore.getState().initDossiers(accessToken, user?.id ?? null);
  }, [accessToken, user?.id]);

  return null;
}

/**
 * useDossiersContext
 *
 * Backward-compatible hook — delegates to useDossiersStore so that all
 * existing consumers continue to work without any changes.
 */
export function useDossiersContext() {
  const {
    dossiers,
    loading,
    initialLoadDone,
    createDossier,
    saveDossier,
    removeDossier,
    getDossier,
    reload,
  } = useDossiersStore();

  return {
    dossiers,
    loading,
    initialLoadDone,
    createDossier,
    saveDossier,
    removeDossier,
    getDossier,
    reload,
  };
}