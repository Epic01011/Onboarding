/**
 * Excel Import/Export Utilities for Prospection Module
 *
 * Provides functions to:
 * 1. Export prospect data to Excel (.xlsx)
 * 2. Generate a template Excel file for import
 * 3. Parse and validate Excel files for import
 */

import * as XLSX from 'xlsx';
import type { Prospect } from '../services/prospectApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExcelImportResult {
  success: boolean;
  prospects: Partial<Prospect>[];
  errors: string[];
  warnings: string[];
}

// ─── Column Definitions ───────────────────────────────────────────────────────

/**
 * Column mapping for Excel import/export
 * Maps internal field names to user-friendly French column headers
 */
const EXCEL_COLUMNS = {
  siren: 'SIREN',
  siret: 'SIRET',
  nomSociete: 'Nom de la société',
  formeJuridique: 'Forme juridique',
  codeNAF: 'Code NAF',
  libelleNAF: 'Libellé NAF',
  secteur: 'Secteur',
  adresse: 'Adresse',
  codePostal: 'Code postal',
  ville: 'Ville',
  departement: 'Département',
  dateCreation: 'Date de création',
  effectif: 'Effectif',
  capitalSocial: 'Capital social',
  email: 'Email',
  telephone: 'Téléphone',
  dirigeantNom: 'Dirigeant - Nom',
  dirigeantPrenom: 'Dirigeant - Prénom',
  dirigeantQualite: 'Dirigeant - Fonction',
} as const;

// ─── Export Functions ─────────────────────────────────────────────────────────

/**
 * Exports an array of prospects to an Excel file and triggers download
 */
export function exportProspectsToExcel(prospects: Prospect[], filename = 'prospects.xlsx'): void {
  const rows = prospects.map(prospect => ({
    [EXCEL_COLUMNS.siren]: prospect.siren,
    [EXCEL_COLUMNS.siret]: prospect.siret,
    [EXCEL_COLUMNS.nomSociete]: prospect.nomSociete,
    [EXCEL_COLUMNS.formeJuridique]: prospect.formeJuridique,
    [EXCEL_COLUMNS.codeNAF]: prospect.codeNAF,
    [EXCEL_COLUMNS.libelleNAF]: prospect.libelleNAF,
    [EXCEL_COLUMNS.secteur]: prospect.secteur,
    [EXCEL_COLUMNS.adresse]: prospect.adresse,
    [EXCEL_COLUMNS.codePostal]: prospect.codePostal,
    [EXCEL_COLUMNS.ville]: prospect.ville,
    [EXCEL_COLUMNS.departement]: prospect.departement,
    [EXCEL_COLUMNS.dateCreation]: prospect.dateCreation,
    [EXCEL_COLUMNS.effectif]: prospect.effectif,
    [EXCEL_COLUMNS.capitalSocial]: prospect.capitalSocial,
    [EXCEL_COLUMNS.email]: prospect.email,
    [EXCEL_COLUMNS.telephone]: prospect.telephone,
    [EXCEL_COLUMNS.dirigeantNom]: prospect.dirigeantPrincipal?.nom || '',
    [EXCEL_COLUMNS.dirigeantPrenom]: prospect.dirigeantPrincipal?.prenom || '',
    [EXCEL_COLUMNS.dirigeantQualite]: prospect.dirigeantPrincipal?.qualite || '',
  }));

  downloadExcel(rows, filename);
}

/**
 * Generates and downloads an Excel template file for import
 * Includes headers, format hints, and example data
 */
