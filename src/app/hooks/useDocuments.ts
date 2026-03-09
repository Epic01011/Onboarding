/**
 * useDocuments — React hook pour récupérer les modèles de lettres
 * depuis la table Supabase `documents`.
 *
 * Usage :
 *   const { documents, loading, error, refetch } = useDocuments();
 *   const { documents } = useDocuments({ type: 'mission' });
 *
 * Retourne toujours les modèles locaux par défaut si Supabase est
 * inaccessible (tableau vide → fallback localStorage/hardcodé via
 * getTemplatesFromSupabase).
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  getDocumentsBackend,
  saveDocumentBackend,
  deleteDocumentBackend,
  DocumentTemplate,
} from '../utils/backendApi';

interface UseDocumentsOptions {
  /** Filtre par type de modèle. Tous les types si omis. */
  type?: 'confraternal' | 'mission' | 'mandat_creation';
}

interface UseDocumentsResult {
  /** Liste des modèles récupérés depuis Supabase */
  documents: DocumentTemplate[];
  /** Vrai pendant le premier chargement ou un rechargement manuel */
  loading: boolean;
  /** Message d'erreur si la requête Supabase a échoué */
  error: string | null;
  /** Recharge les modèles depuis Supabase */
  refetch: () => Promise<void>;
  /** Crée ou met à jour un modèle dans Supabase */
  saveDocument: (doc: Omit<DocumentTemplate, 'created_at' | 'updated_at'>) => Promise<DocumentTemplate | null>;
  /** Supprime un modèle dans Supabase */
  deleteDocument: (id: string) => Promise<boolean>;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsResult {
  const { type } = options;
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await getDocumentsBackend(type);
      setDocuments(docs);
    } catch (err) {
      const isAuth = err instanceof Error && (err as { isAuthError?: boolean }).isAuthError;
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des modèles';
      setError(message);
      if (isAuth) {
        toast.error('Votre session a expiré. Veuillez vous reconnecter.');
        navigate('/auth');
      } else {
        console.warn('[useDocuments] fetch error:', message);
      }
    } finally {
      setLoading(false);
    }
  }, [type, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetchDocuments().catch(() => {
      // errors are already handled inside fetchDocuments; guard against
      // potential unhandled promise rejections in strict mode
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchDocuments]);

  const saveDocument = useCallback(
    async (doc: Omit<DocumentTemplate, 'created_at' | 'updated_at'>) => {
      const saved = await saveDocumentBackend(doc);
      if (saved) {
        setDocuments(prev => {
          const idx = prev.findIndex(d => d.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
      }
      return saved;
    },
    [],
  );

  const deleteDocument = useCallback(async (id: string) => {
    const ok = await deleteDocumentBackend(id);
    if (ok) {
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
    return ok;
  }, []);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    saveDocument,
    deleteDocument,
  };
}
