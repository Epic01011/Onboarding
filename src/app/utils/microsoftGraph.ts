/**
 * Microsoft Graph API utility
 * Token = provider_token depuis la session Supabase (Azure OAuth)
 * Aucun SDK supplémentaire requis — pure fetch.
 *
 * Prérequis :
 *   1. Supabase → Auth → Providers → Azure : activer + Client ID + Secret
 *   2. Azure App Registration → API permissions :
 *      - User.Read, Mail.Send, Mail.ReadWrite
 *      - Sites.ReadWrite.All, Files.ReadWrite.All
 *   3. Azure → Authentication → Redirect URIs :
 *      https://[ref].supabase.co/auth/v1/callback
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

// ─── Types ─────────────────────────────────────────────────────────────────────────────

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  officeLocation?: string;
}

export interface SharePointSite {
  id: string;
  displayName: string;
  webUrl: string;
  name: string;
}

export interface SharePointItem {
  id: string;
  name: string;
  webUrl: string;
  folder?: object;
  file?: { mimeType?: string };
  size?: number;
  lastModifiedDateTime?: string;
  createdDateTime?: string;
  createdBy?: { user?: { displayName?: string } };
}

export interface SharePointSharingLink {
  id: string;
  link: {
    type: 'view' | 'edit';
    scope: 'anonymous' | 'organization' | 'users';
    webUrl: string;
    webHtml?: string;
    preventsDownload?: boolean;
  };
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  saveToSentItems?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function graphFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let errMsg = `Graph API error ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body?.error?.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }
  return res.json();
}

// ─── Profil utilisateur ────────────────────────────────────────────────────────────────────

export async function getGraphUser(token: string): Promise<GraphUser> {
  return graphFetch<GraphUser>(`${GRAPH}/me`, token);
}

// ─── Envoi d'email via Outlook (adresse Microsoft 365) ───────────────────────────────

export async function sendEmailViaGraph(
  token: string,
  options: SendEmailOptions,
): Promise<void> {
  const toArr = Array.isArray(options.to) ? options.to : [options.to];
  const toRecipients = toArr.map(a => ({ emailAddress: { address: a } }));

  const ccRecipients = options.cc
    ? (Array.isArray(options.cc) ? options.cc : [options.cc])
        .map(a => ({ emailAddress: { address: a } }))
    : undefined;

  const bccRecipients = options.bcc
    ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc])
        .map(a => ({ emailAddress: { address: a } }))
    : undefined;

  const replyTo = options.replyTo
    ? [{ emailAddress: { address: options.replyTo } }]
    : undefined;

  const payload: Record<string, unknown> = {
    message: {
      subject: options.subject,
      body: { contentType: 'HTML', content: options.htmlBody },
      toRecipients,
      ...(ccRecipients ? { ccRecipients } : {}),
      ...(bccRecipients ? { bccRecipients } : {}),
      ...(replyTo ? { replyTo } : {}),
    },
    saveToSentItems: options.saveToSentItems ?? true,
  };

  await graphFetch<void>(`${GRAPH}/me/sendMail`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── SharePoint — Sites ─────────────────────────────────────────────────────────────────────

export async function getSharePointSites(token: string): Promise<SharePointSite[]> {
  const data = await graphFetch<{ value: SharePointSite[] }>(
    `${GRAPH}/sites?search=*`,
    token,
  );
  return data.value ?? [];
}

export async function getSharePointSiteByUrl(
  token: string,
  siteHostname: string,
  sitePath: string,
): Promise<SharePointSite> {
  return graphFetch<SharePointSite>(
    `${GRAPH}/sites/${siteHostname}:/${sitePath}`,
    token,
  );
}

// ─── SharePoint — Drive (Documents) ────────────────────────────────────────────────────────

export async function getSharePointDrive(token: string, siteId: string) {
  return graphFetch<{ id: string; webUrl: string }>(
    `${GRAPH}/sites/${siteId}/drive`,
    token,
  );
}

/**
 * Récupère les enfants (fichiers + dossiers) d'un chemin donné dans le drive.
 * folderPath = chemin relatif à la racine, ex: "Clients CabinetFlow/123456789 - ACME/06 - Documents client"
 */
export async function listSharePointFolder(
  token: string,
  siteId: string,
  folderPath: string,
): Promise<SharePointItem[]> {
  const path = folderPath
    ? `root:/${encodeURIComponent(folderPath)}:/children`
    : 'root/children';
  const data = await graphFetch<{ value: SharePointItem[] }>(
    `${GRAPH}/sites/${siteId}/drive/${path}?$select=id,name,webUrl,folder,file,size,lastModifiedDateTime,createdDateTime,createdBy`,
    token,
  );
  return data.value ?? [];
}

/**
 * Récupère les métadonnées d'un item (fichier ou dossier) par son chemin.
 * path = chemin relatif à la racine, ex: "Clients CabinetFlow/123456789 - ACME"
 */
export async function getSharePointItemByPath(
  token: string,
  siteId: string,
  path: string,
): Promise<SharePointItem> {
  return graphFetch<SharePointItem>(
    `${GRAPH}/sites/${siteId}/drive/root:/${encodeURIComponent(path)}`,
    token,
  );
}

