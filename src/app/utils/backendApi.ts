/**
 * backendApi.ts
 *
 * Acces a kv_store_f54b77bb via endpoint serveur securise.
 * Les access_token transmis sont validés structurellement (expiration)
 * avant chaque opération DB grâce à jwtVerify.ts (ES256 / JWK).
 *
 * Aucune service role key n'est exposee dans le bundle client.
 */

import { supabase as anonClient } from './supabaseClient';
import { isJwtStructurallyValid } from './jwtVerify';

// ─── localStorage helpers (cache / fallback) ──────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}
function lsKey(prefix: string, userId: string) {
  return `cab_${prefix}_${userId}`;
}

// ─── Secure API helpers ────────────────────────────────────────────────────────
type KvApiGetResponse = { value: unknown };
type KvApiSetResponse = { success: boolean };

async function kvApiRequest<T>(token: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch('/api/supabase-kv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      console.warn('[backendApi] kvApiRequest error:', payload.error ?? response.statusText);
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    console.warn('[backendApi] kvApiRequest exception:', err);
    return null;
  }
}

async function kvGet(key: string, token: string, userId: string): Promise<unknown> {
  const payload = await kvApiRequest<KvApiGetResponse>(token, { op: 'get', key, userId });
  return payload?.value ?? null;
}

async function kvSet(key: string, value: unknown, token: string, userId: string): Promise<void> {
  const payload = await kvApiRequest<KvApiSetResponse>(token, { op: 'set', key, value, userId });
  if (!payload?.success) {
    throw new Error('kv set failed');
  }
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export async function getApiKeys(token: string, userId: string) {
  const localKey = lsKey('apikeys', userId);
  const dbKey = `apikeys:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] getApiKeys invalid token – fallback to localStorage');
    return { apiKeys: lsGet<Record<string, unknown>>(localKey, {}) };
  }

  try {
    const remote = await kvGet(dbKey, token, userId);
    if (remote && typeof remote === 'object') {
      lsSet(localKey, remote);
      return { apiKeys: remote as Record<string, unknown> };
    }
  } catch (err) {
    console.warn('[backendApi] getApiKeys DB error – fallback to localStorage:', err);
  }

  return { apiKeys: lsGet<Record<string, unknown>>(localKey, {}) };
}

export async function updateApiKey(
  service: string,
  body: unknown,
  token: string,
  userId: string,
) {
  const localKey = lsKey('apikeys', userId);
  const dbKey = `apikeys:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] updateApiKey invalid token – fallback to localStorage');
    return { apiKeys: lsGet<Record<string, unknown>>(localKey, {}) };
  }

  // Merge with latest known state
  let current: Record<string, unknown> = {};
  try {
    const remote = await kvGet(dbKey, token, userId);
    if (remote && typeof remote === 'object') current = remote as Record<string, unknown>;
  } catch {
    current = lsGet<Record<string, unknown>>(localKey, {});
  }

  const updated: Record<string, unknown> = {
    ...current,
    [service]: {
      ...(current[service] as object ?? {}),
      ...(body as object),
      connectedAt: new Date().toISOString(),
    },
  };

  // Write to both
  lsSet(localKey, updated);
  try { await kvSet(dbKey, updated, token, userId); } catch (err) {
    console.warn('[backendApi] updateApiKey DB write error (localStorage saved):', err);
  }

  return { apiKeys: updated };
}

// ─── Cabinet Info ─────────────────────────────────────────────────────────────
export async function getCabinetInfoBackend(token: string, userId: string) {
  const localKey = lsKey('cabinet', userId);
  const dbKey = `cabinet:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] getCabinetInfo invalid token – fallback to localStorage');
    return { cabinetInfo: lsGet<unknown>(localKey, null) };
  }

  try {
    const remote = await kvGet(dbKey, token, userId);
    if (remote) {
      lsSet(localKey, remote);
      return { cabinetInfo: remote };
    }
  } catch (err) {
    console.warn('[backendApi] getCabinetInfo DB error – fallback:', err);
  }

  return { cabinetInfo: lsGet<unknown>(localKey, null) };
}

export async function updateCabinetInfoBackend(
  body: unknown,
  token: string,
  userId: string,
) {
  const localKey = lsKey('cabinet', userId);
  const dbKey = `cabinet:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] updateCabinetInfo invalid token – fallback to localStorage');
    return { cabinetInfo: lsGet<unknown>(localKey, null) };
  }

  lsSet(localKey, body);
  try { await kvSet(dbKey, body, token, userId); } catch (err) {
    console.warn('[backendApi] updateCabinetInfo DB write error (localStorage saved):', err);
  }

  return { cabinetInfo: body };
}

