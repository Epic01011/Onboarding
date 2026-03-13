/**
 * icsExport.ts — Utilitaire de génération et téléchargement de fichiers .ics (iCalendar).
 *
 * Compatible Outlook, Google Calendar, Apple Calendar et tout client agendas
 * supportant RFC 5545.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Échappe les caractères spéciaux pour les valeurs de propriétés iCalendar (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Formate un timestamp ISO en chaîne UTC iCalendar : `YYYYMMDDTHHmmssZ`.
 * Si la chaîne d'entrée est une date seule (YYYY-MM-DD), renvoie `YYYYMMDD`
 * pour un événement toute la journée.
 */
function formatIcsDate(iso: string): { value: string; allDay: boolean } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    // Date seule → événement toute la journée
    return { value: iso.replace(/-/g, ''), allDay: true };
  }
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const value =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return { value, allDay: false };
}

/** Renvoie un DTSTAMP basé sur l'instant courant (UTC). */
function nowIcsStamp(): string {
  const { value } = formatIcsDate(new Date().toISOString());
  return value;
}

/** Génère un UID unique reproductible depuis un identifiant métier et un suffixe. */
function buildUid(id: string, suffix: string): string {
  return `${id}-${suffix}@cabinet-onboarding`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IcsEvent {
  /** Titre affiché dans l'agenda. */
  summary: string;
  /** Date ou datetime ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ssZ). */
  date: string;
  /** Description longue (optionnelle). */
  description?: string;
  /** Identifiant stable pour générer un UID iCalendar reproductible. */
  uid: string;
  /**
   * Durée en minutes pour les événements non toute la journée (défaut : 60).
   * Ignoré pour les événements toute la journée.
   */
  durationMinutes?: number;
}

// ─── Génération ICS ───────────────────────────────────────────────────────────

/**
 * Construit le contenu texte d'un fichier `.ics` à partir d'un ou plusieurs événements.
 */
export function buildIcsContent(events: IcsEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cabinet Comptable Onboarding//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const evt of events) {
    const { value: dtStart, allDay } = formatIcsDate(evt.date);
    const dtstamp = nowIcsStamp();
    const uid = buildUid(evt.uid, 'ics');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      // Événement toute la journée : DTEND = lendemain
      const d = new Date(evt.date + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      const endDate = d.toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTEND;VALUE=DATE:${endDate}`);
    } else {
      lines.push(`DTSTART:${dtStart}`);
      const durationMs = (evt.durationMinutes ?? 60) * 60 * 1000;
      const endDate = new Date(new Date(evt.date).getTime() + durationMs);
      const { value: dtEnd } = formatIcsDate(endDate.toISOString());
      lines.push(`DTEND:${dtEnd}`);
    }

    lines.push(`SUMMARY:${escapeText(evt.summary)}`);
    if (evt.description) {
      lines.push(`DESCRIPTION:${escapeText(evt.description)}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ─── Téléchargement ───────────────────────────────────────────────────────────

/**
 * Génère et déclenche le téléchargement d'un fichier `.ics` dans le navigateur.
 *
 * @param events  Un ou plusieurs événements à inclure dans le fichier.
 * @param filename  Nom du fichier téléchargé (sans extension, défaut : "rappel").
 */
export function downloadIcs(events: IcsEvent | IcsEvent[], filename = 'rappel'): void {
  const eventsArray = Array.isArray(events) ? events : [events];
  const content = buildIcsContent(eventsArray);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Fabriques pratiques ──────────────────────────────────────────────────────

/**
 * Crée un événement ICS pour la prochaine action d'un prospect.
 *
 * @param prospect  Informations du prospect.
 * @param nextActionDate  Date ISO (YYYY-MM-DD).
 * @param notes  Notes CRM à inclure dans la description (optionnel).
 */
export function downloadProspectActionIcs(prospect: {
  id: string;
  nomSociete?: string | null;
  dirigeant?: string | null;
}, nextActionDate: string, notes?: string): void {
  const company = prospect.nomSociete ?? 'Prospect';
  const dirigeant = prospect.dirigeant ? ` — ${prospect.dirigeant}` : '';
  const summary = `📞 Appel prospection : ${company}${dirigeant}`;
  const description = [
    `Rappel automatique de prospection pour ${company}.`,
    notes ? `Notes CRM : ${notes}` : '',
  ].filter(Boolean).join('\n');

  downloadIcs(
    {
      uid: prospect.id,
      summary,
      date: nextActionDate,
      description,
    },
    `prospection-${company.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
  );
}

/**
 * Crée un événement ICS pour la deadline d'une tâche.
 *
 * @param task  Informations de la tâche.
 */
export function downloadTaskIcs(task: {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
}): void {
  const summary = `✅ Tâche : ${task.title}`;
  const description = task.description ?? '';

  downloadIcs(
    {
      uid: task.id,
      summary,
      date: task.dueDate,
      description,
    },
    `tache-${task.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
  );
}
