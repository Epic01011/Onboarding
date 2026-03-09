import { DossierData } from '../utils/localStorage';

export function getDossierProgress(dossier: DossierData): number {
  const completed = dossier.stepStatuses.filter(s => s === 'completed').length;
  const total = dossier.stepStatuses.length;
  return total > 0 ? completed / total : 0;
}

/**
 * Derives the logical status of a dossier from its step statuses.
 * A dossier is "completed" when every step is either 'completed' or 'skipped'
 * (i.e. no step is still 'pending' or 'active').
 */
export function getDossierStatus(dossier: DossierData): 'in_progress' | 'completed' {
  const isComplete = dossier.stepStatuses.every(
    s => s === 'completed' || s === 'skipped',
  );
  return isComplete ? 'completed' : 'in_progress';
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'il y a 1 jour';
  return `il y a ${days} jours`;
}