export function downloadExcelTemplate(): void {
  const exampleRows = [
    {
      [EXCEL_COLUMNS.siren]: '123456789',
      [EXCEL_COLUMNS.siret]: '12345678900017',
      [EXCEL_COLUMNS.nomSociete]: 'EXEMPLE SARL',
      [EXCEL_COLUMNS.formeJuridique]: 'SARL',
      [EXCEL_COLUMNS.codeNAF]: '6920Z',
      [EXCEL_COLUMNS.libelleNAF]: 'Activités comptables',
      [EXCEL_COLUMNS.secteur]: 'Services financiers',
      [EXCEL_COLUMNS.adresse]: '123 rue de la Paix',
      [EXCEL_COLUMNS.codePostal]: '75001',
      [EXCEL_COLUMNS.ville]: 'PARIS',
      [EXCEL_COLUMNS.departement]: '75',
      [EXCEL_COLUMNS.dateCreation]: '2020-01-15',
      [EXCEL_COLUMNS.effectif]: '10 à 19',
      [EXCEL_COLUMNS.capitalSocial]: '50 000 €',
      [EXCEL_COLUMNS.email]: 'contact@exemple.fr',
      [EXCEL_COLUMNS.telephone]: '01 23 45 67 89',
      [EXCEL_COLUMNS.dirigeantNom]: 'DUPONT',
      [EXCEL_COLUMNS.dirigeantPrenom]: 'Jean',
      [EXCEL_COLUMNS.dirigeantQualite]: 'Gérant',
    },
    {
      [EXCEL_COLUMNS.siren]: '987654321',
      [EXCEL_COLUMNS.siret]: '98765432100012',
      [EXCEL_COLUMNS.nomSociete]: 'TECH SOLUTIONS SAS',
      [EXCEL_COLUMNS.formeJuridique]: 'SAS',
      [EXCEL_COLUMNS.codeNAF]: '6201Z',
      [EXCEL_COLUMNS.libelleNAF]: 'Programmation informatique',
      [EXCEL_COLUMNS.secteur]: 'Informatique',
      [EXCEL_COLUMNS.adresse]: '45 avenue des Champs',
      [EXCEL_COLUMNS.codePostal]: '69002',
      [EXCEL_COLUMNS.ville]: 'LYON',
      [EXCEL_COLUMNS.departement]: '69',
      [EXCEL_COLUMNS.dateCreation]: '2021-06-20',
      [EXCEL_COLUMNS.effectif]: '20 à 49',
      [EXCEL_COLUMNS.capitalSocial]: '100 000 €',
      [EXCEL_COLUMNS.email]: 'info@tech-solutions.fr',
      [EXCEL_COLUMNS.telephone]: '04 78 90 12 34',
      [EXCEL_COLUMNS.dirigeantNom]: 'MARTIN',
      [EXCEL_COLUMNS.dirigeantPrenom]: 'Marie',
      [EXCEL_COLUMNS.dirigeantQualite]: 'Présidente',
    },
  ];

  downloadExcel(exampleRows, 'modele_import_prospects.xlsx', true);
}

/**
 * Helper: Creates Excel workbook and triggers browser download
 */