// ─── Templates ────────────────────────────────────────────────────────────────
export async function getTemplatesBackend(token: string, userId: string) {
  const localKey = lsKey('templates', userId);
  const dbKey = `templates:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] getTemplates invalid token – fallback to localStorage');
    return { templates: lsGet<unknown[]>(localKey, []) };
  }

  try {
    const remote = await kvGet(dbKey, token, userId);
    if (Array.isArray(remote) && remote.length > 0) {
      lsSet(localKey, remote);
      return { templates: remote as unknown[] };
    }
  } catch (err) {
    console.warn('[backendApi] getTemplates DB error – fallback:', err);
  }

  return { templates: lsGet<unknown[]>(localKey, []) };
}

export async function saveTemplateBackend(
  template: unknown,
  token: string,
  userId: string,
) {
  const localKey = lsKey('templates', userId);
  const dbKey = `templates:${userId}`;
  const tmpl = template as { id: string };
  const now = new Date().toISOString();

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] saveTemplate invalid token – fallback to localStorage');
    return { templates: lsGet<unknown[]>(localKey, []) };
  }

  let current: unknown[] = [];
  try {
    const remote = await kvGet(dbKey, token, userId);
    current = Array.isArray(remote) ? remote : lsGet<unknown[]>(localKey, []);
  } catch {
    current = lsGet<unknown[]>(localKey, []);
  }

  const idx = current.findIndex(t => (t as { id: string }).id === tmpl.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = { ...tmpl, updatedAt: now };
  } else {
    updated.push({ ...tmpl, createdAt: now, updatedAt: now });
  }

  lsSet(localKey, updated);
  try { await kvSet(dbKey, updated, token, userId); } catch (err) {
    console.warn('[backendApi] saveTemplate DB write error (localStorage saved):', err);
  }

  return { templates: updated };
}

export async function deleteTemplateBackend(
  id: string,
  token: string,
  userId: string,
) {
  const localKey = lsKey('templates', userId);
  const dbKey = `templates:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] deleteTemplate invalid token – fallback to localStorage');
    return { templates: lsGet<unknown[]>(localKey, []) };
  }

  let current: unknown[] = [];
  try {
    const remote = await kvGet(dbKey, token, userId);
    current = Array.isArray(remote) ? remote : lsGet<unknown[]>(localKey, []);
  } catch {
    current = lsGet<unknown[]>(localKey, []);
  }

  const filtered = current.filter(t => (t as { id: string }).id !== id);

  lsSet(localKey, filtered);
  try { await kvSet(dbKey, filtered, token, userId); } catch (err) {
    console.warn('[backendApi] deleteTemplate DB write error (localStorage saved):', err);
  }

  return { templates: filtered };
}

// ─── PDF Upload (via Supabase Storage) ───────────────────────────────────────
export async function uploadPdfTemplate(
  file: File,
  type: 'confraternal' | 'mission',
  _token: string,
  userId: string,
): Promise<{ success: boolean; url?: string; message: string }> {
  const db = anonClient;

  const path = `templates/${userId}/${type}/${Date.now()}_${file.name}`;

  const { data, error } = await db.storage
    .from('cabinet-templates')
    .upload(path, file, { upsert: true, contentType: 'application/pdf' });

  if (error) {
    console.warn('[backendApi] PDF upload error:', error.message);
    return { success: false, message: `Erreur upload : ${error.message}` };
  }

  const { data: urlData } = db.storage.from('cabinet-templates').getPublicUrl(data.path);
  return { success: true, url: urlData.publicUrl, message: 'PDF uploadé avec succès.' };
}

