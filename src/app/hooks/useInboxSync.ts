/**
 * useInboxSync.ts
 *
 * Orchestration hook for the Inbox IA module.
 *
 * Responsibilities:
 * - Load the cabinet's AI settings (provider + decrypted API key) from Supabase
 * - Fetch unread emails via Microsoft Graph and filter to known clients
 * - Drive AI draft generation via aiEmailGenerator
 * - Send approved drafts via Microsoft Graph
 *
 * State is managed externally by useEmailDraftStore (pure state).
 * This hook only coordinates side-effects and delegates state mutations to the store.
 *
 * Error handling strategy:
 * - Microsoft Graph 401  → specific toast "session expirée" + refresh action
 * - Microsoft Graph net  → specific toast "réseau"
 * - AI 401               → "clé API invalide"
 * - AI 429               → "quota dépassé"
 * - AI timeout (>30 s)   → batched warning at the end
 * - AI 5xx               → silent console.error (fallback draft still generated)
 */

import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useMicrosoftAuth } from '../context/MicrosoftAuthContext';
import { useCabinet } from '../context/CabinetContext';
import { useEmailDraftStore } from '../../components/ai-assistant/useEmailDraftStore';
import { AIEmailDraft, SystemPromptConfig } from '../../components/ai-assistant/types';
import { fetchClientEmails, sendEmailViaGraph } from '../utils/microsoftGraph';
import { generateEmailDraft, AiGenerationError } from '../services/aiEmailGenerator';
import { supabase } from '../utils/supabaseClient';
import { decryptApiKey } from '../utils/cryptoUtils';

// ─── Error classification ─────────────────────────────────────────────────────

type GraphErrorKind = 'token_expired' | 'network' | 'other';

function classifyGraphError(err: unknown): GraphErrorKind {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    msg.includes('401') ||
    msg.includes('invalidauthenticationtoken') ||
    msg.includes('unauthorized') ||
    msg.includes('unauthenticated')
  ) return 'token_expired';
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'network';
  return 'other';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseInboxSyncReturn {
  /** Fetch new client emails, generate AI drafts, add them to the draft store. */
  fetchInboxDrafts: (systemPrompts?: SystemPromptConfig) => Promise<void>;
  /** Send an approved draft via Microsoft Graph and mark it as sent. */
  sendApprovedDraft: (id: string) => Promise<void>;
}

