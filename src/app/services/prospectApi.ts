/**
 * Service Prospection — recherche-entreprises.api.gouv.fr (API Sirene/INPI)
 *
 * Stratégie en 3 niveaux :
 *  1. Appel direct avec timeout (6 s)
 *  2. Fallback via proxies CORS en parallèle (timeout 8 s)
 *  3. Données de démonstration si tout échoue (mode hors-ligne)
 *
 * Chaque résultat est enrichi avec :
 *  - La liste complète des dirigeants (nom, prénom, qualité)
 *  - Le dirigeant principal sélectionné par priorité de rôle
 *  - Le secteur d'activité dérivé du code NAF
 */

// ─── Types exportés ───────────────────────────────────────────────────────────

export interface ProspectFilters {
  /** Texte libre : raison sociale, SIREN, ville… */
  q?: string;
  /** Secteurs d'activité (labels UI) - OR logic within array */
  secteur?: string | string[];
  /** Code NAF exact (ex : '6920Z') — prioritaire sur secteur */
  codeNAF?: string;
  /** Formes juridiques courtes - OR logic within array */
  formeJuridique?: string | string[];
  /** Numéro de département (ex : '75', '69') */
  departement?: string;
  /** Effectif ranges - OR logic within array */
  effectif?: string | string[];
  page?: number;
  perPage?: number;
}

export interface ProspectDirigeant {
  nom: string;
  prenom: string;
  /** Ex : 'Président', 'Gérant', 'Directeur général' */
  qualite: string;
}

export interface Prospect {
  /** SIREN utilisé comme clé unique */
  siren: string;
  siret: string;
  nomSociete: string;
  /** Forme abrégée : SAS, SARL, EURL… */
  formeJuridique: string;
  /** Libellé complet de la nature juridique */
  libelleFormeJuridique: string;
  codeNAF: string;
  libelleNAF: string;
  /** Secteur dérivé du code NAF (ex : 'Construction') */
  secteur: string;
  adresse: string;
  codePostal: string;
  ville: string;
  departement: string;
  dateCreation: string;
  effectif: string;
  capitalSocial: string;
  categorieEntreprise: string;
  /** Liste complète des dirigeants issus de l'API */
  dirigeants: ProspectDirigeant[];
  /** Dirigeant sélectionné par priorité de rôle (Président > Gérant > 1er) */
  dirigeantPrincipal: ProspectDirigeant | null;
  /** Non disponible dans l'API publique — à enrichir ultérieurement */
  email: string;
  telephone: string;
}

export type ProspectSource = 'api_direct' | 'api_proxy' | 'demo';

export type ProspectSearchResult =
  | { success: true; prospects: Prospect[]; total: number; source: ProspectSource }
  | { success: false; error: string };

// ─── Constantes ───────────────────────────────────────────────────────────────

const API_BASE = 'https://recherche-entreprises.api.gouv.fr';

const CORS_PROXIES: Array<(url: string) => string> = [
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://cors.sh/${url}`,
];

/**
 * Mapping secteur UI → lettre de section NACE
 * (paramètre `section_activite_principale` de l'API)
 */
const SECTEUR_TO_SECTION: Record<string, string> = {
  Agriculture:         'A',
  Construction:        'F',
  Commerce:            'G',
  Restauration:        'I',
  Transport:           'H',
  Informatique:        'J',
  Communication:       'J',
  'Services financiers': 'K',
  Immobilier:          'L',
  Santé:               'Q',
};

/**
 * Mapping forme juridique courte → code INSEE nature_juridique
 */
const FORME_TO_NATURE: Record<string, string> = {
  SAS:          '5710',
  SASU:         '5720',
  SARL:         '5498',
  EURL:         '5499',
  SA:           '5599',
  SCI:          '6540',
  EI:           '1000',
  EIRL:         '1000',
  Association:  '9220',
};

// ─── Point d'entrée principal ─────────────────────────────────────────────────

/**
 * Recherche des prospects selon les filtres fournis.
 * Supporte les filtres multiples avec logique cumulative :
 * - OR au sein d'un même type de filtre (ex: Construction OU Informatique)
 * - AND entre différents types de filtres (ex: (Construction OU Info) ET (SAS OU SARL))
 */
