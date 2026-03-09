import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getTemplatesBackend,
  saveTemplateBackend,
  deleteTemplateBackend,
} from '../utils/backendApi';
import { 
  getAllTemplates as getLocalTemplates,
  saveTemplate as saveLocalTemplate,
  deleteTemplate as deleteLocalTemplate,
  LetterTemplate,
} from '../utils/templateUtils';

export function useTemplates() {
  const { accessToken, user } = useAuth();
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Load templates — backend first, localStorage fallback
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken || !user) {
        setTemplates(getLocalTemplates());
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getTemplatesBackend(accessToken, user.id);
        if (cancelled) return;
        const list = response.templates as LetterTemplate[];
        if (list && list.length > 0) {
          setTemplates(list);
        } else {
          setTemplates(getLocalTemplates());
        }
      } catch {
        if (!cancelled) setTemplates(getLocalTemplates());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [accessToken, user]);

  const saveTemplate = async (template: LetterTemplate) => {
    // Optimistic update
    const idx = templates.findIndex(t => t.id === template.id);
    const updated = idx >= 0
      ? templates.map((t, i) => (i === idx ? template : t))
      : [...templates, template];

    setTemplates(updated);
    saveLocalTemplate(template);

    if (accessToken && user) {
      try {
        const response = await saveTemplateBackend(template, accessToken, user.id);
        setTemplates(response.templates as LetterTemplate[]);
      } catch (err) {
        console.error('[Templates] Failed to save to backend:', err);
        // Already saved locally — no revert needed
      }
    }
  };

  const deleteTemplate = async (id: string) => {
    // Optimistic update
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    deleteLocalTemplate(id);

    if (accessToken && user) {
      try {
        const response = await deleteTemplateBackend(id, accessToken, user.id);
        setTemplates(response.templates as LetterTemplate[]);
      } catch (err) {
        console.error('[Templates] Failed to delete from backend:', err);
        // Already deleted locally — no revert needed
      }
    }
  };

  return { templates, saveTemplate, deleteTemplate, loading };
}