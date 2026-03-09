import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type KvRequestBody = {
  op?: 'get' | 'set';
  key?: string;
  value?: unknown;
  userId?: string;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function resolveSupabaseUrl(): string {
  return (
    readEnv('SUPABASE_URL') ||
    readEnv('VITE_SUPABASE_URL') ||
    readEnv('NEXT_PUBLIC_SUPABASE_URL')
  );
}

function resolveSupabaseAnonKey(): string {
  return (
    readEnv('SUPABASE_ANON_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );
}

function getBearerToken(req: VercelRequest): string {
  const raw = req.headers.authorization ?? '';
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

function getMissingServerEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseUrl()) {
    missing.push('SUPABASE_URL (or VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL)');
  }
  if (!resolveSupabaseAnonKey()) {
    missing.push('SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }
  if (!readEnv('SUPABASE_SERVICE_ROLE_KEY')) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  return missing;
}

const startupMissingEnv = getMissingServerEnv();
if (startupMissingEnv.length > 0) {
  console.warn(
    `[supabase-kv] Missing server env vars at startup: ${startupMissingEnv.join(', ')}`,
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseAnonKey = resolveSupabaseAnonKey();
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    const missingNow = getMissingServerEnv();
    return res.status(500).json({
      error: `Missing server env vars: ${missingNow.join(', ') || 'unknown'}.`,
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Bearer token.' });
  }

  let body: KvRequestBody;
  try {
    body = (req.body ?? {}) as KvRequestBody;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  if (!body.op || !body.key || !body.userId) {
    return res.status(400).json({ error: 'Missing required fields: op, key, userId.' });
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired access token.' });
  }

  if (userData.user.id !== body.userId) {
    return res.status(403).json({ error: 'Token user does not match requested userId.' });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    if (body.op === 'get') {
      const { data, error } = await serviceClient
        .from('kv_store_f54b77bb')
        .select('value')
        .eq('key', body.key)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const row = data as { value: unknown } | null;
      return res.status(200).json({ value: row?.value ?? null });
    }

    if (body.op === 'set') {
      const { error } = await serviceClient
        .from('kv_store_f54b77bb')
        .upsert({ key: body.key, value: body.value } as unknown as never, { onConflict: 'key' });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'op must be get or set.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
