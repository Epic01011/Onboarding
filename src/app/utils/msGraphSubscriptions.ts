/**
 * msGraphSubscriptions.ts — Gestion des Microsoft Graph Subscriptions (webhooks)
 *
 * Permet à l'application de souscrire aux notifications de changement des
 * tâches Microsoft To Do. Les événements sont renvoyés vers la Supabase Edge
 * Function `ms-todo-webhook` qui met à jour la table `tasks` en conséquence.
 *
 * Prérequis Azure App Registration :
 *   - Permission : Tasks.ReadWrite (délégué)
 *
 * Usage :
 *   const sub = await subscribeToMsTodoWebhook(token, listId, webhookUrl);
 *   // Plus tard, pour renouveler l'abonnement (expiré après max 4320 minutes) :
 *   await renewMsTodoSubscription(token, sub.id, webhookUrl);
 *   // Pour supprimer l'abonnement :
 *   await deleteMsTodoSubscription(token, sub.id);
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Abonnement Microsoft Graph retourné par l'API */
export interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function graphPost<T>(
  url: string,
  token: string,
  body: unknown,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(token),
    body: method !== 'DELETE' ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204 || res.status === 202) return undefined as T;
  if (!res.ok) {
    let errMsg = `Graph API error ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data?.error?.message ?? errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }
  return res.json();
}

// ─── Fonctions d'abonnement ───────────────────────────────────────────────────

/**
 * Souscrit aux notifications de changement des tâches d'une liste Microsoft To Do.
 *
 * @param token      - Token Microsoft Graph (provider_token de MicrosoftAuthContext)
 * @param listId     - Identifiant de la liste To Do à surveiller
 * @param webhookUrl - URL publique de la Supabase Edge Function ms-todo-webhook
 * @param clientState - Valeur secrète optionnelle renvoyée dans chaque notification
 *                      (permet de valider l'authenticité côté Edge Function)
 * @returns L'objet GraphSubscription créé par Microsoft
 */
export async function subscribeToMsTodoWebhook(
  token: string,
  listId: string,
  webhookUrl: string,
  clientState?: string,
): Promise<GraphSubscription> {
  // L'abonnement expire après 4320 minutes (3 jours) — maximum pour To Do
  const expirationDateTime = new Date(
    Date.now() + 4320 * 60 * 1000,
  ).toISOString();

  return graphPost<GraphSubscription>(
    `${GRAPH}/subscriptions`,
    token,
    {
      changeType:          'created,updated,deleted',
      notificationUrl:     webhookUrl,
      resource:            `me/todo/lists/${listId}/tasks`,
      expirationDateTime,
      clientState:         clientState ?? undefined,
    },
  );
}

/**
 * Renouvelle un abonnement existant avant son expiration.
 *
 * @param token          - Token Microsoft Graph
 * @param subscriptionId - ID de l'abonnement à renouveler
 * @param webhookUrl     - URL de notification (doit correspondre à l'abonnement existant)
 * @returns L'abonnement mis à jour
 */
export async function renewMsTodoSubscription(
  token: string,
  subscriptionId: string,
  webhookUrl: string,
): Promise<GraphSubscription> {
  const expirationDateTime = new Date(
    Date.now() + 4320 * 60 * 1000,
  ).toISOString();

  return graphPost<GraphSubscription>(
    `${GRAPH}/subscriptions/${subscriptionId}`,
    token,
    { expirationDateTime, notificationUrl: webhookUrl },
    'PATCH',
  );
}

/**
 * Supprime un abonnement Microsoft Graph.
 *
 * @param token          - Token Microsoft Graph
 * @param subscriptionId - ID de l'abonnement à supprimer
 */
export async function deleteMsTodoSubscription(
  token: string,
  subscriptionId: string,
): Promise<void> {
  await graphPost<void>(
    `${GRAPH}/subscriptions/${subscriptionId}`,
    token,
    undefined,
    'DELETE',
  );
}
