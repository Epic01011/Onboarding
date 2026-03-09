/**
 * sharepointGed.ts — Gestion Électronique des Documents (GED) SharePoint
 *
 * Crée et maintient la structure de dossiers clients dans SharePoint :
 *
 *   Clients CabinetFlow/
 *     {SIREN} - {RaisonSociale}/
 *       01 - Lettre de mission/
 *       02 - Documents juridiques/
 *       03 - Comptabilité/
 *       04 - Fiscal/
 *       05 - Social/
 *       06 - Documents client/      ← dépôt client
 *       07 - Correspondances/
 *       08 - Délégations/
 */

import {
  createSharePointFolder,
  createSharePointSharingLink,
  getSharePointItemByPath,
  listSharePointFolder,
} from './microsoftGraph';

/** Dossier racine dans la bibliothèque Documents du site SharePoint */
export const GED_ROOT = 'Clients CabinetFlow';

/** Sous-dossier où le client dépose ses pièces */
export const GED_DOCS_CLIENT = '06 - Documents client';

/** Sous-dossiers standard pour chaque dossier client */
export const GED_SUBFOLDERS: { name: string; description: string; icon: string }[] = [
  { name: '01 - Lettre de mission',    description: 'Lettre de mission signée + avenants', icon: '📄' },
  { name: '02 - Documents juridiques', description: 'KBIS, statuts, pièces d\'identité', icon: '⚖️' },
  { name: '03 - Comptabilité',         description: 'Bilans, comptes annuels, grand livre', icon: '📊' },
  { name: '04 - Fiscal',               description: 'Déclarations IS, TVA, liasses fiscales', icon: '🯧' },
  { name: '05 - Social',               description: 'Bulletins de paie, contrats, DSN', icon: '👥' },
  { name: '06 - Documents client',     description: 'Documents divers transmis par le client', icon: '📂' },
  { name: '07 - Correspondances',      description: 'Emails, courriers, lettre confraternelle', icon: '📧' },
  { name: '08 - Délégations',          description: 'Mandats impôts, URSSAF, pouvoir', icon: '🔑' },
];

/**
 * Nettoie le nom pour un nom de dossier SharePoint valide.
 * Interdit : / \ : * ? " < > | et # %
 */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|#%]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Construit le nom du dossier client : "{SIREN} - {RaisonSociale}" */
export function buildClientFolderName(siren: string, raisonSociale: string): string {
  const safeName = sanitizeFolderName(raisonSociale || 'Sans nom');
  return siren ? `${siren} - ${safeName}` : safeName;
}

/** Chemin complet du dossier client dans SharePoint */
export function buildClientFolderPath(siren: string, raisonSociale: string): string {
  return `${GED_ROOT}/${buildClientFolderName(siren, raisonSociale)}`;
}

/** Chemin du sous-dossier de dépôt client */
export function buildDocsClientPath(siren: string, raisonSociale: string): string {
  return `${buildClientFolderPath(siren, raisonSociale)}/${GED_DOCS_CLIENT}`;
}

/**
 * Provisionne la structure complète pour un nouveau client.
 * Retourne l'URL et l'ID du dossier client + le chemin GED.
 */
export async function provisionClientFolder(
  token: string,
  siteId: string,
  siren: string,
  raisonSociale: string,
): Promise<{ folderId: string; folderUrl: string; clientFolderName: string }> {
  const clientFolderName = buildClientFolderName(siren, raisonSociale);

  await createSharePointFolder(token, siteId, '', GED_ROOT);

  const clientFolder = await createSharePointFolder(
    token,
    siteId,
    GED_ROOT,
    clientFolderName,
  );

  const clientPath = `${GED_ROOT}/${clientFolderName}`;
  await Promise.allSettled(
    GED_SUBFOLDERS.map(sub =>
      createSharePointFolder(token, siteId, clientPath, sub.name),
    ),
  );

  return {
    folderId: clientFolder.id,
    folderUrl: clientFolder.webUrl,
    clientFolderName,
  };
}

/**
 * Crée un lien de partage anonyme (edit) sur le sous-dossier "06 - Documents client".
 * Ce lien est envoyé au client pour qu'il dépose ses pièces directement dans SharePoint.
 *
 * type  : 'edit'      (le client peut déposer et modifier)
 * scope : 'anonymous' (pas de connexion Microsoft requise)
 */
export async function createClientUploadLink(
  token: string,
  siteId: string,
  siren: string,
  raisonSociale: string,
): Promise<string> {
  const docsPath = buildDocsClientPath(siren, raisonSociale);
  const item = await getSharePointItemByPath(token, siteId, docsPath);
  const link = await createSharePointSharingLink(token, siteId, item.id, 'edit', 'anonymous');
  return link.link.webUrl;
}

// ─── Interface résultat scan ──────────────────────────────────────────────────────────────────

export interface ScannedDocument {
  id: string;
  name: string;
  required: boolean;
  foundInSharePoint: boolean;
  /** Fichier trouvé dans SharePoint */
  sharepointFile?: {
    id: string;
    name: string;
    webUrl: string;
    size: number;
    lastModifiedDateTime: string;
  };
}

/**
 * Scanne le dossier "06 - Documents client" dans SharePoint
 * et associe les fichiers trouvés aux documents attendus par correspondance fuzzy.
 *
 * La correspondance est basée sur les mots-clés du nom attendu :
 *   - "Pièce d'identité du dirigeant" → cherche "identit", "dirigeant" dans le nom du fichier
 *   - "Extrait KBIS" → cherche "kbis"
 *   - "Statuts de la société" → cherche "statuts"
 *
 * Les mots de moins de 4 caractères sont ignorés (articles, prépositions).
 */
export async function scanClientDocuments(
  token: string,
  siteId: string,
  siren: string,
  raisonSociale: string,
  expectedDocs: Array<{ id: string; name: string; required: boolean }>,
): Promise<ScannedDocument[]> {
  const docsPath = buildDocsClientPath(siren, raisonSociale);

  let files: Awaited<ReturnType<typeof listSharePointFolder>> = [];
  try {
    files = await listSharePointFolder(token, siteId, docsPath);
    // Filtre uniquement les fichiers (pas les sous-dossiers)
    files = files.filter(f => !!f.file);
  } catch {
    files = [];
  }

  return expectedDocs.map(doc => {
    // Extrait les mots-clés significatifs du nom attendu
    const keywords = doc.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire les accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4);

    const match = files.find(f => {
      const fname = f.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ');
      // Le fichier doit contenir au moins 1 mot-clé significatif
      return keywords.some(kw => fname.includes(kw));
    });

    return {
      id: doc.id,
      name: doc.name,
      required: doc.required,
      foundInSharePoint: !!match,
      sharepointFile: match
        ? {
            id: match.id,
            name: match.name,
            webUrl: match.webUrl,
            size: match.size ?? 0,
            lastModifiedDateTime: match.lastModifiedDateTime ?? '',
          }
        : undefined,
    };
  });
}