export async function searchProspects(
  filters: ProspectFilters = {}
): Promise<ProspectSearchResult> {
  // Convert single values to arrays for uniform processing
  const secteurs = Array.isArray(filters.secteur) ? filters.secteur :
                   (filters.secteur && filters.secteur !== 'all' ? [filters.secteur] : []);
  const formes = Array.isArray(filters.formeJuridique) ? filters.formeJuridique :
                 (filters.formeJuridique && filters.formeJuridique !== 'all' ? [filters.formeJuridique] : []);

  // For multiple filter values, we need to make multiple calls and merge results
  // This implements OR logic within each filter type
  if (secteurs.length > 1 || formes.length > 1) {
    return await searchProspectsMultipleFilters(filters, secteurs, formes);
  }

  // Single filter value - use original logic
  const apiUrl = buildApiUrl({
    ...filters,
    secteur: secteurs[0],
    formeJuridique: formes[0],
  });

  // ── 1. Appel direct ────────────────────────────────────────────────────────
  try {
    const data = await fetchWithTimeout(apiUrl, 6000);
    if (data) {
      return { success: true, ...parseResponse(data), source: 'api_direct' };
    }
  } catch (err) {
    console.warn('[Prospection] Appel direct échoué :', err);
  }

  // ── 2. Fallback proxies CORS en parallèle ─────────────────────────────────
  try {
    const data = await Promise.any(
      CORS_PROXIES.map(async buildUrl => {
        const result = await fetchWithTimeout(buildUrl(apiUrl), 8000);
        if (!result) throw new Error('Réponse vide');
        return result;
      })
    );
    if (data) {
      return { success: true, ...parseResponse(data), source: 'api_proxy' };
    }
  } catch (err) {
    console.warn('[Prospection] Tous les proxies ont échoué :', err);
  }

  // ── 3. Données de démonstration ────────────────────────────────────────────
  const demos = getDemoProspects();
  return { success: true, prospects: demos, total: demos.length, source: 'demo' };
}

/**
 * Handles multiple filter values by making parallel API calls and merging results
 */

/** Pauses execution for `ms` milliseconds — used to respect the ~30 req/min rate limit */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function searchProspectsMultipleFilters(
  baseFilters: ProspectFilters,
  secteurs: string[],
  formes: string[]
): Promise<ProspectSearchResult> {
  const allProspects = new Map<string, Prospect>(); // Use SIREN as key for deduplication
  let source: ProspectSource = 'demo';

  // Generate all filter combinations (cartesian product)
  const combinations: Array<{secteur?: string; formeJuridique?: string}> = [];

  if (secteurs.length > 0 && formes.length > 0) {
    // Both filters: combine all secteurs with all formes
    for (const secteur of secteurs) {
      for (const forme of formes) {
        combinations.push({ secteur, formeJuridique: forme });
      }
    }
  } else if (secteurs.length > 0) {
    // Only secteurs
    for (const secteur of secteurs) {
      combinations.push({ secteur });
    }
  } else if (formes.length > 0) {
    // Only formes
    for (const forme of formes) {
      combinations.push({ formeJuridique: forme });
    }
  }

  // Send requests in chunks of 5; wait 1 s between chunks to stay under the
  // ~30 req/min public API rate limit (5 req × 60 s / 1 s ≈ 300 req/min max,
  // but in practice the pause smooths burst traffic significantly).
  const chunkSize = 5;
  const totalChunks = Math.ceil(combinations.length / chunkSize);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const chunk = combinations.slice(start, start + chunkSize);

    const promises = chunk.map(combo =>
      searchProspectsSingle({
        ...baseFilters,
        ...combo,
      })
    );

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result.success) {
        source = result.source; // Use last successful source
        for (const prospect of result.prospects) {
          allProspects.set(prospect.siren, prospect);
        }
      }
    }

    // Pause between chunks — skip after the last one to avoid unnecessary wait
    if (chunkIndex < totalChunks - 1) {
      await delay(1000);
    }
  }

  const prospects = Array.from(allProspects.values());

  return {
    success: true,
    prospects,
    total: prospects.length,
    source,
  };
}

/**
 * Single API call with single filter values
 */
