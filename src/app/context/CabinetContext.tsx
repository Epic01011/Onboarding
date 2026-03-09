import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getCabinetInfo as getLocalCabinetInfo, saveCabinetInfo as saveLocalCabinetInfo, CabinetInfo, defaultCabinetInfo } from '../utils/servicesStorage';
import { getCabinetInfoBackend as getBackendCabinetInfo, updateCabinetInfoBackend as updateBackendCabinetInfo } from '../utils/backendApi';
import { useAuth } from './AuthContext';

interface CabinetContextType {
  cabinet: CabinetInfo;
  updateCabinet: (data: Partial<CabinetInfo>) => void;
  saveCabinet: () => Promise<void>;
  loading: boolean;
}

const CabinetContext = createContext<CabinetContextType | null>(null);

export function CabinetProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [cabinet, setCabinet] = useState<CabinetInfo>(defaultCabinetInfo);
  const [loading, setLoading] = useState(true);

  // Load cabinet info from backend when user is authenticated
  useEffect(() => {
    let cancelled = false;
    const loadCabinetInfo = async () => {
      if (!accessToken || !user) {
        // If not authenticated, use local storage as fallback
        setCabinet(getLocalCabinetInfo());
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getBackendCabinetInfo(accessToken, user.id);
        if (cancelled) return;
        if (response.cabinetInfo && typeof response.cabinetInfo === 'object') {
          // Merge with defaults to ensure all keys exist
          const info = { ...defaultCabinetInfo, ...(response.cabinetInfo as Partial<CabinetInfo>) };
          setCabinet(info);
          // Also cache locally
          saveLocalCabinetInfo(info);
        } else {
          // No data in backend yet, use local or default
          const local = getLocalCabinetInfo();
          const hasLocalData = Object.values(local).some(v => v !== '');
          setCabinet(hasLocalData ? local : defaultCabinetInfo);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[Cabinet] Failed to load cabinet info:', error);
        // Fallback to localStorage on error
        setCabinet(getLocalCabinetInfo());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCabinetInfo();
    return () => { cancelled = true; };
  }, [accessToken, user]);

  const updateCabinet = (data: Partial<CabinetInfo>) => {
    setCabinet(prev => {
      const updated = { ...prev, ...data };
      // Auto-save to local storage as cache
      saveLocalCabinetInfo(updated);
      return updated;
    });
  };

  const saveCabinet = async () => {
    if (!accessToken || !user) {
      // If not authenticated, save to localStorage only
      saveLocalCabinetInfo(cabinet);
      return;
    }

    try {
      await updateBackendCabinetInfo(cabinet, accessToken, user.id);
      // Also save to localStorage as cache
      saveLocalCabinetInfo(cabinet);
      console.log('[Cabinet] Successfully saved to backend');
    } catch (error) {
      console.error('[Cabinet] Failed to save cabinet info:', error);
      throw error;
    }
  };

  return (
    <CabinetContext.Provider value={{ cabinet, updateCabinet, saveCabinet, loading }}>
      {children}
    </CabinetContext.Provider>
  );
}

export function useCabinet() {
  const ctx = useContext(CabinetContext);
  if (!ctx) throw new Error('useCabinet must be used within CabinetProvider');
  return ctx;
}