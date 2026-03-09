/**
 * Shared Supabase JS client.
 * Utilise la Publishable Key (remplace l'Anon Legacy).
 * Les clés sont lues depuis les variables d'environnement Vite.
 *
 * Mode strict distant: aucune URL locale/fallback n'est autorisee.
 */
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ??
  '';

// Publishable Key (nouvelle clé Supabase — remplace l'Anon Legacy)
const rawSupabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

const isLocalSupabaseUrl =
  rawSupabaseUrl.includes('127.0.0.1') ||
  rawSupabaseUrl.includes('localhost') ||
  rawSupabaseUrl.includes(':54321');

if (!rawSupabaseUrl || !rawSupabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing required env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

if (isLocalSupabaseUrl) {
  throw new Error(
    '[Supabase] Local Supabase URL detected. This project is configured for remote Supabase only.'
  );
}

export const SUPABASE_URL = rawSupabaseUrl;
export const SUPABASE_ANON_KEY = rawSupabaseAnonKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ─── Connection health check ──────────────────────────────────────────────────

export interface SupabaseTableStatus {
  /** true = SELECT accessible, false = error or RLS block, null = not checked */
  clients: boolean | null;
  quotes: boolean | null;
  prospects: boolean | null;
  cabinet_settings: boolean | null;
  user_integrations: boolean | null;
}

export interface SupabaseConnectionReport {
  /** URL and anon key are non-empty */
  configured: boolean;
  /** A valid Supabase auth session (user) exists */
  authenticated: boolean;
  /** Per-table read accessibility */
  tables: SupabaseTableStatus;
  /** Set when a low-level network / JS error occurs */
  error?: string;
}

/**
 * Runs a lightweight health check against the live Supabase project.
 *
 * Checks performed (in order):
 *   1. Are the URL and anon key configured?
 *   2. Is there a valid authenticated session?
 *   3. Can we run a `SELECT id LIMIT 1` on each key table?
 *
 * All errors are caught — the function never throws.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionReport> {
  const report: SupabaseConnectionReport = {
    configured: false,
    authenticated: false,
    tables: {
      clients: null,
      quotes: null,
      prospects: null,
      cabinet_settings: null,
      user_integrations: null,
    },
  };

  // 1. Config check
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    report.error = 'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant.';
    return report;
  }
  report.configured = true;

  // 2. Auth check
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      report.error = `Auth error: ${authError.message}`;
      return report;
    }
    report.authenticated = !!user;
  } catch (err) {
    report.error = err instanceof Error ? err.message : 'Erreur auth inconnue';
    return report;
  }

  if (!report.authenticated) {
    // Cannot test table access without a session — stop here.
    return report;
  }

  // 3. Per-table read probes
  const tables = ['clients', 'quotes', 'prospects', 'cabinet_settings', 'user_integrations'] as const;
  await Promise.all(
    tables.map(async (table) => {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);
        report.tables[table] = !error;
      } catch {
        report.tables[table] = false;
      }
    })
  );

  return report;
}