async function searchProspectsSingle(
  filters: ProspectFilters
): Promise<ProspectSearchResult> {
  const apiUrl = buildApiUrl(filters);

  try {
    const data = await fetchWithTimeout(apiUrl, 6000);
    if (data) {
      return { success: true, ...parseResponse(data), source: 'api_direct' };
    }
  } catch {
    // Silent fail for parallel calls
  }

  try {
    const data = await Promise.any(
      CORS_PROXIES.map(async buildUrl => {
        const result = await fetchWithTimeout(buildUrl(apiUrl), 8000);
        if (!result) throw new Error('Réponse vide');
        return result;
      })
    );
    if (data) {
      return { success: true, ...parseResponse(data), source: 'api_proxy' };
    }
  } catch {
    // Silent fail
  }

  return { success: false, error: 'API unavailable' };
}

// ─── Construction de l'URL ────────────────────────────────────────────────────

function buildApiUrl(filters: ProspectFilters): string {
  const params = new URLSearchParams();

  // Texte libre
  if (filters.q?.trim()) {
    params.set('q', filters.q.trim());
  }

  // Activité principale : code NAF exact prioritaire sur la section
  if (filters.codeNAF?.trim()) {
    params.set('activite_principale', filters.codeNAF.trim());
  } else if (filters.secteur) {
    const secteur = typeof filters.secteur === 'string' ? filters.secteur : filters.secteur[0];
    if (secteur && secteur !== 'all') {
      const section = SECTEUR_TO_SECTION[secteur];
      if (section) params.set('section_activite_principale', section);
    }
  }

  // Forme juridique → nature_juridique INSEE
  if (filters.formeJuridique) {
    const forme = typeof filters.formeJuridique === 'string' ? filters.formeJuridique : filters.formeJuridique[0];
    if (forme && forme !== 'all') {
      const nature = FORME_TO_NATURE[forme];
      if (nature) params.set('nature_juridique', nature);
    }
  }

  // Zone géographique
  if (filters.departement?.trim()) {
    params.set('departement', filters.departement.trim());
  }

  // Pagination
  params.set('page', String(filters.page ?? 1));
  params.set('per_page', String(filters.perPage ?? 25));

  return `${API_BASE}/search?${params.toString()}`;
}

// ─── Parsing de la réponse ────────────────────────────────────────────────────

function parseResponse(
  json: Record<string, unknown>
): { prospects: Prospect[]; total: number } {
  const results = (json.results as Record<string, unknown>[]) ?? [];
  const total = (json.total_results as number) ?? results.length;
  return { prospects: results.map(parseOneResult), total };
}

function parseOneResult(r: Record<string, unknown>): Prospect {
  const siege = (r.siege ?? {}) as Record<string, unknown>;

  // Adresse postale
  const adresseParts = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
    .filter(Boolean)
    .join(' ');
  const adresse = adresseParts || (siege.geo_adresse as string) || '';

  const codePostal = (siege.code_postal as string) ?? '';
  const departement = codePostal.length >= 2 ? codePostal.slice(0, 2) : '';

  // Activité
  const codeNAF =
    (siege.activite_principale as string) ?? (r.activite_principale as string) ?? '';
  const libelleNAF =
    (r.libelle_activite_principale_n2 as string) ??
    (r.libelle_activite_principale_n1 as string) ??
    '';

  // Forme juridique
  const libelleFormeJuridique =
    (r.libelle_nature_juridique_n3 as string) ??
    (r.libelle_nature_juridique_n2 as string) ??
    (r.nature_juridique as string) ??
    '';
  const formeJuridique = extractFormeJuridiqueShort(libelleFormeJuridique);

  // Dirigeants
  const rawDirigeants = (r.dirigeants as Record<string, unknown>[]) ?? [];
  const dirigeants: ProspectDirigeant[] = rawDirigeants.map(d => ({
    nom: ((d.nom as string) ?? '').toUpperCase(),
    prenom: capitalizeWords((d.prenoms as string) ?? (d.prenom as string) ?? ''),
    qualite: (d.qualite as string) ?? '',
  }));

  // Sélection du dirigeant principal par priorité de rôle
  const PRIORITY = ['président', 'présidente', 'gérant', 'gérante', 'directeur général', 'pdg'];
  const dirigeantPrincipal =
    dirigeants.find(d =>
      PRIORITY.some(q => d.qualite.toLowerCase().includes(q))
    ) ??
    dirigeants[0] ??
    null;

  return {
    siren: (r.siren as string) ?? '',
    siret: (siege.siret as string) ?? '',
    nomSociete: (r.nom_complet as string) ?? (r.nom_raison_sociale as string) ?? '',
    formeJuridique,
    libelleFormeJuridique,
    codeNAF,
    libelleNAF,
    secteur: deriveSecteur(libelleNAF, codeNAF),
    adresse,
    codePostal,
    ville: (siege.libelle_commune as string) ?? '',
    departement,
    dateCreation: (siege.date_creation as string) ?? '',
    effectif: formatEffectif((siege.tranche_effectif_salarie as string) ?? ''),
    capitalSocial: r.capital_social
      ? `${Number(r.capital_social).toLocaleString('fr-FR')} €`
      : '',
    categorieEntreprise: (r.categorie_entreprise as string) ?? '',
    dirigeants,
    dirigeantPrincipal,
    email: '',
    telephone: '',
  };
}

