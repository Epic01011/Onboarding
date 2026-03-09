/**
 * SharePointContext — Site SharePoint configuré + création de dossiers GED
 *
 * - Sélection et persistance du site SharePoint utilisé (Supabase KV)
 * - Chargement de la liste des sites disponibles via Graph API
 * - Création de la structure de dossiers pour un client donné
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../utils/supabaseClient';
import { useMicrosoftAuth } from './MicrosoftAuthContext';
import { getSharePointSites, SharePointSite } from '../utils/microsoftGraph';
import { provisionClientFolder } from '../utils/sharepointGed';
import { ClientData } from './OnboardingContext';

/** Clé de stockage dans la table user_kv de Supabase */
const SP_SITE_KEY = 'sharepoint_site_config';

export interface SharePointState {
  /** ID du site SharePoint sélectionné par l'utilisateur */
  configuredSiteId: string | null;
  /** Nom affichable du site sélectionné */
  configuredSiteName: string | null;
  /** URL du site sélectionné */
  configuredSiteUrl: string | null;
  /** Liste des sites disponibles dans le tenant Microsoft */
  availableSites: SharePointSite[];
  /** Chargement de la liste des sites */
  loadingSites: boolean;
  /** Vrai si un site est configuré */
  isConfigured: boolean;
  /** Sélectionne et sauvegarde un site */
  setSite: (site: SharePointSite) => Promise<void>;
  /** Réinitialise le site configuré */
  clearSite: () => Promise<void>;
  /** Recharge la liste des sites depuis Microsoft Graph */
  loadSites: () => Promise<void>;
  /**
   * Crée la structure de dossiers SharePoint pour un client.
   * Retourne { folderId, folderUrl } à stocker dans ClientData.
   */
  createClientFolder: (
    client: Pick<ClientData, 'siren' | 'raisonSociale' | 'nom'>,
  ) => Promise<{ folderId: string; folderUrl: string }>;
}

const SharePointContext = createContext<SharePointState | null>(null);

export function SharePointProvider({ children }: { children: ReactNode }) {
  const { graphToken, isConnected } = useMicrosoftAuth();

  const [configuredSiteId, setConfiguredSiteId] = useState<string | null>(null);
  const [configuredSiteName, setConfiguredSiteName] = useState<string | null>(null);
  const [configuredSiteUrl, setConfiguredSiteUrl] = useState<string | null>(null);
  const [availableSites, setAvailableSites] = useState<SharePointSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  // — Restaure la config depuis Supabase KV au chargement
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const { data } = await supabase
          .from('user_kv')
          .select('value')
          .eq('user_id', user.id)
          .eq('key', SP_SITE_KEY)
          .maybeSingle();
        if (data?.value) {
          const parsed = JSON.parse(data.value) as {
            siteId: string;
            siteName: string;
            siteUrl: string;
          };
          setConfiguredSiteId(parsed.siteId ?? null);
          setConfiguredSiteName(parsed.siteName ?? null);
          setConfiguredSiteUrl(parsed.siteUrl ?? null);
        }
      } catch { /* ignore — KV peut ne pas encore exister */ }
    };
    load();
  }, []);

  // — Charge les sites dès que le token Graph est disponible
  const loadSites = useCallback(async () => {
    if (!graphToken) return;
    setLoadingSites(true);
    try {
      const sites = await getSharePointSites(graphToken);
      setAvailableSites(sites);
    } catch (err) {
      console.warn('[SharePoint] loadSites error:', err);
    } finally {
      setLoadingSites(false);
    }
  }, [graphToken]);

  useEffect(() => {
    if (isConnected && graphToken) {
      loadSites();
    }
  }, [isConnected, graphToken, loadSites]);

  // — Sélectionne et persiste le site
  const setSite = useCallback(async (site: SharePointSite) => {
    setConfiguredSiteId(site.id);
    setConfiguredSiteName(site.displayName);
    setConfiguredSiteUrl(site.webUrl);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_kv').upsert(
      {
        user_id: user.id,
        key: SP_SITE_KEY,
        value: JSON.stringify({
          siteId: site.id,
          siteName: site.displayName,
          siteUrl: site.webUrl,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    );
  }, []);

  const clearSite = useCallback(async () => {
    setConfiguredSiteId(null);
    setConfiguredSiteName(null);
    setConfiguredSiteUrl(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_kv')
      .delete()
      .eq('user_id', user.id)
      .eq('key', SP_SITE_KEY);
  }, []);

  // — Crée la structure de dossiers pour un client
  const createClientFolder = useCallback(
    async (client: Pick<ClientData, 'siren' | 'raisonSociale' | 'nom'>) => {
      if (!graphToken) throw new Error('Token Microsoft non disponible. Vérifiez votre connexion Microsoft 365.');
      if (!configuredSiteId) throw new Error('Aucun site SharePoint configuré. Allez dans GED → Sélectionner un site.');
      const name = client.raisonSociale || client.nom || 'Client';
      const result = await provisionClientFolder(graphToken, configuredSiteId, client.siren, name);
      return { folderId: result.folderId, folderUrl: result.folderUrl };
    },
    [graphToken, configuredSiteId],
  );

  return (
    <SharePointContext.Provider
      value={{
        configuredSiteId,
        configuredSiteName,
        configuredSiteUrl,
        availableSites,
        loadingSites,
        isConfigured: !!configuredSiteId,
        setSite,
        clearSite,
        loadSites,
        createClientFolder,
      }}
    >
      {children}
    </SharePointContext.Provider>
  );
}

export function useSharePoint(): SharePointState {
  const ctx = useContext(SharePointContext);
  if (!ctx) throw new Error('useSharePoint must be used within SharePointProvider');
  return ctx;
}
