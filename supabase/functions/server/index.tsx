/**
 * Edge Function — server
 *
 * API REST légère déployée via Supabase Edge Functions.
 * Expose les opérations de la table kv_store_f54b77bb en utilisant la
 * service role key disponible côté serveur (variables d'environnement Supabase).
 *
 * Routes :
 *   GET    /server?key=<key>          — Lecture d'une valeur
 *   POST   /server  { key, value }    — Écriture / mise à jour
 *   DELETE /server?key=<key>          — Suppression
 *
 * Authentification :
 *   Header Authorization: Bearer <access_token>
 *   Le token JWT est vérifié via la clé publique Supabase.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function verifyToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    // Verify token via Supabase anon client (respects JWT secret validation)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await anonClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Health check (no auth required)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (!url.searchParams.has('key')) {
      return json({ status: 'ok', message: 'CabinetFlow KV API is running.' });
    }
  }

  // All other routes require authentication
  const userId = await verifyToken(req);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  try {
    if (req.method === 'GET') {
      if (!key) return json({ error: 'Missing key parameter' }, 400);
      const value = await kv.get(key);
      return json({ key, value });

    } else if (req.method === 'POST') {
      const body = await req.json() as { key?: string; value?: unknown };
      if (!body.key) return json({ error: 'Missing key in body' }, 400);
      await kv.set(body.key, body.value);
      return json({ success: true, key: body.key });

    } else if (req.method === 'DELETE') {
      if (!key) return json({ error: 'Missing key parameter' }, 400);
      await kv.del(key);
      return json({ success: true, key });

    } else {
      return json({ error: 'Method not allowed' }, 405);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[Edge Function] Error:', message);
    return json({ error: message }, 500);
  }
});

