/**
 * Supabase Edge Function — ms-todo-webhook
 *
 * Point de terminaison pour les Microsoft Graph Subscriptions (webhooks).
 * Reçoit les notifications de changement sur les tâches Microsoft To Do
 * et met à jour la table `tasks` de Supabase en conséquence.
 *
 * Flux :
 *   1. Validation du challenge (handshake initial de Microsoft Graph)
 *   2. Pour chaque notification reçue, mise à jour du statut de la tâche
 *      dans Supabase en se basant sur `microsoft_task_id`
 *
 * Variables d'environnement requises (Supabase Dashboard → Edge Functions → Secrets) :
 *   - SUPABASE_URL        : URL du projet Supabase
 *   - SUPABASE_SERVICE_ROLE_KEY : Clé service role (accès admin sans RLS)
 *   - MS_WEBHOOK_SECRET   : Secret de validation des notifications Microsoft (optionnel)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Notification envoyée par Microsoft Graph */
interface GraphNotification {
  subscriptionId: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;         // ex: "me/todo/lists/{listId}/tasks/{taskId}"
  resourceData?: {
    id?: string;            // microsoft_task_id
    '@odata.type'?: string;
    '@odata.id'?: string;
    '@odata.etag'?: string;
    title?: string;
    status?: string;
    importance?: string;
    dueDateTime?: { dateTime: string; timeZone: string } | null;
    body?: { content: string; contentType: string };
  };
  subscriptionExpirationDateTime?: string;
  tenantId?: string;
  clientState?: string;
}

/** Corps de la requête POST envoyée par Microsoft */
interface GraphNotificationPayload {
  value: GraphNotification[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** Convertit le statut Microsoft To Do en statut local de l'application */
function fromMsStatus(
  msStatus?: string,
): 'todo' | 'in_progress' | 'review' | 'done' {
  switch (msStatus) {
    case 'completed':         return 'done';
    case 'inProgress':        return 'in_progress';
    case 'waitingOnOthers':   return 'review';
    case 'notStarted':
    default:                  return 'todo';
  }
}

/** Convertit l'importance Microsoft To Do en priorité locale */
function fromMsImportance(importance?: string): 'low' | 'medium' | 'high' {
  switch (importance) {
    case 'high': return 'high';
    case 'low':  return 'low';
    default:     return 'medium';
  }
}

/** Extrait le microsoft_task_id depuis l'URL de la ressource ou les resourceData */
function extractTaskId(notification: GraphNotification): string | null {
  // Priorité : resourceData.id (retourné par Graph dans les notifications récentes)
  if (notification.resourceData?.id) return notification.resourceData.id;

  // Fallback : parsing de l'URL de la ressource
  // Format : "me/todo/lists/{listId}/tasks/{taskId}"
  const match = notification.resource?.match(/tasks\/([^/]+)$/);
  return match ? match[1] : null;
}

/** Extrait le microsoft_list_id depuis l'URL de la ressource */
function extractListId(notification: GraphNotification): string | null {
  const match = notification.resource?.match(/lists\/([^/]+)\/tasks/);
  return match ? match[1] : null;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Gestion CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── 1. Validation du challenge (handshake Microsoft Graph) ─────────────────
  // Microsoft envoie une requête POST avec ?validationToken=... pour valider
  // l'endpoint avant d'y envoyer des notifications réelles.
  const url = new URL(req.url);
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken) {
    // Réponse obligatoire : renvoyer le token en clair avec Content-Type text/plain
    return new Response(validationToken, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        ...CORS_HEADERS,
      },
    });
  }

  // ── 2. Traitement des notifications ───────────────────────────────────────
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée' }, 405);
  }

  let payload: GraphNotificationPayload;
  try {
    payload = await req.json() as GraphNotificationPayload;
  } catch {
    return json({ error: 'Corps de requête JSON invalide' }, 400);
  }

  if (!Array.isArray(payload?.value)) {
    return json({ error: 'Format de payload invalide' }, 400);
  }

  // Initialisation du client Supabase avec la service role key (contourne le RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── 3. Traitement de chaque notification ──────────────────────────────────
  const errors: string[] = [];

  for (const notification of payload.value) {
    try {
      const msTaskId = extractTaskId(notification);
      if (!msTaskId) {
        console.warn('[ms-todo-webhook] microsoft_task_id introuvable dans la notification', notification);
        continue;
      }

      if (notification.changeType === 'deleted') {
        // Suppression : on efface la tâche locale correspondante
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('microsoft_task_id', msTaskId);

        if (error) {
          console.error('[ms-todo-webhook] Erreur suppression tâche:', error.message);
          errors.push(error.message);
        }
      } else {
        // Création ou mise à jour : on met à jour les champs locaux
        const resourceData = notification.resourceData ?? {};
        const msListId = extractListId(notification);

        const fields: Record<string, unknown> = {};

        if (resourceData.title !== undefined) {
          fields.title = resourceData.title;
        }
        if (resourceData.status !== undefined) {
          fields.status = fromMsStatus(resourceData.status);
        }
        if (resourceData.importance !== undefined) {
          fields.priority = fromMsImportance(resourceData.importance);
        }
        if (resourceData.dueDateTime !== undefined) {
          fields.due_date = resourceData.dueDateTime?.dateTime ?? null;
        }
        if (resourceData.body?.content !== undefined) {
          fields.description = resourceData.body.content;
        }
        // Assure que les identifiants Microsoft sont enregistrés
        fields.microsoft_task_id = msTaskId;
        if (msListId) fields.microsoft_list_id = msListId;

        // Tente d'abord une mise à jour de la tâche existante
        const { data: updatedRows, error: updateError } = await supabase
          .from('tasks')
          .update(fields)
          .eq('microsoft_task_id', msTaskId)
          .select('id');

        if (updateError) {
          console.error('[ms-todo-webhook] Erreur mise à jour tâche:', updateError.message);
          errors.push(updateError.message);
        } else if ((updatedRows ?? []).length === 0) {
          // Aucune tâche locale correspondante — création d'un nouvel enregistrement
          // (tâche créée directement dans Microsoft To Do)
          const title = (resourceData.title as string | undefined) ?? '(Sans titre)';
          const { error: insertError } = await supabase
            .from('tasks')
            .insert({
              title,
              status:              fromMsStatus(resourceData.status),
              priority:            fromMsImportance(resourceData.importance),
              due_date:            resourceData.dueDateTime?.dateTime ?? null,
              description:         resourceData.body?.content ?? null,
              microsoft_task_id:   msTaskId,
              microsoft_list_id:   msListId ?? null,
            });

          if (insertError) {
            console.error('[ms-todo-webhook] Erreur création tâche:', insertError.message);
            errors.push(insertError.message);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('[ms-todo-webhook] Exception lors du traitement:', message);
      errors.push(message);
    }
  }

  // Microsoft Graph attend une réponse 202 Accepted pour les notifications
  return new Response(
    errors.length > 0 ? JSON.stringify({ errors }) : null,
    {
      status: 202,
      headers: CORS_HEADERS,
    },
  );
});
