/**
 * Lead Scoring — Priorisation IA (Chantier 11)
 *
 * Algorithme de scoring sur 100 points :
 *  +20 pts  si le prospect est dans le même département que le cabinet (≈ rayon 20 km)
 *  +30 pts  si le code NAF correspond à la spécialité déclarée du cabinet
 *  +10 pts  par ouverture d'email (plafonné à 30 pts)
 *  +10 pts  si l'email est renseigné
 *  +10 pts  si le téléphone est renseigné
 */

// ─── Cabinet specialty configuration ─────────────────────────────────────────

export type CabinetSpecialty = 'BTP' | 'Startups' | 'Artisans' | 'Commerce' | 'Finance' | 'Tous';

/** Mapping spécialité cabinet → secteurs Prospect correspondants */
const SPECIALTY_SECTORS: Record<CabinetSpecialty, string[]> = {
  BTP:       ['Construction'],
  Startups:  ['Informatique', 'Communication'],
  Artisans:  ['Construction', 'Commerce', 'Restauration'],
  Commerce:  ['Commerce', 'Restauration'],
  Finance:   ['Services financiers', 'Immobilier'],
  Tous:      [],
};

const CABINET_SPECIALTY_KEY = 'cabinetflow_specialty';

export function getCabinetSpecialty(): CabinetSpecialty {
  try {
    const stored = localStorage.getItem(CABINET_SPECIALTY_KEY);
    if (stored && stored in SPECIALTY_SECTORS) return stored as CabinetSpecialty;
  } catch { /* ignore */ }
  return 'Tous';
}

export function saveCabinetSpecialty(specialty: CabinetSpecialty): void {
  try {
    localStorage.setItem(CABINET_SPECIALTY_KEY, specialty);
  } catch { /* ignore */ }
}

// ─── Score computation ────────────────────────────────────────────────────────

export interface ScoringContext {
  /** Code postal du cabinet (ex : "69003") */
  cabinetPostalCode: string;
  specialty: CabinetSpecialty;
}

export interface ScoreBreakdown {
  total: number;
  /** +20 if same department */
  proximity: number;
  /** +30 if NAF matches specialty */
  naf: number;
  /** +10 per open, capped at 30 */
  emailEngagement: number;
  /** +10 if email present */
  hasEmail: number;
  /** +10 if phone present */
  hasPhone: number;
}

export function computeLeadScore(
  prospect: {
    codePostal: string;
    departement: string;
    secteur: string;
    email: string;
    telephone: string;
  },
  openCount: number,
  ctx: ScoringContext,
): ScoreBreakdown {
  const cabinetDept = ctx.cabinetPostalCode.slice(0, 2);
  const prospectDept = (prospect.codePostal?.slice(0, 2)) || prospect.departement?.slice(0, 2) || '';

  const proximity        = cabinetDept && prospectDept && cabinetDept === prospectDept ? 20 : 0;
  const matchingSectors  = ctx.specialty !== 'Tous' ? (SPECIALTY_SECTORS[ctx.specialty] ?? []) : [];
  const naf              = matchingSectors.includes(prospect.secteur) ? 30 : 0;
  const emailEngagement  = Math.min(openCount * 10, 30);
  const hasEmail         = prospect.email ? 10 : 0;
  const hasPhone         = prospect.telephone ? 10 : 0;

  const total = Math.min(proximity + naf + emailEngagement + hasEmail + hasPhone, 100);

  return { total, proximity, naf, emailEngagement, hasEmail, hasPhone };
}

/** Returns a Tailwind color class string based on the score 0-100 */
export function scoreColorClass(score: number): {
  bar: string;
  text: string;
  bg: string;
} {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (score >= 40) return { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50'   };
  return               { bar: 'bg-red-400',        text: 'text-red-600',     bg: 'bg-red-50'     };
}
