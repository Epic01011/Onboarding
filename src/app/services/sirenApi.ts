/**
 * Service SIREN — API gouvernementale (recherche-entreprises.api.gouv.fr)
 *
 * L'API recherche-entreprises.api.gouv.fr supporte le CORS nativement.
 * Les appels sont effectués directement sans proxy intermédiaire.
 */

// Full NAF rev. 2 mapping (~732 codes) — lives in nafMapping.ts.
// Imported for use in resolveLibelleNAF and re-exported so any existing
// callers that import NAF_MAPPING from this file continue to work.
import { NAF_MAPPING } from '../utils/nafMapping';
export { NAF_MAPPING };

export interface SirenData {
  siren: string;
  nomComplet: string;
  siret: string;
  adresse: string;
  codePostal: string;
  ville: string;
  formeJuridique: string;
  codeNAF: string;
  libelleNAF: string;
  dateCreation: string;
  capitalSocial: string;
  effectif: string;
  etatAdministratif: 'A' | 'C' | string;
  categorieEntreprise: string;
  /** Nom du représentant légal (premier dirigeant) */
  nomDirigeant?: string;
  /** Prénom(s) du représentant légal */
  prenomDirigeant?: string;
}

/** Résultat allégé pour l'autocomplétion par raison sociale */
export interface CompanySuggestion {
  siren: string;
  nomComplet: string;
  adresse: string;
  codePostal: string;
  ville: string;
  formeJuridique: string;
  /** Code APE/NAF de l'établissement principal */
  codeNAF: string;
  /** Libellé de l'activité principale (secteur d'activité) */
  libelleNAF: string;
}

export type SirenSource = 'api_direct' | 'api_proxy' | 'demo';

export type SirenResult =
  | { success: true; data: SirenData; source: SirenSource }
  | { success: false; error: string };

// NAF_MAPPING is imported and re-exported above.

// ─────────────────────────────────────────────────────────────────────────────
// Dictionnaire INSEE des formes juridiques (codes n3 les plus courants)
// Source : nomenclature officielle des catégories juridiques INSEE
// ─────────────────────────────────────────────────────────────────────────────
const FORME_JURIDIQUE_MAP: Record<string, string> = {
  // Entrepreneur individuel
  '1000': 'Entrepreneur individuel',
  '1100': 'Agent commercial',
  // Groupements sans personnalité morale
  '2110': 'Indivision',
  '2120': 'Société créée de fait',
  '2210': 'Société en nom collectif (SNC)',
  '2221': 'Société en commandite simple',
  '2222': 'Société en commandite par actions (SCA)',
  // Personnes morales de droit privé (code 3xxx)
  '3110': 'Société à responsabilité limitée (SARL)',
  '3120': 'Entreprise unipersonnelle à responsabilité limitée (EURL)',
  '3130': 'Groupement d\'intérêt économique (GIE)',
  // Sociétés par actions (codes 5xxx)
  '5110': 'Société anonyme à conseil d\'administration (SA)',
  '5120': 'Société anonyme à directoire (SA)',
  '5130': 'Société en commandite par actions (SCA)',
  '5410': 'Société à responsabilité limitée (SARL)',
  '5415': 'Entreprise unipersonnelle à responsabilité limitée (EURL)',
  '5422': 'Société en nom collectif (SNC)',
  '5426': 'Société en commandite simple',
  '5430': 'Société en commandite par actions (SCA)',
  '5441': 'Société anonyme à conseil d\'administration (SA)',
  '5442': 'Société anonyme à directoire (SA)',
  '5443': 'Société anonyme (SA)',
  '5451': 'Société d\'économie mixte (SEM)',
  '5505': 'Société à responsabilité limitée (SARL)',
  '5510': 'Entreprise unipersonnelle à responsabilité limitée (EURL)',
  '5515': 'Société anonyme (SA)',
  '5520': 'Société anonyme (SA)',
  '5522': 'Société anonyme à participation ouvrière (SAPO)',
  '5525': 'Société anonyme coopérative à participation ouvrière',
  '5530': 'Société en commandite par actions (SCA)',
  '5531': 'Société en commandite par actions coopérative',
  '5532': 'Société en commandite par actions coopérative de production',
  '5540': 'Société par actions simplifiée (SAS)',
  '5542': 'Société par actions simplifiée unipersonnelle (SASU)',
  '5543': 'Société par actions simplifiée coopérative',
  '5545': 'Société par actions simplifiée (SAS)',
  '5546': 'Société par actions simplifiée unipersonnelle (SASU)',
  '5551': 'Société anonyme coopérative de production (SCOP)',
  '5552': 'Société anonyme coopérative de consommation',
  '5553': 'Société anonyme coopérative artisanale',
  '5559': 'Société anonyme coopérative',
  '5560': 'Société anonyme (SA)',
  '5599': 'Société anonyme (SA)',
  '5605': 'Société en commandite par actions (SCA)',
  '5610': 'Société anonyme (SA)',
  '5615': 'Société anonyme (SA)',
  '5620': 'Société par actions simplifiée (SAS)',
  '5622': 'Société par actions simplifiée unipersonnelle (SASU)',
  '5660': 'Société coopérative ouvrière de production (SCOP)',
  '5699': 'Société par actions (autre)',
  '5700': 'Société par actions simplifiée (SAS)',
  '5710': 'Société par actions simplifiée (SAS)',
  '5720': 'Société par actions simplifiée unipersonnelle (SASU)',
  // Sociétés civiles
  '6100': 'Société civile',
  '6210': 'Société civile immobilière (SCI)',
  '6316': 'Société civile de placement immobilier (SCPI)',
  // Associations et fondations
  '9120': 'Association loi 1901',
  '9150': 'Association syndicale libre',
  '9210': 'Fondation',
  '9220': 'Fondation reconnue d\'utilité publique',
};

