import { supabase } from './supabaseClient';
import { encryptApiKey, decryptApiKey } from './cryptoUtils';

export interface ServiceConnection {
  connected: boolean;
  email?: string;
  displayName?: string;
  apiKey?: string;
  baseId?: string;
  connectedAt?: string;
  // Email-specific fields (for SendGrid)
  fromEmail?: string;
  fromName?: string;
  // Google Gmail / SMTP app password
  appPassword?: string;
  // Google Drive / SharePoint document storage
  folderId?: string;
  // Webhook-based services (e.g. DGFIP / impots.gouv via n8n)
  webhookUrl?: string;
}

export interface ServiceConnections {
  microsoft: ServiceConnection;
  yousign: ServiceConnection;
  google: ServiceConnection;
  googleDrive: ServiceConnection;
  jesignexpert: ServiceConnection;
  airtable: ServiceConnection;
  pennylane: ServiceConnection;
  sendgrid: ServiceConnection;
  hubspot: ServiceConnection;
  pipedrive: ServiceConnection;
  pappers: ServiceConnection;
  /** Portail Impôts.gouv (DGFIP) — attestations via l'API Entreprise (VITE_API_ENTREPRISE_TOKEN) */
  impotsgouv: ServiceConnection;
}

export type AiProvider = 'claude' | 'openai' | 'perplexity';

export interface CabinetInfo {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  siren: string;
  numeroOrdre: string;
  expertNom: string;
  expertEmail: string;
  telephone: string;
  /** Capital social du cabinet (affiché dans les lettres de mission et confraternelles) */
  capitalSocial: string;
  /** URL du logo du cabinet (utilisé dans les emails générés par l'IA) */
  cabinetLogoUrl?: string;
  /** Clé API IA (Claude Anthropic ou OpenAI) */
  aiApiKey?: string;
  /** Clé API Perplexity (recherche et synthèse web) */
  perplexityApiKey?: string;
  /** Fournisseur IA par défaut pour le cabinet */
  aiProvider?: AiProvider;
}

const SERVICES_KEY = 'cabinetflow_services';
const CABINET_KEY = 'cabinetflow_cabinet';

export const defaultConnections: ServiceConnections = {
  microsoft: { connected: false },
  yousign: { connected: false },
  google: { connected: false },
  googleDrive: { connected: false },
  jesignexpert: { connected: false },
  airtable: { connected: false },
  pennylane: { connected: false },
  sendgrid: { connected: false },
  hubspot: { connected: false },
  pipedrive: { connected: false },
  pappers: { connected: false },
  impotsgouv: { connected: false },
};

export const defaultCabinetInfo: CabinetInfo = {
  nom: '',
  adresse: '',
  codePostal: '',
  ville: '',
  siren: '',
  numeroOrdre: '',
  expertNom: '',
  expertEmail: '',
  telephone: '',
  capitalSocial: '',
  cabinetLogoUrl: '',
  aiApiKey: '',
  perplexityApiKey: '',
  aiProvider: 'claude',
};

export function getServiceConnections(): ServiceConnections {
  try {
    const data = localStorage.getItem(SERVICES_KEY);
    if (!data) return { ...defaultConnections };
    const parsed = JSON.parse(data);
    return {
      microsoft: { ...defaultConnections.microsoft, ...parsed.microsoft },
      yousign: { ...defaultConnections.yousign, ...parsed.yousign },
      google: { ...defaultConnections.google, ...parsed.google },
      googleDrive: { ...defaultConnections.googleDrive, ...parsed.googleDrive },
      jesignexpert: { ...defaultConnections.jesignexpert, ...parsed.jesignexpert },
      airtable: { ...defaultConnections.airtable, ...parsed.airtable },
      pennylane: { ...defaultConnections.pennylane, ...parsed.pennylane },
      sendgrid: { ...defaultConnections.sendgrid, ...parsed.sendgrid },
      hubspot: { ...defaultConnections.hubspot, ...parsed.hubspot },
      pipedrive: { ...defaultConnections.pipedrive, ...parsed.pipedrive },
      pappers: { ...defaultConnections.pappers, ...parsed.pappers },
      impotsgouv: { ...defaultConnections.impotsgouv, ...parsed.impotsgouv },
    };
  } catch {
    return { ...defaultConnections };
  }
}

export function saveServiceConnections(connections: ServiceConnections): void {
  localStorage.setItem(SERVICES_KEY, JSON.stringify(connections));
}

export function updateService(service: keyof ServiceConnections, data: Partial<ServiceConnection>): void {
  const connections = getServiceConnections();
  connections[service] = { ...connections[service], ...data };
  saveServiceConnections(connections);
}

export function areServicesConfigured(): boolean {
  const connections = getServiceConnections();
  return connections.microsoft.connected;
}

export function getCabinetInfo(): CabinetInfo {
  try {
    const data = localStorage.getItem(CABINET_KEY);
    if (!data) return { ...defaultCabinetInfo };
    return { ...defaultCabinetInfo, ...JSON.parse(data) };
  } catch {
    return { ...defaultCabinetInfo };
  }
}