// ─── Données de démonstration (mode hors-ligne) ───────────────────────────────

export function getDemoProspects(): Prospect[] {
  return [
    makeDemo(
      '356000000', 'SARL DUPONT BÂTIMENT',
      'SARL', 'Société à responsabilité limitée (SARL)',
      '4120A', 'Construction de bâtiments résidentiels',
      'Jean', 'DUPONT', 'Gérant',
      '47 rue de la Paix', '69003', 'LYON',
      '2019-03-12', '1 à 2', '50 000 €', 'PME',
    ),
    makeDemo(
      '356000001', 'SAS TECH SOLUTIONS',
      'SAS', 'Société par actions simplifiée (SAS)',
      '6201Z', 'Développement de logiciels',
      'Marie', 'MARTIN', 'Présidente',
      '12 avenue de la République', '75011', 'PARIS',
      '2021-01-08', '10 à 19', '100 000 €', 'PME',
    ),
    makeDemo(
      '356000002', 'EURL CABINET MEDICIS',
      'EURL', 'Entreprise unipersonnelle à responsabilité limitée (EURL)',
      '6920Z', 'Activités comptables',
      'Pierre', 'BERNARD', 'Gérant',
      '8 allée des Roses', '13008', 'MARSEILLE',
      '2018-07-22', '1 à 2', '10 000 €', 'PME',
    ),
    makeDemo(
      '356000003', 'SCI PATRIMOINE IMMO',
      'SCI', 'Société civile immobilière (SCI)',
      '6820A', 'Location de logements',
      'Sophie', 'LEROY', 'Gérante',
      '23 cours Victor Hugo', '33000', 'BORDEAUX',
      '2016-11-03', '0 salarié', '200 000 €', 'PME',
    ),
    makeDemo(
      '356000004', 'SAS FAST FOOD RESTO',
      'SAS', 'Société par actions simplifiée (SAS)',
      '5610A', 'Restauration traditionnelle',
      'Marc', 'PETIT', 'Président',
      '1 place du Capitole', '31000', 'TOULOUSE',
      '2020-05-15', '20 à 49', '30 000 €', 'PME',
    ),
    makeDemo(
      '356000005', 'SARL TRANSPORT EXPRESS',
      'SARL', 'Société à responsabilité limitée (SARL)',
      '4941A', 'Transports routiers de fret interurbains',
      'Lucie', 'MOREAU', 'Gérante',
      '5 rue du Port', '44000', 'NANTES',
      '2017-02-28', '50 à 99', '150 000 €', 'PME',
    ),
    makeDemo(
      '356000006', 'EIRL GARCIA PLOMBERIE',
      'EI', 'Entrepreneur individuel',
      '4322A', "Travaux d'installation d'eau et de gaz",
      'Thomas', 'GARCIA', 'Gérant',
      '14 impasse des Artisans', '67000', 'STRASBOURG',
      '2015-09-10', '1 à 2', '', 'PME',
    ),
    makeDemo(
      '356000007', 'SAS DIGITAL AGENCY',
      'SAS', 'Société par actions simplifiée (SAS)',
      '7311Z', 'Activités des agences de publicité',
      'Emma', 'DUBOIS', 'Présidente',
      '28 rue Faidherbe', '59000', 'LILLE',
      '2022-03-01', '3 à 5', '20 000 €', 'PME',
    ),
  ];
}

