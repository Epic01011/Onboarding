/**
 * useFiscalAlerts.ts
 *
 * Détecte les échéances fiscales à J-7 (ou moins) et renvoie une liste
 * d'alertes triées par urgence croissante (les plus proches en premier).
 *
 * Usage:
 *   const alerts = useFiscalAlerts(tasks);
 *   // alerts[0] is the most urgent upcoming deadline
 */

import { useMemo } from 'react';
import { FiscalTask } from '../types/dashboard';

export interface FiscalAlert {
  task: FiscalTask;
  /** Number of calendar days left until due_date (0 = today, negative = overdue) */
  daysLeft: number;
}

function computeDaysLeft(dueDateIso: string, now: number): number {
  return Math.ceil((new Date(dueDateIso).getTime() - now) / 86_400_000);
}

/**
 * Returns all non-declared fiscal tasks whose due_date is within `thresholdDays`
 * days from now (inclusive). Overdue tasks (daysLeft < 0) are also included.
 * Results are sorted ascending by daysLeft (most urgent first).
 */
export function useFiscalAlerts(
  tasks: FiscalTask[],
  thresholdDays = 7,
): FiscalAlert[] {
  return useMemo(() => {
    const now = Date.now();
    return tasks
      .filter(task => {
        if (task.status === 'declared') return false;
        return computeDaysLeft(task.due_date, now) <= thresholdDays;
      })
      .map(task => ({ task, daysLeft: computeDaysLeft(task.due_date, now) }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [tasks, thresholdDays]);
}