export function saveCabinetInfo(info: CabinetInfo): void {
  localStorage.setItem(CABINET_KEY, JSON.stringify(info));
}

/** Retourne la configuration email (Microsoft, Google, SendGrid ou démo) */
export function getEmailConfig(): {
  provider: 'microsoft' | 'google' | 'sendgrid' | 'demo';
  apiKey: string | null;
  appPassword: string | null;
  fromEmail: string;
  fromName: string;
  isDemo: boolean;
} {
  const connections = getServiceConnections();
  const cabinet = getCabinetInfo();

  // Priority 1: Microsoft Outlook / Exchange (SMTP app password)
  const ms = connections.microsoft;
  if (ms.connected && ms.email && ms.appPassword) {
    return {
      provider: 'microsoft',
      apiKey: null,
      appPassword: ms.appPassword,
      fromEmail: ms.email,
      fromName: ms.displayName ?? cabinet.nom ?? 'Cabinet Expert-Comptable',
      isDemo: false,
    };
  }

  // Priority 2: Google Gmail (SMTP app password)
  const google = connections.google;
  if (google.connected && google.email && google.appPassword) {
    return {
      provider: 'google',
      apiKey: null,
      appPassword: google.appPassword,
      fromEmail: google.email,
      fromName: google.displayName ?? cabinet.nom ?? 'Cabinet Expert-Comptable',
      isDemo: false,
    };
  }

  // Priority 3: SendGrid API key (from connections)
  const sg = connections.sendgrid;
  if (sg.connected && sg.apiKey) {
    return {
      provider: 'sendgrid',
      apiKey: sg.apiKey,
      appPassword: null,
      fromEmail: sg.fromEmail ?? cabinet.expertEmail ?? 'onboarding@cabinet.fr',
      fromName: sg.fromName ?? cabinet.nom ?? 'Cabinet Expert-Comptable',
      isDemo: false,
    };
  }

  // Priority 4: SendGrid from environment variables
  const envKey = import.meta.env.VITE_SENDGRID_API_KEY;
  if (envKey) {
    return {
      provider: 'sendgrid',
      apiKey: envKey,
      appPassword: null,
      fromEmail: import.meta.env.VITE_FROM_EMAIL ?? cabinet.expertEmail ?? 'onboarding@cabinet.fr',
      fromName: import.meta.env.VITE_FROM_NAME ?? cabinet.nom ?? 'Cabinet Expert-Comptable',
      isDemo: false,
    };
  }

  return {
    provider: 'demo',
    apiKey: null,
    appPassword: null,
    fromEmail: 'onboarding@cabinet.fr',
    fromName: cabinet.nom ?? 'CabinetFlow',
    isDemo: true,
  };
}

// ─── Supabase helpers (user_integrations table) ───────────────────────────────

/**
 * Load all service integrations for a user from the `user_integrations` table.
 * Decrypts encrypted_credentials using the user's AES-256-GCM key.
 * Falls back to defaultConnections on error.
 */
export async function loadIntegrationsFromSupabase(userId: string): Promise<ServiceConnections> {
  try {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('service_name, is_connected, encrypted_credentials')
      .eq('user_id', userId);

    if (error) {
      console.warn('[servicesStorage] loadIntegrations error:', error.message);
      return { ...defaultConnections };
    }

    if (!data || data.length === 0) return { ...defaultConnections };

    const result: ServiceConnections = { ...defaultConnections };

    await Promise.all(
      data.map(async (row) => {
        const key = row.service_name as keyof ServiceConnections;
        if (!(key in result)) return;

        let credentials: Partial<ServiceConnection> = {};
        if (row.encrypted_credentials) {
          try {
            const decrypted = await decryptApiKey(row.encrypted_credentials, userId);
            if (decrypted) credentials = JSON.parse(decrypted) as Partial<ServiceConnection>;
          } catch {
            // Ignore decryption errors — treat as empty credentials
          }
        }

        result[key] = {
          ...defaultConnections[key],
          ...credentials,
          connected: row.is_connected ?? false,
        };
      }),
    );

    return result;
  } catch (err) {
    console.warn('[servicesStorage] loadIntegrations exception:', err);
    return { ...defaultConnections };
  }
}

/**
 * Save (upsert) a single service integration to `user_integrations`.
 * Encrypts the ServiceConnection data using the user's AES-256-GCM key before storing.
 */
export async function saveIntegrationToSupabase(
  service: keyof ServiceConnections,
  data: ServiceConnection,
  userId: string,
): Promise<void> {
  try {
    // Encrypt the full connection data (contains apiKey, appPassword, etc.)
    const plaintext = JSON.stringify(data);
    const encrypted = await encryptApiKey(plaintext, userId);

    const { error } = await supabase
      .from('user_integrations')
      .upsert(
        {
          user_id: userId,
          service_name: service,
          is_connected: data.connected,
          encrypted_credentials: encrypted,
        },
        { onConflict: 'user_id,service_name' },
      );

    if (error) {
      console.warn('[servicesStorage] saveIntegration error:', error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    console.warn('[servicesStorage] saveIntegration exception:', err);
    throw err;
  }
}