/**
 * Résout le libellé d'une forme juridique à partir d'un code INSEE numérique ou
 * d'un libellé déjà textuel renvoyé par l'API.
 *
 * - Si la valeur est déjà un libellé textuel (non purement numérique), elle est
 *   retournée telle quelle.
 * - Si la valeur est un code numérique (ex: "5710"), elle est traduite via le
 *   dictionnaire FORME_JURIDIQUE_MAP ; si le code est inconnu, le code brut est
 *   conservé plutôt que de perdre l'information.
 */
export function resolveFormeJuridique(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Already a human-readable label — return as-is
  if (!/^\d+$/.test(trimmed)) return trimmed;
  // Numeric INSEE code — look up in dictionary, fall back to raw code
  return FORME_JURIDIQUE_MAP[trimmed] ?? trimmed;
}

/**
 * Résout le libellé d'une activité à partir du code NAF/APE brut.
 * Normalise le code en retirant les points éventuels (ex: "69.20Z" → "6920Z").
 * Renvoie une chaîne vide si le code n'est pas dans le dictionnaire.
 */
export function resolveLibelleNAF(rawCode: string): string {
  if (!rawCode) return '';
  const normalised = rawCode.trim().replace(/\./g, '').toUpperCase();
  return NAF_MAPPING[normalised] ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// URLs
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = 'https://recherche-entreprises.api.gouv.fr';

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBySIREN(siren: string): Promise<SirenResult> {
  const cleanSiren = siren.replace(/[\s\-.]/g, '');

  if (!/^\d{9}$/.test(cleanSiren)) {
    return { success: false, error: 'Le numéro SIREN doit comporter exactement 9 chiffres.' };
  }

  const apiUrl = `${API_BASE}/search?q=${cleanSiren}&page=1&per_page=1`;

  // ── Appel direct ────────────────────────────────────────────────────────
  try {
    const data = await fetchWithTimeout(apiUrl, 8000);
    if (data) return { success: true, data: parseApiResponse(data, cleanSiren), source: 'api_direct' };
  } catch (err) {
    console.warn('[SIREN] Appel direct échoué :', err);
  }

  // ── Aucune source disponible ─────────────────────────────────────────────
  return {
    success: false,
    error:
      "Impossible de joindre l'API SIREN (réseau ou CORS). Vérifiez votre connexion ou saisissez les données manuellement.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (!json?.results?.length) return null; // SIREN inconnu
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function parseApiResponse(
  json: Record<string, unknown>,
  cleanSiren: string
): SirenData {
  const results = json.results as Record<string, unknown>[];
  const r = results[0] as Record<string, unknown>;
  const siege = (r.siege ?? {}) as Record<string, unknown>;

  const adresseParts = [
    siege.numero_voie,
    siege.type_voie,
    siege.libelle_voie,
  ]
    .filter(Boolean)
    .join(' ');

  const adresseComplete =
    adresseParts ||
    (siege.geo_adresse as string) ||
    (siege.adresse as string) ||
    '';

  // Extract first dirigeant (représentant légal)
  const dirigeants = (r.dirigeants as Record<string, unknown>[] | undefined) ?? [];
  const firstDirigeant = dirigeants[0] as Record<string, unknown> | undefined;
  const nomDirigeant = firstDirigeant
    ? ((firstDirigeant.nom as string) || undefined)
    : undefined;
  const prenomDirigeant = firstDirigeant
    ? ((firstDirigeant.prenoms as string) || undefined)
    : undefined;

  return {
    siren: (r.siren as string) ?? cleanSiren,
    nomComplet:
      (r.nom_complet as string) ?? (r.nom_raison_sociale as string) ?? '',
    siret: (siege.siret as string) ?? cleanSiren + '00001',
    adresse: adresseComplete,
    codePostal: (siege.code_postal as string) ?? '',
    ville: (siege.libelle_commune as string) ?? '',
    formeJuridique: resolveFormeJuridique(
      ((r.libelle_nature_juridique_n3 as string) ||
      (r.nature_juridique as string) ||
      '')
    ),
    codeNAF:
      (siege.activite_principale as string) ??
      (r.activite_principale as string) ??
      '',
    libelleNAF: resolveLibelleNAF(
      ((siege.activite_principale as string) ?? (r.activite_principale as string) ?? '')
    ),
    dateCreation: (siege.date_creation as string) ?? '',
    capitalSocial: r.capital_social
      ? `${Number(r.capital_social).toLocaleString('fr-FR')} €`
      : 'Non communiqué',
    effectif: formatEffectif(siege.tranche_effectif_salarie as string | undefined),
    etatAdministratif: (siege.etat_administratif as string) ?? 'A',
    categorieEntreprise: (r.categorie_entreprise as string) ?? '',
    nomDirigeant,
    prenomDirigeant,
  };
}

function formatEffectif(tranche: string | undefined): string {
  const tranches: Record<string, string> = {
    '00': '0 salarié',
    '01': '1 à 2',
    '02': '3 à 5',
    '03': '6 à 9',
    '11': '10 à 19',
    '12': '20 à 49',
    '21': '50 à 99',
    '22': '100 à 199',
    '31': '200 à 249',
    '32': '250 à 499',
    '41': '500 à 999',
    '42': '1 000 à 1 999',
    '51': '2 000 à 4 999',
    '52': '5 000 à 9 999',
    '53': '10 000 et plus',
    NN: 'Non diffusé',
  };
  return tranche ? (tranches[tranche] ?? `Tranche ${tranche}`) : 'Non renseigné';
}

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplétion par raison sociale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recherche des entreprises par nom et renvoie jusqu'à 5 suggestions.
 * Utilisé pour l'autocomplétion du champ "Raison Sociale".
 */
export async function searchCompaniesByName(query: string): Promise<CompanySuggestion[]> {
  if (query.trim().length < 3) return [];

  const apiUrl = `${API_BASE}/search?q=${encodeURIComponent(query.trim())}&page=1&per_page=5`;

  try {
    const data = await fetchWithTimeout(apiUrl, 6000);
    if (!data) return [];

    const results = data.results as Record<string, unknown>[];
    return results.map(r => {
      const siege = (r.siege ?? {}) as Record<string, unknown>;
      const adresseParts = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
        .filter(Boolean)
        .join(' ');
      const adresse = adresseParts || (siege.geo_adresse as string) || '';
      return {
        siren: (r.siren as string) ?? '',
        nomComplet: (r.nom_complet as string) ?? (r.nom_raison_sociale as string) ?? '',
        adresse,
        codePostal: (siege.code_postal as string) ?? '',
        ville: (siege.libelle_commune as string) ?? '',
        formeJuridique: resolveFormeJuridique(
          ((r.libelle_nature_juridique_n3 as string) ||
          (r.nature_juridique as string) ||
          '')
        ),
        codeNAF:
          (siege.activite_principale as string) ??
          (r.activite_principale as string) ??
          '',
        libelleNAF: resolveLibelleNAF(
          ((siege.activite_principale as string) ?? (r.activite_principale as string) ?? '')
        ),
      };
    });
  } catch {
    return [];
  }
}