// ─── Dossiers ─────────────────────────────────────────────────────────────────
export async function getDossiersBackend(token: string, userId: string) {
  const localKey = lsKey('dossiers', userId);
  const dbKey = `dossiers:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] getDossiers invalid token – fallback to localStorage');
    return { dossiers: lsGet<unknown[]>(localKey, []) };
  }

  try {
    const remote = await kvGet(dbKey);
    if (Array.isArray(remote) && remote.length > 0) {
      lsSet(localKey, remote);
      return { dossiers: remote as unknown[] };
    }
  } catch (err) {
    console.warn('[backendApi] getDossiers DB error – fallback:', err);
  }

  return { dossiers: lsGet<unknown[]>(localKey, []) };
}

export async function saveDossierBackend(
  dossier: unknown,
  token: string,
  userId: string,
) {
  const localKey = lsKey('dossiers', userId);
  const dbKey = `dossiers:${userId}`;
  const d = dossier as { id: string };

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] saveDossier invalid token – fallback to localStorage');
    return { dossiers: lsGet<unknown[]>(localKey, []) };
  }

  let current: unknown[] = [];
  try {
    const remote = await kvGet(dbKey, token, userId);
    current = Array.isArray(remote) ? remote : lsGet<unknown[]>(localKey, []);
  } catch {
    current = lsGet<unknown[]>(localKey, []);
  }

  const idx = current.findIndex(item => (item as { id: string }).id === d.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = dossier;
  } else {
    updated.push(dossier);
  }

  lsSet(localKey, updated);
  try { await kvSet(dbKey, updated, token, userId); } catch (err) {
    console.warn('[backendApi] saveDossier DB write error (localStorage saved):', err);
  }

  return { dossiers: updated };
}

export async function deleteDossierBackend(
  id: string,
  token: string,
  userId: string,
) {
  const localKey = lsKey('dossiers', userId);
  const dbKey = `dossiers:${userId}`;

  if (!isJwtStructurallyValid(token)) {
    console.warn('[backendApi] deleteDossier invalid token – fallback to localStorage');
    return { dossiers: lsGet<unknown[]>(localKey, []) };
  }

  let current: unknown[] = [];
  try {
    const remote = await kvGet(dbKey, token, userId);
    current = Array.isArray(remote) ? remote : lsGet<unknown[]>(localKey, []);
  } catch {
    current = lsGet<unknown[]>(localKey, []);
  }

  const filtered = current.filter(item => (item as { id: string }).id !== id);

  lsSet(localKey, filtered);
  try { await kvSet(dbKey, filtered, token, userId); } catch (err) {
    console.warn('[backendApi] deleteDossier DB write error (localStorage saved):', err);
  }

  return { dossiers: filtered };
}

// ─── Documents (modèles LDM depuis table Supabase `documents`) ───────────────

export interface DocumentTemplate {
  id: string;
  type: 'confraternal' | 'mission' | 'mandat_creation';
  name: string;
  contenu: string;
  variables?: Record<string, string>;
  is_default: boolean;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Récupère les modèles depuis la table `documents` de Supabase.
 * Retourne un tableau vide en cas d'erreur ou si la table n'existe pas encore.
 * Lance une erreur avec `isAuthError: true` si la session a expiré (PGRST301 / 401).
 */
export async function getDocumentsBackend(
  type?: 'confraternal' | 'mission' | 'mandat_creation',
): Promise<DocumentTemplate[]> {
  const client = anonClient;

  try {
    let query = client.from('documents').select('*').order('created_at', { ascending: true });
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) {
      const status = (error as { status?: number }).status;
      const msg = error.message?.toLowerCase() ?? '';
      if (
        error.code === 'PGRST301' ||
        error.code === 'PGRST302' ||
        status === 401 ||
        msg.includes('jwt') ||
        msg.includes('expired')
      ) {
        throw Object.assign(new Error(error.message), { isAuthError: true });
      }
      console.warn('[backendApi] getDocuments error:', error.message);
      return [];
    }
    return (data ?? []) as DocumentTemplate[];
  } catch (err) {
    if (err instanceof Error && (err as { isAuthError?: boolean }).isAuthError) throw err;
    console.warn('[backendApi] getDocuments exception:', err);
    return [];
  }
}

/**
 * Sauvegarde ou met à jour un modèle dans la table `documents`.
 */
export async function saveDocumentBackend(
  doc: Omit<DocumentTemplate, 'created_at' | 'updated_at'>,
): Promise<DocumentTemplate | null> {
  const client = anonClient;

  try {
    const { data, error } = await client
      .from('documents')
      .upsert({ ...doc, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .maybeSingle();
    if (error) {
      console.warn('[backendApi] saveDocument error:', error.message);
      return null;
    }
    return data as DocumentTemplate | null;
  } catch (err) {
    console.warn('[backendApi] saveDocument exception:', err);
    return null;
  }
}

/**
 * Supprime un modèle dans la table `documents`.
 */
export async function deleteDocumentBackend(id: string): Promise<boolean> {
  const client = anonClient;

  try {
    const { error } = await client.from('documents').delete().eq('id', id);
    if (error) {
      console.warn('[backendApi] deleteDocument error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[backendApi] deleteDocument exception:', err);
    return false;
  }
}