function downloadExcel(
  rows: Record<string, string | number>[],
  filename: string,
  isTemplate = false
): void {
  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 12 },  // SIREN
    { wch: 16 },  // SIRET
    { wch: 30 },  // Nom société
    { wch: 12 },  // Forme juridique
    { wch: 10 },  // Code NAF
    { wch: 35 },  // Libellé NAF
    { wch: 20 },  // Secteur
    { wch: 35 },  // Adresse
    { wch: 10 },  // Code postal
    { wch: 20 },  // Ville
    { wch: 10 },  // Département
    { wch: 12 },  // Date création
    { wch: 15 },  // Effectif
    { wch: 15 },  // Capital
    { wch: 25 },  // Email
    { wch: 16 },  // Téléphone
    { wch: 20 },  // Dirigeant nom
    { wch: 20 },  // Dirigeant prénom
    { wch: 20 },  // Dirigeant qualité
  ];
  worksheet['!cols'] = columnWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, isTemplate ? 'Modèle' : 'Prospects');

  // If template, add an instructions sheet
  if (isTemplate) {
    const instructions = [
      { Info: 'INSTRUCTIONS D\'UTILISATION DU MODÈLE' },
      { Info: '' },
      { Info: '1. Supprimez les lignes d\'exemple (lignes 2 et 3)' },
      { Info: '2. Remplissez vos données en respectant le format des colonnes' },
      { Info: '3. Les colonnes SIREN, Nom de la société et Secteur sont obligatoires' },
      { Info: '4. Les autres colonnes sont optionnelles mais recommandées' },
      { Info: '' },
      { Info: 'FORMATS ATTENDUS :' },
      { Info: '' },
      { Info: '- SIREN : 9 chiffres (ex: 123456789)' },
      { Info: '- SIRET : 14 chiffres (ex: 12345678900017)' },
      { Info: '- Code postal : 5 chiffres (ex: 75001)' },
      { Info: '- Date de création : AAAA-MM-JJ (ex: 2020-01-15)' },
      { Info: '- Email : format valide (ex: contact@exemple.fr)' },
      { Info: '- Téléphone : format français (ex: 01 23 45 67 89)' },
      { Info: '' },
      { Info: 'VALEURS ACCEPTÉES :' },
      { Info: '' },
      { Info: 'Forme juridique : SAS, SARL, EURL, SA, SCI, EI, Association' },
      { Info: 'Secteur : Construction, Informatique, Commerce, Restauration,' },
      { Info: '         Transport, Communication, Services financiers, Immobilier, Santé' },
      { Info: 'Effectif : 0 salarié, 1 à 2, 3 à 5, 6 à 9, 10 à 19, 20 à 49,' },
      { Info: '          50 à 99, 100 à 199, 200 à 499, 500+' },
    ];
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  }

  // Generate Excel file and trigger download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Import Functions ─────────────────────────────────────────────────────────

/**
 * Parses an Excel file and returns validated prospect data
 */