export async function createSharePointFolder(
  token: string,
  siteId: string,
  parentPath: string,
  folderName: string,
): Promise<{ id: string; webUrl: string }> {
  const endpoint = parentPath
    ? `${GRAPH}/sites/${siteId}/drive/root:/${encodeURIComponent(parentPath)}:/children`
    : `${GRAPH}/sites/${siteId}/drive/root/children`;

  const data = await graphFetch<{ id: string; webUrl: string }>(endpoint, token, {
    method: 'POST',
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
  });
  return { id: data.id, webUrl: data.webUrl };
}

/**
 * Crée un lien de partage Microsoft 365 pour un item SharePoint.
 *
 * type  : 'view' (lecture) | 'edit' (dépôt + modification)
 * scope : 'anonymous' (lien public, sans connexion) | 'organization' (utilisateurs du tenant)
 *
 * Pour envoyer au client un lien de dépôt de documents :
 *   createSharePointSharingLink(token, siteId, folderId, 'edit', 'anonymous')
 */
export async function createSharePointSharingLink(
  token: string,
  siteId: string,
  itemId: string,
  type: 'view' | 'edit' = 'edit',
  scope: 'anonymous' | 'organization' = 'anonymous',
  expirationDateTime?: string,
): Promise<SharePointSharingLink> {
  return graphFetch<SharePointSharingLink>(
    `${GRAPH}/sites/${siteId}/drive/items/${itemId}/createLink`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        type,
        scope,
        ...(expirationDateTime ? { expirationDateTime } : {}),
      }),
    },
  );
}

export async function uploadFileToSharePoint(
  token: string,
  siteId: string,
  folderPath: string,
  file: File,
): Promise<{ id: string; webUrl: string }> {
  const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;
  const res = await fetch(
    `${GRAPH}/sites/${siteId}/drive/root:/${encodeURIComponent(filePath)}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erreur upload SharePoint: ${res.status}`);
  }
  const data = await res.json();
  return { id: data.id, webUrl: data.webUrl };
}

export async function deleteSharePointItem(
  token: string,
  siteId: string,
  itemId: string,
): Promise<void> {
  await graphFetch<void>(`${GRAPH}/sites/${siteId}/drive/items/${itemId}`, token, {
    method: 'DELETE',
  });
}

// ─── Inbox IA — Récupération et filtrage des emails clients ───────────────────

export interface GraphMessage {
  id: string;
  subject: string | null;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  isRead: boolean;
}

export interface ClientEmail {
  /** Microsoft Graph message ID (needed for reply/send) */
  messageId: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  /** Display name from the clients table */
  clientName: string;
  /** UUID from the clients table */
  clientId: string;
  receivedAt: string;
}

/**
 * Récupère les 20 derniers emails non lus et retourne uniquement ceux
 * dont l'expéditeur est un client connu dans la table `clients` Supabase.
 *
 * @param token   - Microsoft Graph provider_token (Supabase Azure OAuth)
 * @param supabaseClient - Instance du client Supabase (anon)
 */
export async function fetchClientEmails(
  token: string,
  supabaseClient: SupabaseClient,
): Promise<ClientEmail[]> {
  // 1. Fetch the 20 latest unread emails
  const data = await graphFetch<{ value: GraphMessage[] }>(
    `${GRAPH}/me/messages?$filter=isRead eq false&$top=20&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead&$orderby=receivedDateTime desc`,
    token,
  );

  const messages = data.value ?? [];
  if (messages.length === 0) return [];

  // 2. Extract unique sender addresses
  const senderEmails = [...new Set(messages.map(m => m.from.emailAddress.address.toLowerCase()))];

  // 3. Check which senders exist in the clients table
  const { data: matchedClients, error } = await supabaseClient
    .from('clients')
    .select('id,client_name,client_email')
    .in('client_email', senderEmails);

  if (error) {
    console.warn('[fetchClientEmails] Supabase query error:', error);
    return [];
  }

  if (!matchedClients || matchedClients.length === 0) return [];

  // Build a lookup map: email → client record
  const clientMap = new Map(
    (matchedClients as Array<{ id: string; client_name: string; client_email: string }>)
      .map(c => [c.client_email.toLowerCase(), c]),
  );

  // 4. Filter messages to only those from known clients
  const results: ClientEmail[] = [];
  for (const msg of messages) {
    const senderAddr = msg.from.emailAddress.address.toLowerCase();
    const client = clientMap.get(senderAddr);
    if (!client) continue;
    results.push({
      messageId: msg.id,
      subject: msg.subject ?? '(Sans objet)',
      body: msg.body?.content ?? msg.bodyPreview ?? '',
      fromName: msg.from.emailAddress.name || client.client_name,
      fromEmail: senderAddr,
      clientName: client.client_name,
      clientId: client.id,
      receivedAt: msg.receivedDateTime,
    });
  }

  return results;
}


export async function shareSharePointItem(
  token: string,
  siteId: string,
  itemId: string,
  emails: string[],
  role: 'read' | 'write' = 'write',
): Promise<void> {
  await graphFetch<void>(
    `${GRAPH}/sites/${siteId}/drive/items/${itemId}/invite`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        requireSignIn: true,
        sendInvitation: true,
        roles: [role],
        recipients: emails.map(e => ({ email: e })),
      }),
    },
  );
}
