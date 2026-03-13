import { DossierData } from '../utils/localStorage';
import { CREATION_TOTAL_STEPS, TOTAL_STEPS } from '../context/OnboardingContext';

/**
 * Returns the authoritative step count for a dossier based on its mission type.
 * Creation dossiers have 7 active steps; reprise (or unknown) have 11.
 */
function getExpectedTotalSteps(dossier: DossierData): number {
  const mt = dossier.missionType || dossier.clientData?.missionType;
  return mt === 'creation' ? CREATION_TOTAL_STEPS : TOTAL_STEPS;
}

export function getDossierProgress(dossier: DossierData): number {
  const total = getExpectedTotalSteps(dossier);
  const completed = dossier.stepStatuses.slice(0, total).filter(s => s === 'completed').length;
  return total > 0 ? completed / total : 0;
}

/**
 * Returns true if the dossier has been started — i.e. at least one step is
 * 'active' or 'completed'. Dossiers where every step is still 'pending' are
 * considered not yet started.
 */
export function isDossierStarted(dossier: DossierData): boolean {
  return dossier.stepStatuses.some(s => s === 'active' || s === 'completed');
}

/**
 * Derives the logical status of a dossier from its step statuses.
 * A dossier is "completed" when every active step is either 'completed' or 'skipped'
 * (i.e. no active step is still 'pending' or 'active').
 * Uses the mission-type-authoritative step count so creation dossiers (7 steps)
 * are not penalised by trailing 'pending' entries from the 11-slot context array.
 */
export function getDossierStatus(dossier: DossierData): 'in_progress' | 'completed' {
  const total = getExpectedTotalSteps(dossier);
  const relevant = dossier.stepStatuses.slice(0, total);
  const isComplete = relevant.length > 0 && relevant.every(
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