export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prospects: Partial<Prospect>[] = [];

  try {
    // Read file as array buffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get first sheet (or sheet named "Prospects" or "Modèle")
    const sheetName = workbook.SheetNames.find(name =>
      name === 'Prospects' || name === 'Modèle'
    ) || workbook.SheetNames[0];

    if (!sheetName) {
      errors.push('Le fichier Excel ne contient aucune feuille de données');
      return { success: false, prospects: [], errors, warnings };
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,  // Keep as strings for validation
      defval: '',  // Default empty cells to empty string
    });

    if (rawData.length === 0) {
      errors.push('Le fichier Excel ne contient aucune donnée');
      return { success: false, prospects: [], errors, warnings };
    }

    // Validate and parse each row
    rawData.forEach((row, index) => {
      const rowNum = index + 2; // Excel row number (1-indexed + header)
      const prospect = parseExcelRow(row, rowNum, errors, warnings);
      if (prospect) {
        prospects.push(prospect);
      }
    });

    if (prospects.length === 0 && errors.length > 0) {
      return { success: false, prospects: [], errors, warnings };
    }

    if (prospects.length === 0) {
      errors.push('Aucun prospect valide n\'a pu être extrait du fichier');
      return { success: false, prospects: [], errors, warnings };
    }

    return {
      success: true,
      prospects,
      errors,
      warnings,
    };

  } catch (error) {
    errors.push(`Erreur lors de la lecture du fichier : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    return { success: false, prospects: [], errors, warnings };
  }
}

/**
 * Parses a single Excel row into a Prospect object with validation
 */
function parseExcelRow(
  row: Record<string, unknown>,
  rowNum: number,
  errors: string[],
  warnings: string[]
): Partial<Prospect> | null {
  const prospect: Partial<Prospect> = {};
  let hasRequiredFields = true;

  // Helper to get value from row (handles both French and English headers)
  const getValue = (key: keyof typeof EXCEL_COLUMNS): string => {
    const frenchHeader = EXCEL_COLUMNS[key];
    const value = row[frenchHeader] || row[key] || '';
    return String(value).trim();
  };

  // ── Required fields ──────────────────────────────────────────────────────

  const siren = getValue('siren');
  if (!siren) {
    errors.push(`Ligne ${rowNum}: SIREN manquant (champ obligatoire)`);
    hasRequiredFields = false;
  } else if (!/^\d{9}$/.test(siren)) {
    errors.push(`Ligne ${rowNum}: SIREN invalide "${siren}" (doit contenir 9 chiffres)`);
    hasRequiredFields = false;
  } else {
    prospect.siren = siren;
  }

  const nomSociete = getValue('nomSociete');
  if (!nomSociete) {
    errors.push(`Ligne ${rowNum}: Nom de société manquant (champ obligatoire)`);
    hasRequiredFields = false;
  } else {
    prospect.nomSociete = nomSociete;
  }

  if (!hasRequiredFields) {
    return null;
  }

  // ── Optional but validated fields ────────────────────────────────────────

  const siret = getValue('siret');
  if (siret) {
    if (!/^\d{14}$/.test(siret)) {
      warnings.push(`Ligne ${rowNum}: SIRET invalide "${siret}" (doit contenir 14 chiffres)`);
    } else if (!siret.startsWith(siren)) {
      warnings.push(`Ligne ${rowNum}: SIRET ne commence pas par le SIREN`);
    } else {
      prospect.siret = siret;
    }
  } else {
    // Generate SIRET from SIREN if not provided
    prospect.siret = siren + '00017';
  }

  // Email validation
  const email = getValue('email');
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push(`Ligne ${rowNum}: Email invalide "${email}"`);
    } else {
      prospect.email = email;
    }
  } else {
    prospect.email = '';
  }

  // Telephone
  prospect.telephone = getValue('telephone') || '';

  // Code postal validation
  const codePostal = getValue('codePostal');
  if (codePostal) {
    if (!/^\d{5}$/.test(codePostal)) {
      warnings.push(`Ligne ${rowNum}: Code postal invalide "${codePostal}" (doit contenir 5 chiffres)`);
    } else {
      prospect.codePostal = codePostal;
      prospect.departement = codePostal.slice(0, 2);
    }
  } else {
    prospect.codePostal = '';
    prospect.departement = '';
  }

  // ── Direct mapping fields ────────────────────────────────────────────────

  prospect.formeJuridique = getValue('formeJuridique') || '';
  prospect.libelleFormeJuridique = prospect.formeJuridique;
  prospect.codeNAF = getValue('codeNAF') || '';
  prospect.libelleNAF = getValue('libelleNAF') || '';
  prospect.secteur = getValue('secteur') || 'Autre';
  prospect.adresse = getValue('adresse') || '';
  prospect.ville = getValue('ville') || '';
  prospect.dateCreation = getValue('dateCreation') || '';
  prospect.effectif = getValue('effectif') || '';
  prospect.capitalSocial = getValue('capitalSocial') || '';
  prospect.categorieEntreprise = 'PME';

  // ── Dirigeant information ────────────────────────────────────────────────

  const dirigeantNom = getValue('dirigeantNom');
  const dirigeantPrenom = getValue('dirigeantPrenom');
  const dirigeantQualite = getValue('dirigeantQualite');

  if (dirigeantNom || dirigeantPrenom) {
    const dirigeant = {
      nom: dirigeantNom.toUpperCase(),
      prenom: dirigeantPrenom,
      qualite: dirigeantQualite || 'Dirigeant',
    };
    prospect.dirigeants = [dirigeant];
    prospect.dirigeantPrincipal = dirigeant;
  } else {
    prospect.dirigeants = [];
    prospect.dirigeantPrincipal = null;
  }

  return prospect;
}

/**
 * Validates file before parsing
 */
export function validateExcelFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return {
      valid: false,
      error: 'Le fichier doit être au format Excel (.xlsx ou .xls)',
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Le fichier ne doit pas dépasser 10 Mo',
    };
  }

  return { valid: true };
}
