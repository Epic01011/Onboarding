/**
 * useFiscalAlerts.ts
 *
 * Détecte les échéances fiscales à J-7 (ou moins) et renvoie une liste
 * d'alertes triées par urgence croissante (les plus proches en premier).
 *
 * Usage:
 *   const alerts = useFiscalAlerts(tasks);
 *   // alerts[0] is the most urgent upcoming deadline
 *
 *   // Filter by period:
 *   const q1Alerts = useFiscalAlerts(tasks, 90, { year: 2026, quarter: 1 });
 *   const janAlerts = useFiscalAlerts(tasks, 90, { year: 2026, month: 0 });
 */

import { useMemo } from 'react';
import { FiscalTask } from '../types/dashboard';

/** Priority level of the alert. "high" is assigned when DGFIP detects a payment delay. */
export type FiscalAlertPriority = 'high' | 'normal';

export interface FiscalAlert {
  task: FiscalTask;
  /** Number of calendar days left until due_date (0 = today, negative = overdue) */
  daysLeft: number;
  /** Alert priority — "high" for overdue tasks flagged by DGFIP, "normal" otherwise */
  priority: FiscalAlertPriority;
}

/** Optional period filter for useFiscalAlerts. Provide either month (0-based) or quarter (1-based). */
export interface FiscalAlertPeriodFilter {
  year: number;
  /** 0-based month index (January = 0). Ignored when quarter is provided. */
  month?: number;
  /** 1-based quarter (Q1 = 1, Q2 = 2, Q3 = 3, Q4 = 4). Takes precedence over month. */
  quarter?: number;
}

function computeDaysLeft(dueDateIso: string, now: number): number {
  return Math.ceil((new Date(dueDateIso).getTime() - now) / 86_400_000);
}

/** Returns true when the due_date falls within the requested period. */
function matchesPeriod(dueDateIso: string, filter: FiscalAlertPeriodFilter): boolean {
  const d = new Date(dueDateIso);
  if (d.getFullYear() !== filter.year) return false;

  if (filter.quarter !== undefined) {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return q === filter.quarter;
  }

  if (filter.month !== undefined) {
    return d.getMonth() === filter.month;
  }

  return true;
}

/**
 * Returns all non-declared fiscal tasks whose due_date is within `thresholdDays`
 * days from now (inclusive). Overdue tasks (daysLeft < 0) are also included.
 * Results are sorted ascending by daysLeft (most urgent first), with "high"
 * priority tasks surfaced before "normal" priority tasks at the same daysLeft.
 *
 * @param tasks         List of fiscal tasks to inspect
 * @param thresholdDays Number of days ahead to consider (default 7)
 * @param periodFilter  Optional month/quarter filter for dashboard widgets
 */
export function useFiscalAlerts(
  tasks: FiscalTask[],
  thresholdDays = 7,
  periodFilter?: FiscalAlertPeriodFilter,
): FiscalAlert[] {
  return useMemo(() => {
    const now = Date.now();
    return tasks
      .filter(task => {
        if (task.status === 'declared') return false;
        const dl = computeDaysLeft(task.due_date, now);
        if (dl > thresholdDays) return false;
        if (periodFilter && !matchesPeriod(task.due_date, periodFilter)) return false;
        return true;
      })
      .map(task => {
        const daysLeft = computeDaysLeft(task.due_date, now);
        // "high" priority when DGFIP has certified the data AND the deadline is overdue,
        // or when the task explicitly carries a mismatch alert from DGFIP.
        const priority: FiscalAlertPriority =
          (daysLeft < 0 && task.is_dgfip_certified) || task.mismatch_alert
            ? 'high'
            : 'normal';
        return { task, daysLeft, priority };
      })
      .sort((a, b) => {
        // "high" priority first when equal daysLeft
        if (a.daysLeft === b.daysLeft) {
          if (a.priority === 'high' && b.priority !== 'high') return -1;
          if (b.priority === 'high' && a.priority !== 'high') return 1;
        }
        return a.daysLeft - b.daysLeft;
      });
  }, [tasks, thresholdDays, periodFilter]);
}