export function useInboxSync(): UseInboxSyncReturn {
  const { user } = useAuth();
  const { graphToken, refresh: refreshGraphToken } = useMicrosoftAuth();
  const { cabinet } = useCabinet();
  const { drafts, addDrafts, setLoading, setStatus } = useEmailDraftStore();

  // Track component mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── fetchInboxDrafts ────────────────────────────────────────────────────────

  const fetchInboxDrafts = useCallback(async (systemPrompts?: SystemPromptConfig) => {
    if (!graphToken) {
      toast.error('Connexion Microsoft requise pour récupérer les emails.');
      return;
    }

    setLoading(true);
    try {
      // 1. Load the encrypted AI key from cabinet_settings and decrypt it.
      //    Falls back to empty string if no key is stored or decryption fails
      //    (e.g. legacy plaintext rows → user must re-save from the Settings page).
      let decryptedApiKey = '';
      let decryptedPerplexityKey = '';
      let settingsAiProvider: 'claude' | 'openai' | 'perplexity' | null = null;
      if (user) {
        try {
          const { data: settings } = await supabase
            .from('cabinet_settings')
            .select('ai_api_key,perplexity_api_key,ai_provider')
            .eq('user_id', user.id)
            .maybeSingle();

          if (settings?.ai_api_key) {
            decryptedApiKey = await decryptApiKey(settings.ai_api_key, user.id);
          }
          if (settings?.perplexity_api_key) {
            decryptedPerplexityKey = await decryptApiKey(settings.perplexity_api_key, user.id);
          }
          // Inherit ai_provider from cabinet_settings when available
          if (settings?.ai_provider === 'claude' || settings?.ai_provider === 'openai' || settings?.ai_provider === 'perplexity') {
            settingsAiProvider = settings.ai_provider;
          }
        } catch (settingsErr) {
          console.warn('[useInboxSync] Could not load AI settings:', settingsErr);
        }
      }

      // Merge the decrypted keys (and optional provider override) with the rest of cabinet info.
      // CabinetContext holds cabinet name/expert/logo; the encrypted keys from
      // cabinet_settings override any stale CabinetContext value.
      const cabinetWithKey = {
        ...cabinet,
        aiApiKey: decryptedApiKey || cabinet.aiApiKey || '',
        perplexityApiKey: decryptedPerplexityKey || cabinet.perplexityApiKey || '',
        ...(settingsAiProvider ? { aiProvider: settingsAiProvider } : {}),
      };

      // Resolve the pre-instruction to send to the AI based on the selected provider.
      // Each provider can have its own customizable instruction configured in Inbox IA.
      // activeProvider is typed as AiProvider = 'claude' | 'openai' | 'perplexity',
      // which matches keyof SystemPromptConfig exactly, so direct indexing is type-safe.
      const activeProvider = cabinetWithKey.aiProvider ?? 'claude';
      const preInstruction = systemPrompts?.[activeProvider]?.trim() || undefined;

      // 2. Fetch unread emails from Microsoft Graph.
      let clientEmails;
      try {
        clientEmails = await fetchClientEmails(graphToken, supabase);
      } catch (graphErr) {
        const kind = classifyGraphError(graphErr);
        if (kind === 'token_expired') {
          toast.error(
            'Votre session Microsoft 365 a expiré. Veuillez vous reconnecter.',
            {
              action: {
                label: 'Rafraîchir',
                onClick: () => void refreshGraphToken(),
              },
            },
          );
        } else if (kind === 'network') {
          toast.error('Impossible de contacter Microsoft Graph. Vérifiez votre connexion réseau.');
        } else {
          toast.error('Erreur lors de la récupération des emails Microsoft.');
        }
        return;
      }

      if (clientEmails.length === 0) {
        toast.info('Aucun email de client connu à traiter.');
        return;
      }

      // 3. Generate AI drafts for each email not already in the store.
      const newDrafts: AIEmailDraft[] = [];
      let timeoutCount = 0;
      let invalidKeyShown = false;
      let rateLimitShown = false;

      for (const email of clientEmails) {
        if (drafts.some(d => d.id === email.messageId)) continue;

        try {
          const generated = await generateEmailDraft({
            clientEmail: email,
            cabinetInfo: cabinetWithKey,
            preInstruction,
          });
          const now = new Date().toISOString();
          newDrafts.push({
            id: email.messageId,
            status: 'pending_review',
            clientName: email.clientName,
            original_email: {
              from: email.fromEmail,
              to: cabinet.expertEmail || '',
              subject: email.subject,
              body: email.body,
              date: email.receivedAt,
            },
            draft: {
              to: email.fromEmail,
              subject: generated.subject,
              body: generated.htmlBody,
              generatedAt: now,
            },
            bofip_sources_cited: [],
            createdAt: now,
            updatedAt: now,
          });
        } catch (genErr) {
          if (genErr instanceof AiGenerationError) {
            switch (genErr.kind) {
              case 'timeout':
                timeoutCount++;
                break;
              case 'invalid_key':
                if (!invalidKeyShown) {
                  toast.error('Clé API IA invalide. Vérifiez votre clé dans les Paramètres.');
                  invalidKeyShown = true;
                }
                break;
              case 'rate_limited':
                if (!rateLimitShown) {
                  toast.warning('Quota IA dépassé. Réessayez dans quelques minutes.');
                  rateLimitShown = true;
                }
                break;
              case 'server_error':
                console.error('[useInboxSync] AI server error for', email.messageId, genErr.message);
                break;
              default:
                console.error('[useInboxSync] AI generation failed for', email.messageId, genErr.message);
            }
          } else {
            console.error('[useInboxSync] Unexpected error for', email.messageId, genErr);
          }
        }
      }

      // Batch timeout warning (avoid spamming one toast per email)
      if (timeoutCount > 0) {
        toast.warning(
          `${timeoutCount} brouillon(s) non généré(s) — délai IA dépassé. Réessayez.`,
        );
      }

      if (!isMountedRef.current) return;

      if (newDrafts.length > 0) {
        addDrafts(newDrafts);
        toast.success(`${newDrafts.length} nouveau(x) brouillon(s) généré(s).`);
      } else if (!timeoutCount && !invalidKeyShown && !rateLimitShown) {
        toast.info('Aucun nouveau brouillon à générer.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [graphToken, user, cabinet, drafts, addDrafts, setLoading, refreshGraphToken]);

  // ── sendApprovedDraft ───────────────────────────────────────────────────────

  const sendApprovedDraft = useCallback(async (id: string) => {
    const draftItem = drafts.find(d => d.id === id);
    if (!draftItem) return;

    if (!graphToken) {
      toast.error("Connexion Microsoft requise pour l'envoi.");
      return;
    }

    // Optimistic update — roll back on failure.
    setStatus(id, 'sent');
    try {
      await sendEmailViaGraph(graphToken, {
        to: draftItem.draft.to,
        subject: draftItem.draft.subject,
        htmlBody: draftItem.draft.body,
      });
      if (isMountedRef.current) {
        toast.success('Email envoyé avec succès.');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setStatus(id, 'approved'); // roll back to previous approved state
        const kind = classifyGraphError(err);
        if (kind === 'token_expired') {
          toast.error(
            'Session Microsoft expirée. Reconnectez-vous pour envoyer.',
            {
              action: {
                label: 'Rafraîchir',
                onClick: () => void refreshGraphToken(),
              },
            },
          );
        } else if (kind === 'network') {
          toast.error("Pas de connexion réseau. L'email n'a pas été envoyé.");
        } else {
          toast.error("Erreur lors de l'envoi. Veuillez réessayer.");
        }
      }
    }
  }, [graphToken, drafts, setStatus, refreshGraphToken]);

  return { fetchInboxDrafts, sendApprovedDraft };
}
