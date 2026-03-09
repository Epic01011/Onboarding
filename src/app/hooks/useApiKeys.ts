import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getServiceConnections, 
  saveServiceConnections, 
  loadIntegrationsFromSupabase,
  saveIntegrationToSupabase,
  ServiceConnections,
  ServiceConnection,
  defaultConnections 
} from '../utils/servicesStorage';

export function useApiKeys() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<ServiceConnections>(defaultConnections);
  const [loading, setLoading] = useState(true);

  // Load API keys — Supabase first, localStorage fallback
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setConnections(getServiceConnections());
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const loaded = await loadIntegrationsFromSupabase(user.id);
        if (cancelled) return;

        // Check if any integrations were found (non-default)
        const hasData = Object.values(loaded).some(c => c.connected);
        if (hasData) {
          setConnections(loaded);
          // Sync to localStorage as cache
          saveServiceConnections(loaded);
        } else {
          // No Supabase data yet — try localStorage cache
          const local = getServiceConnections();
          const hasLocal = Object.values(local).some(c => c.connected);
          setConnections(hasLocal ? local : loaded);
        }
      } catch {
        if (!cancelled) setConnections(getServiceConnections());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  const updateService = async (
    service: keyof ServiceConnections,
    data: Partial<ServiceConnection>,
  ) => {
    const updated: ServiceConnections = {
      ...connections,
      [service]: { ...connections[service], ...data },
    };

    // Optimistic local update
    setConnections(updated);
    saveServiceConnections(updated);

    // Persist to Supabase if authenticated
    if (user) {
      try {
        await saveIntegrationToSupabase(service, updated[service], user.id);
      } catch (err) {
        console.error(`[API Keys] Failed to save ${service} to Supabase:`, err);
        // Don't throw — localStorage already saved it
      }
    }
  };

  return { connections, updateService, loading };
}