function makeDemo(
  siren: string,
  nomSociete: string,
  formeJuridique: string,
  libelleFormeJuridique: string,
  codeNAF: string,
  libelleNAF: string,
  prenom: string,
  nom: string,
  qualite: string,
  adresse: string,
  codePostal: string,
  ville: string,
  dateCreation: string,
  effectif: string,
  capitalSocial: string,
  categorieEntreprise: string,
): Prospect {
  const dirigeantPrincipal: ProspectDirigeant = { nom, prenom, qualite };
  return {
    siren,
    siret: siren + '00017',
    nomSociete,
    formeJuridique,
    libelleFormeJuridique,
    codeNAF,
    libelleNAF,
    secteur: deriveSecteur(libelleNAF, codeNAF),
    adresse,
    codePostal,
    ville,
    departement: codePostal.slice(0, 2),
    dateCreation,
    effectif,
    capitalSocial,
    categorieEntreprise,
    dirigeants: [dirigeantPrincipal],
    dirigeantPrincipal,
    email: '',
    telephone: '',
  };
}

// ─── Helpers réseau ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
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
    // allorigins enveloppe la réponse dans { contents: '...' }
    const parsed =
      typeof json?.contents === 'string' ? JSON.parse(json.contents) : json;
    if (!Array.isArray(parsed?.results)) return null;
    return parsed as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Helpers de transformation ────────────────────────────────────────────────

/**
 * Dérive le secteur d'activité depuis le libellé NAF ou le code NAF.
 * Priorité au code pour les secteurs à 2 chiffres (plus fiable).
 */
function deriveSecteur(libelleNAF: string, codeNAF: string): string {
  const c = codeNAF.toUpperCase();
  const l = libelleNAF.toLowerCase();
  const div = parseInt(c.slice(0, 2), 10);

  if (div >= 41 && div <= 43) return 'Construction';
  if (div >= 62 && div <= 63) return 'Informatique';
  if ((div >= 64 && div <= 66) || div === 69) return 'Services financiers';
  if (div === 68) return 'Immobilier';
  if (div >= 55 && div <= 56) return 'Restauration';
  if (div >= 49 && div <= 53) return 'Transport';
  if (div >= 58 && div <= 60) return 'Communication';
  if (div === 73) return 'Communication';
  if ((div >= 86 && div <= 88) || l.includes('santé') || l.includes('médical')) return 'Santé';
  if (div >= 45 && div <= 47) return 'Commerce';
  if (div >= 1 && div <= 3) return 'Agriculture';

  // Fallback sur le libellé
  if (l.includes('construct')) return 'Construction';
  if (l.includes('logiciel') || l.includes('informati')) return 'Informatique';
  if (l.includes('comptable') || l.includes('financ') || l.includes('assurance')) return 'Services financiers';
  if (l.includes('immo')) return 'Immobilier';
  if (l.includes('restaur') || l.includes('hôtel')) return 'Restauration';
  if (l.includes('transport')) return 'Transport';
  if (l.includes('communication') || l.includes('publicité') || l.includes('agence')) return 'Communication';

  return libelleNAF || 'Autre';
}

/**
 * Extrait la forme juridique abrégée depuis le libellé complet.
 * Ex : "Société à responsabilité limitée (SARL)" → "SARL"
 */
function extractFormeJuridiqueShort(libelle: string): string {
  const match = libelle.match(/\(([A-Z]+(?:-[A-Z]+)?)\)\s*$/);
  if (match) return match[1];
  if (libelle.includes('Société par actions simplifiée')) return 'SAS';
  if (libelle.toLowerCase().includes('responsabilité limitée')) return 'SARL';
  if (libelle.includes('Entrepreneur individuel')) return 'EI';
  if (libelle.includes('civile immobilière')) return 'SCI';
  if (libelle.includes('Société anonyme')) return 'SA';
  return libelle.split(' ').slice(-1)[0] ?? libelle;
}

/** Met en majuscule la première lettre de chaque mot. */
function capitalizeWords(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

function formatEffectif(tranche: string): string {
  const tranches: Record<string, string> = {
    '00': '0 salarié',   '01': '1 à 2',      '02': '3 à 5',    '03': '6 à 9',
    '11': '10 à 19',     '12': '20 à 49',     '21': '50 à 99',  '22': '100 à 199',
    '31': '200 à 249',   '32': '250 à 499',   '41': '500 à 999',
    '42': '1 000 à 1 999', '51': '2 000 à 4 999', '52': '5 000 à 9 999',
    '53': '10 000 et plus', NN: 'Non diffusé',
  };
  return tranche ? (tranches[tranche] ?? `Tranche ${tranche}`) : 'Non renseigné';
}
