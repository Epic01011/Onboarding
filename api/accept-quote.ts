import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function — GET /api/accept-quote?token=<uuid>
 *
 * Lien magique d'acceptation de devis.
 * Quand le client clique sur ce lien (reçu par email) :
 *  1. Le devis passe au statut "ACCEPTED".
 *  2. Le prospect associé passe au statut "devis-valide".
 *  3. Une page HTML de confirmation est renvoyée au navigateur.
 *
 * Sécurité : le token est un UUID aléatoire stocké dans la colonne `accept_token`
 * de la table `quotes`. Il n'est jamais devinable et est invalidé après usage
 * (le statut passe à ACCEPTED, rendant le lien inutilisable pour une double
 * acceptation).
 */

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

function resolveSupabaseKey(): string {
  // Prefer service role key for server-side mutations
  return (
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_ANON_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );
}

function htmlPage(title: string, heading: string, body: string, isError = false): string {
  const color = isError ? '#dc2626' : '#16a34a';
  const icon = isError ? '✗' : '✓';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      padding: 1rem;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      padding: 3rem 2.5rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      background: ${isError ? '#fee2e2' : '#dcfce7'};
      color: ${color};
      margin-bottom: 1.5rem;
    }
    h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: .75rem; }
    p  { font-size: 1rem; color: #6b7280; line-height: 1.6; }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: .375rem .875rem;
      border-radius: 9999px;
      font-size: .875rem;
      font-weight: 600;
      background: ${isError ? '#fee2e2' : '#dcfce7'};
      color: ${color};
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    <span class="badge">${isError ? 'Erreur' : 'Devis accepté'}</span>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers (in case the endpoint is called via fetch)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(405).send(htmlPage(
      'Méthode non autorisée',
      'Méthode non autorisée',
      'Cette page doit être ouverte via le lien reçu dans votre email.',
      true,
    ));
  }

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!token) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage(
      'Lien invalide',
      'Lien d\'acceptation invalide',
      'Le lien que vous avez utilisé est incomplet. Veuillez vérifier l\'email reçu ou contacter votre cabinet comptable.',
      true,
    ));
  }

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    console.error('[accept-quote] Supabase env vars missing');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage(
      'Erreur serveur',
      'Erreur de configuration',
      'Le serveur n\'est pas configuré correctement. Veuillez contacter votre cabinet comptable.',
      true,
    ));
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Find the quote by accept_token
    const { data: quote, error: fetchError } = await supabase
      .from('quotes')
      .select('id, status, prospect_id')
      .eq('accept_token', token)
      .maybeSingle();

    if (fetchError) {
      console.error('[accept-quote] fetch error:', fetchError.message);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(htmlPage(
        'Erreur serveur',
        'Une erreur est survenue',
        'Impossible de vérifier votre devis pour le moment. Veuillez réessayer plus tard ou contacter votre cabinet.',
        true,
      ));
    }

    if (!quote) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(htmlPage(
        'Lien introuvable',
        'Lien d\'acceptation introuvable',
        'Ce lien ne correspond à aucun devis. Il est peut-être déjà expiré ou a déjà été utilisé.',
        true,
      ));
    }

    const quoteRow = quote as { id: string; status: string; prospect_id: string | null };

    // 2. If already accepted/validated, return a friendly message
    if (quoteRow.status === 'ACCEPTED' || quoteRow.status === 'VALIDATED') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlPage(
        'Devis déjà accepté',
        'Ce devis a déjà été accepté',
        'Votre accord a bien été enregistré. Votre cabinet comptable a été notifié et vous contactera prochainement pour la suite.',
      ));
    }

    // 3. Update quote status to ACCEPTED
    const { error: quoteUpdateError } = await supabase
      .from('quotes')
      .update({ status: 'ACCEPTED' })
      .eq('id', quoteRow.id);

    if (quoteUpdateError) {
      console.error('[accept-quote] quote update error:', quoteUpdateError.message);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(htmlPage(
        'Erreur serveur',
        'Impossible d\'enregistrer votre acceptation',
        'Une erreur est survenue lors de la mise à jour. Veuillez réessayer ou contacter votre cabinet.',
        true,
      ));
    }

    // 4. Update prospect status to "devis-valide" (if linked to a prospect)
    if (quoteRow.prospect_id) {
      const { error: prospectUpdateError } = await supabase
        .from('prospects')
        .update({ status: 'devis-valide', kanban_column: 'devis-valide', updated_at: new Date().toISOString() })
        .eq('id', quoteRow.prospect_id);

      if (prospectUpdateError) {
        // Non-blocking — log but don't fail the response
        console.warn('[accept-quote] prospect update error:', prospectUpdateError.message);
      }
    }

    // 5. Return success page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(
      'Devis accepté — Merci !',
      'Votre devis a été accepté avec succès !',
      'Votre accord a bien été enregistré. Votre cabinet comptable a été notifié et vous contactera prochainement pour finaliser votre contrat.',
    ));

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[accept-quote] exception:', message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage(
      'Erreur serveur',
      'Une erreur inattendue est survenue',
      'Veuillez réessayer plus tard ou contacter votre cabinet comptable directement.',
      true,
    ));
  }
}
