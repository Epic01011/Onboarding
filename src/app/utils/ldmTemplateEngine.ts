/**
 * ldmTemplateEngine.ts
 *
 * Template engine for Lettres de Mission (LDM).
 *
 * Key responsibilities:
 *  1. formatTemplate(text, data)            — replaces all {{variable}} placeholders
 *  2. buildPricingLinesFromBreakdown(vqd)   — converts ValidatedQuoteBreakdown → PricingLine[]
 *  3. buildListeMissionsPrincipales(lines)  — Tenue / Révision / Fiscal lines → formatted string
 *  4. buildListeOptionsSouscrites(lines)    — Social / Conseil / add-on lines → formatted string
 *  5. buildLdmVariables(form, lines?)       — assembles the full {{…}} replacement map
 *  6. fetchDocumentContent(typeMission)     — fetches raw `contenu` from Supabase `documents` table
 *  7. buildAnnexesHtml(config)              — generates HTML for all selected annexes
 *
 * Formatting convention (per spec):
 *   - [Libellé] : [Note] ([montant] € HT/mois)
 */

import type { ValidatedQuoteBreakdown } from '../components/DocumentPreview';
import type { PricingLine } from '../../components/crm/ProposalPricingEngine';
import type { LdmConfigState } from '../components/StepLdmConfig';
import { OPTION_PRICES } from './pricingLogic';
import { supabase } from './supabaseClient';
import { getCabinetInfo } from './servicesStorage';
import { CGV } from '../../data/cgv';

// ─── Payment clause (Article 4 — always injected) ────────────────────────────

export const CLAUSE_PAIEMENT =
  'Facturation : Début de mois • Règlement par prélèvement automatique • Pénalités de retard : 3× taux légal + 40 €';

// ─── Line classification ──────────────────────────────────────────────────────

/** Keywords that identify a "mission principale" (core accounting line). */
const PRINCIPALE_KEYWORDS = ['tenue', 'révision', 'bilan', 'fiscal', 'déclarations fiscales'];

function isMissionPrincipale(line: PricingLine): boolean {
  const lc = line.label.toLowerCase();
  return PRINCIPALE_KEYWORDS.some(k => lc.includes(k));
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Format a number as a French locale integer string (no decimals). */
function fmtAmount(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Parse a price string that may contain spaces and a French decimal comma. */
function parsePrice(value: string): number {
  return parseFloat(value.replace(/\s/g, '').replace(',', '.') || '0');
}

/** Regex pattern for `{{variable_name}}` placeholders. */
const VARIABLE_PLACEHOLDER_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Format a single pricing line per the required convention:
 *   - [Libellé] : [Note] ([montant] € HT/mois)
 * When there is no note, the format becomes:
 *   - [Libellé] ([montant] € HT/mois)
 */
function formatPricingLine(line: PricingLine): string {
  const amount = `${fmtAmount(line.montantMensuel)} € HT/mois`;
  if (line.note) {
    return `- ${line.label} : ${line.note} (${amount})`;
  }
  return `- ${line.label} (${amount})`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build `{{liste_missions_principales}}` from a set of pricing lines.
 * Includes: Tenue, Révision, Fiscal lines.
 * Returns a newline-separated string of formatted lines.
 */
export function buildListeMissionsPrincipales(lines: PricingLine[]): string {
  return lines
    .filter(isMissionPrincipale)
    .map(formatPricingLine)
    .join('\n');
}

/**
 * Build `{{liste_options_souscrites}}` from a set of pricing lines.
 * Includes: Social/Paie + Conseil/add-on lines.
 * Returns a newline-separated string of formatted lines, or an empty string.
 */
export function buildListeOptionsSouscrites(lines: PricingLine[]): string {
  return lines
    .filter(l => !isMissionPrincipale(l))
    .map(formatPricingLine)
    .join('\n');
}

/**
 * Convert a `ValidatedQuoteBreakdown` (from Supabase `quote_data`) into the
 * `PricingLine[]` format used by the template engine.
 *
 * This is the bridge between the `pricingLogic.ts` world (SavedQuote /
 * ValidatedQuoteBreakdown) and the `ProposalPricingEngine.tsx` world (PricingLine[]).
 */
export function buildPricingLinesFromBreakdown(vqd: ValidatedQuoteBreakdown): PricingLine[] {
  const lines: PricingLine[] = [];

  if (vqd.monthlyAccountingPrice > 0) {
    lines.push({
      label: 'Tenue comptable & saisie',
      heures: 0,
      tauxHoraire: 0,
      montantAnnuel: vqd.monthlyAccountingPrice * 12,
      montantMensuel: vqd.monthlyAccountingPrice,
    });
  }

  if (vqd.monthlyClosurePrice > 0) {
    lines.push({
      label: 'Révision annuelle & établissement du bilan',
      heures: 0,
      tauxHoraire: 0,
      montantAnnuel: vqd.monthlyClosurePrice * 12,
      montantMensuel: vqd.monthlyClosurePrice,
      note: 'Forfait annuel',
    });
  }

  if (vqd.monthlySocialPrice > 0) {
    const bulletins = vqd.bulletinsPerMonth ?? 0;
    lines.push({
      label: 'Gestion de la paie & déclarations sociales',
      heures: 0,
      tauxHoraire: 0,
      montantAnnuel: vqd.monthlySocialPrice * 12,
      montantMensuel: vqd.monthlySocialPrice,
      note: bulletins > 0 ? `${bulletins} bulletin${bulletins > 1 ? 's' : ''}/mois` : undefined,
    });
  }

  // Individual add-on options
  const opts = vqd.options;
  if (opts?.ticketsSupport5an) {
    lines.push({
      label: '5 tickets support / an',
      heures: 0, tauxHoraire: 0,
      montantAnnuel: OPTION_PRICES.ticketsSupport5an * 12,
      montantMensuel: OPTION_PRICES.ticketsSupport5an,
    });
  }
  if (opts?.whatsappDedie) {
    lines.push({
      label: 'Ligne WhatsApp dédiée',
      heures: 0, tauxHoraire: 0,
      montantAnnuel: OPTION_PRICES.whatsappDedie * 12,
      montantMensuel: OPTION_PRICES.whatsappDedie,
    });
  }
  if (opts?.appelsPrioritaires) {
    lines.push({
      label: 'Appels prioritaires compris',
      heures: 0, tauxHoraire: 0,
      montantAnnuel: OPTION_PRICES.appelsPrioritaires * 12,
      montantMensuel: OPTION_PRICES.appelsPrioritaires,
    });
  }
  if (opts?.assembleGenerale) {
    lines.push({
      label: 'Assemblée générale & dépôt des comptes',
      heures: 0, tauxHoraire: 0,
      montantAnnuel: OPTION_PRICES.assembleGenerale * 12,
      montantMensuel: OPTION_PRICES.assembleGenerale,
    });
  }

  return lines;
}

// ─── Tableau des honoraires ───────────────────────────────────────────────────

/**
 * Build `{{tableau_honoraires}}` — an HTML table rendering the full fee
 * breakdown from a `ValidatedQuoteBreakdown`.
 *
 * The table includes:
 *  - Each recurring service line with its monthly and annual amounts
 *  - A "Total mensuel HT" summary row
 *  - A "Frais d'intégration" (setup fees) row
 *
 * Returns an empty string when `vqd` is null/undefined.
 */
export function buildTableauHonoraires(
  vqd: ValidatedQuoteBreakdown | null | undefined,
  lines?: PricingLine[],
): string {
  if (!vqd) return '';

  const effectiveLines: PricingLine[] = lines && lines.length > 0
    ? lines
    : buildPricingLinesFromBreakdown(vqd);

  if (effectiveLines.length === 0) return '';

  // ── Style constants ──────────────────────────────────────────────────────────
  const TD  = 'padding:6px 12px;border:1px solid #e5e7eb;font-size:13px;';
  const TDR = `${TD}text-align:right;`;
  const TH  = 'padding:8px 12px;border:1px solid #d1d5db;background:#f3f4f6;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#374151;';
  const THR = `${TH}text-align:right;`;
  const SUM = 'padding:8px 12px;border:1px solid #d1d5db;background:#eff6ff;font-weight:700;font-size:13px;';
  const SUMR = `${SUM}text-align:right;`;
  const TDA = `${TD}color:#92400e;`;
  const TDAR = `${TDR}color:#92400e;`;

  const dataRows = effectiveLines
    .map(l => `
      <tr>
        <td style="${TD}">${l.label}${l.note ? ` <span style="color:#6b7280;font-size:12px;">(${l.note})</span>` : ''}</td>
        <td style="${TDR}">${fmtAmount(l.montantMensuel)} €</td>
        <td style="${TDR}">${fmtAmount(l.montantAnnuel)} €</td>
      </tr>`)
    .join('');

  const totalMensuel = effectiveLines.reduce((s, l) => s + l.montantMensuel, 0);
  const totalAnnuel  = effectiveLines.reduce((s, l) => s + l.montantAnnuel,  0);

  const setupRow = vqd.setupFees > 0
    ? `<tr>
        <td style="${TDA}">Frais d'intégration <span style="color:#6b7280;font-size:12px;">(une seule fois)</span></td>
        <td style="${TDAR}">${fmtAmount(vqd.setupFees)} €</td>
        <td style="${TDAR}">${fmtAmount(vqd.setupFees)} €</td>
      </tr>`
    : '';

  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;">
  <thead>
    <tr>
      <th style="${TH}">Mission / Service</th>
      <th style="${THR}">Mensuel HT</th>
      <th style="${THR}">Annuel HT</th>
    </tr>
  </thead>
  <tbody>
    ${dataRows}
    ${setupRow}
  </tbody>
  <tfoot>
    <tr>
      <td style="${SUM}">Total mensuel HT (récurrent)</td>
      <td style="${SUMR}">${fmtAmount(totalMensuel)} €</td>
      <td style="${SUMR}">${fmtAmount(totalAnnuel)} €</td>
    </tr>
  </tfoot>
</table>`;
}

// ─── Variable map builder ─────────────────────────────────────────────────────

export interface LdmVariableMap {
  // Cabinet
  cabinet_nom: string;
  cabinet_adresse: string;
  cabinet_ville: string;
  cabinet_siren: string;
  cabinet_expert: string;
  cabinet_telephone: string;
  cabinet_email: string;
  // Client
  client_genre: string;
  client_prenom: string;
  client_nom: string;
  client_raison_sociale: string;
  client_siren: string;
  client_email: string;
  client_adresse: string;
  client_forme_juridique: string;
  client_activite: string;
  client_statut_dirigeant: string;
  // Dates
  date_effet: string;
  date_rapprochement: string;
  date_revision_annuelle: string;
  delai_preavis_revision: string;
  indice_base_trimestre: string;
  indice_base_annee: string;
  indice_base_valeur: string;
  // Honoraires
  honoraires_mensuels_ht: string;
  honoraires_annuels_ht: string;
  // Missions
  liste_missions_principales: string;
  liste_options_souscrites: string;
  /** Full HTML fee-breakdown table (missions + setup fees). */
  tableau_honoraires: string;
  // Paiement
  clause_paiement: string;
  // Other
  date_du_jour: string;
  [key: string]: string;
}

/**
 * Builds the full `{{variable}}` replacement map from form data + optional
 * pricing lines.  Safe to call without `lines` — honoraires fields will be
 * derived from `prixAnnuel` in that case.
 *
 * Pass `validatedQuoteData` to populate the `{{tableau_honoraires}}` variable
 * with a fully-formatted HTML fee-breakdown table (missions + setup fees).
 */
export function buildLdmVariables(
  form: {
    clientGenre: string;
    clientPrenom: string;
    clientNom: string;
    clientRaisonSociale: string;
    clientSiren: string;
    clientEmail: string;
    clientAdresse: string;
    clientFormeJuridique: string;
    clientActivite: string;
    clientStatutDirigeant: string;
    prixAnnuel: string;
    dateEffet: string;
    dateRapprochement: string;
    dateRevisionAnnuelle: string;
    delaiPreavisRevision: string;
    indiceBaseTrimestre: string;
    indiceBaseAnnee: string;
    indiceBaseValeur: string;
  },
  lines?: PricingLine[],
  validatedQuoteData?: ValidatedQuoteBreakdown | null,
): LdmVariableMap {
  const cabinet = getCabinetInfo();
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Derive honoraires from pricing lines when available, otherwise from prixAnnuel
  const annuelFromForm = parsePrice(form.prixAnnuel);
  const totalMensuel = lines
    ? lines.reduce((s, l) => s + l.montantMensuel, 0)
    : Math.round(annuelFromForm / 12);
  const totalAnnuel = lines
    ? lines.reduce((s, l) => s + l.montantAnnuel, 0)
    : annuelFromForm;

  return {
    // Cabinet
    cabinet_nom:       cabinet.nom       || 'HAYOT EXPERTISE',
    cabinet_adresse:   cabinet.adresse   || '',
    cabinet_ville:     cabinet.ville     || 'Paris',
    cabinet_siren:     cabinet.siren     || '942 525 098',
    cabinet_expert:    cabinet.expertNom || 'Samuel Hayot',
    cabinet_telephone: cabinet.telephone || '06 09 28 93 99',
    cabinet_email:     cabinet.expertEmail || 'contact@hayot-expertise.fr',
    // Client
    client_genre:            form.clientGenre,
    client_prenom:           form.clientPrenom,
    client_nom:              form.clientNom,
    client_raison_sociale:   form.clientRaisonSociale || form.clientNom,
    client_siren:            form.clientSiren,
    client_email:            form.clientEmail,
    client_adresse:          form.clientAdresse,
    client_forme_juridique:  form.clientFormeJuridique,
    client_activite:         form.clientActivite,
    client_statut_dirigeant: form.clientStatutDirigeant,
    // Dates
    date_effet:              form.dateEffet,
    date_rapprochement:      form.dateRapprochement,
    date_revision_annuelle:  form.dateRevisionAnnuelle,
    delai_preavis_revision:  form.delaiPreavisRevision || '30',
    indice_base_trimestre:   form.indiceBaseTrimestre,
    indice_base_annee:       form.indiceBaseAnnee,
    indice_base_valeur:      form.indiceBaseValeur,
    // Honoraires — from pricing engine or fallback
    honoraires_mensuels_ht: fmtAmount(totalMensuel),
    honoraires_annuels_ht:  fmtAmount(totalAnnuel),
    // Mission lists
    liste_missions_principales: lines ? buildListeMissionsPrincipales(lines) : '',
    liste_options_souscrites:   lines ? buildListeOptionsSouscrites(lines)   : '',
    // Full fee-breakdown table (HTML)
    tableau_honoraires: buildTableauHonoraires(validatedQuoteData, lines),
    // Payment clause
    clause_paiement: CLAUSE_PAIEMENT,
    // Utility
    date_du_jour: today,
  };
}

// ─── Template substitution ────────────────────────────────────────────────────

/**
 * Replace every `{{variable_name}}` placeholder in `text` with the
 * corresponding value from `data`.
 *
 * Special rendering:
 *  - `{{liste_missions_principales}}` / `{{liste_options_souscrites}}`: each
 *    line (starting with "- ") is rendered as an HTML `<li>` inside a `<ul>`.
 *  - Literal `\n` sequences in the template are preserved (whitespace-pre-line
 *    in the component, or converted to `<br>` for HTML output).
 *  - Unresolved placeholders are left unchanged.
 */
export function formatTemplate(
  text: string,
  data: Record<string, string>,
): string {
  // Reset lastIndex so the global regex can be reused safely
  VARIABLE_PLACEHOLDER_PATTERN.lastIndex = 0;
  return text.replace(VARIABLE_PLACEHOLDER_PATTERN, (_match, key: string) => {
    if (!(key in data)) return `{{${key}}}`;
    const value = data[key];

    // Render multi-line list values as proper HTML <ul>
    if (key === 'liste_missions_principales' || key === 'liste_options_souscrites') {
      if (!value.trim()) return '<em style="color:#9ca3af;">—</em>';
      const items = value
        .split('\n')
        .filter(l => l.trim())
        .map(l => {
          const clean = l.startsWith('- ') ? l.slice(2) : l;
          return `<li style="margin-bottom:4px;">${clean}</li>`;
        })
        .join('');
      return `<ul style="padding-left:18px;margin:6px 0;">${items}</ul>`;
    }

    return value;
  });
}

// ─── Supabase document fetchers ──────────────────────────────────────────────

/**
 * Fetch the raw `contenu` of the document matching `slug` from the Supabase
 * `documents` table.
 *
 * Look-up order:
 *   1. Document matching the given `slug` (column added in migration 5)
 *   2. Fall back to the default 'mission' document (is_default = true)
 *   3. Fall back to the most recent 'mission' document
 *
 * Returns an empty string when no document is found or on error.
 */
export async function fetchDocumentBySlug(slug: string): Promise<string> {
  try {
    const { data: bySlug } = await supabase
      .from('documents')
      .select('contenu')
      .eq('slug', slug)
      .maybeSingle();

    if (bySlug?.contenu) return bySlug.contenu as string;

    // Fall back to the generic 'mission' default
    return fetchDocumentContent('mission');
  } catch (err) {
    console.warn('[ldmTemplateEngine] fetchDocumentBySlug error:', err);
    return '';
  }
}

/**
 * Fetch the raw `contenu` of the default document matching `typeMission`
 * from the Supabase `documents` table.
 *
 * Look-up order:
 *   1. Default document (is_default = true) of given type
 *   2. Most recent document of given type
 *
 * Returns an empty string when no document is found or on error.
 */
export async function fetchDocumentContent(
  typeMission: 'mission' | 'confraternal' | 'mandat_creation',
): Promise<string> {
  try {
    // Try default first
    const { data: defaultDoc } = await supabase
      .from('documents')
      .select('contenu')
      .eq('type', typeMission)
      .eq('is_default', true)
      .maybeSingle();

    if (defaultDoc?.contenu) return defaultDoc.contenu as string;

    // Fall back to most recent
    const { data: recent } = await supabase
      .from('documents')
      .select('contenu')
      .eq('type', typeMission)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (recent?.contenu as string) ?? '';
  } catch (err) {
    console.warn('[ldmTemplateEngine] fetchDocumentContent error:', err);
    return '';
  }
}

// ─── Annexes HTML builders ────────────────────────────────────────────────────

const ANNEX_PAGE_BREAK = `<div style="page-break-before:always;"></div>`;

/** Build an HTML page for the CGV from the static CGV data. */
function buildCgvHtml(): string {
  const cabinet = getCabinetInfo();
  const cabinetName = cabinet.nom || CGV.cabinet;

  const articleRows = CGV.articles
    .map(
      art => `
      <div style="margin-bottom:20px;">
        <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">
          Article ${art.id} — ${art.titre}
        </h3>
        ${art.contenu
          .map(
            p =>
              `<p style="font-size:11px;line-height:1.6;color:#374151;margin:0 0 6px;text-align:justify;">${p}</p>`,
          )
          .join('')}
      </div>`,
    )
    .join('');

  return `
    <div style="font-family:'Times New Roman',serif;max-width:680px;margin:0 auto;padding:32px 40px;">
      <div style="text-align:center;margin-bottom:28px;border-bottom:2px solid #1e3a5f;padding-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">CONDITIONS GÉNÉRALES</h2>
        <p style="font-size:12px;color:#6b7280;margin:0;">${cabinetName} — Version ${CGV.version} (${CGV.dateMAJ})</p>
      </div>
      ${articleRows}
    </div>`;
}

/** Build an HTML page for the RGPD annex. */
function buildRgpdHtml(): string {
  const cabinet = getCabinetInfo();
  const cabinetName = cabinet.nom || 'HAYOT EXPERTISE';

  return `
    <div style="font-family:'Times New Roman',serif;max-width:680px;margin:0 auto;padding:32px 40px;">
      <div style="text-align:center;margin-bottom:28px;border-bottom:2px solid #1e3a5f;padding-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">ANNEXE — TRAITEMENT DES DONNÉES PERSONNELLES (RGPD)</h2>
        <p style="font-size:12px;color:#6b7280;margin:0;">${cabinetName}</p>
      </div>
      <p style="font-size:11px;line-height:1.7;color:#374151;margin-bottom:12px;text-align:justify;">
        Conformément au Règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 modifiée, le Cabinet traite des données à caractère personnel dans le cadre de l'exécution de la Mission.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">1. Responsable du traitement</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Cabinet ${cabinetName} est responsable du traitement des données personnelles collectées dans le cadre de la relation contractuelle.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">2. Finalités du traitement</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Les données sont traitées aux fins suivantes : exécution de la mission d'expertise comptable, gestion comptable et fiscale, gestion sociale, respect des obligations légales et réglementaires, lutte contre le blanchiment de capitaux.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">3. Données collectées</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Données d'identification (nom, prénom, adresse, email, SIREN/SIRET), données financières et comptables, données relatives aux salariés dans le cadre de la gestion sociale.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">4. Durée de conservation</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Les données sont conservées pendant la durée de la mission et 10 ans après sa cessation, conformément aux obligations légales.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">5. Droits des personnes concernées</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation du traitement, de portabilité et d'opposition. Pour exercer ces droits, contactez le Cabinet à l'adresse : ${cabinet.expertEmail || 'contact@hayot-expertise.fr'}.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">6. Sous-traitants</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Dans le cadre de la mission, le Cabinet utilise le logiciel Pennylane (REV SAS) en qualité de sous-traitant. Un accord de traitement des données est en place conformément à l'article 28 du RGPD.
      </p>
    </div>`;
}

/** Build an HTML page for the Pennylane usage annex. */
function buildPennylaneHtml(): string {
  const cabinet = getCabinetInfo();
  const cabinetName = cabinet.nom || 'HAYOT EXPERTISE';

  return `
    <div style="font-family:'Times New Roman',serif;max-width:680px;margin:0 auto;padding:32px 40px;">
      <div style="text-align:center;margin-bottom:28px;border-bottom:2px solid #1e3a5f;padding-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">ANNEXE — UTILISATION DU LOGICIEL PENNYLANE</h2>
        <p style="font-size:12px;color:#6b7280;margin:0;">${cabinetName}</p>
      </div>
      <p style="font-size:11px;line-height:1.7;color:#374151;margin-bottom:12px;text-align:justify;">
        La présente annexe définit les conditions d'accès et d'utilisation de la plateforme Pennylane dans le cadre de la mission confiée au Cabinet.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">1. Accès à la plateforme</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Cabinet mettra à disposition du Client un accès à la plateforme Pennylane. Le Client s'engage à conclure avec REV SAS un contrat d'utilisation dans les 15 jours suivant la signature des présentes.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">2. Obligations du Client</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Client s'engage à utiliser la plateforme conformément aux conditions d'utilisation définies par REV SAS, à saisir régulièrement les pièces comptables et à maintenir à jour les connexions bancaires.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">3. Dématérialisation des pièces</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Les pièces justificatives seront collectées via la plateforme Pennylane. Le Client s'engage à transmettre ses pièces comptables sous format numérique (photo ou scan) dans les délais convenus.
      </p>
    </div>`;
}

/** Build an HTML page for the confraternal recovery clause. */
function buildConfraternelHtml(rawContent: string): string {
  if (rawContent.trim()) {
    return `<div style="font-family:'Times New Roman',serif;max-width:680px;margin:0 auto;padding:32px 40px;">${rawContent}</div>`;
  }
  const cabinet = getCabinetInfo();
  const cabinetName = cabinet.nom || 'HAYOT EXPERTISE';

  return `
    <div style="font-family:'Times New Roman',serif;max-width:680px;margin:0 auto;padding:32px 40px;">
      <div style="text-align:center;margin-bottom:28px;border-bottom:2px solid #1e3a5f;padding-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">CLAUSE DE REPRISE CONFRATERNELLE</h2>
        <p style="font-size:12px;color:#6b7280;margin:0;">${cabinetName}</p>
      </div>
      <p style="font-size:11px;line-height:1.7;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Cabinet s'engage à reprendre la mission dans les conditions définies ci-après, en coordination avec le cabinet précédent conformément aux règles déontologiques de l'Ordre des Experts-Comptables.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">1. Prise de contact avec le cabinet précédent</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Cabinet se chargera de contacter le cabinet comptable précédent afin d'obtenir les informations et documents nécessaires à la continuité de la mission. Le Client autorise expressément cette démarche.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">2. Récupération des données et dossiers</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Cabinet récupérera l'ensemble des données comptables, fiscales et sociales nécessaires auprès du cabinet précédent. Les frais éventuels liés à cette reprise sont inclus dans les frais d'intégration.
      </p>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 6px;">3. Continuité de service</h3>
      <p style="font-size:11px;line-height:1.6;color:#374151;margin-bottom:12px;text-align:justify;">
        Le Cabinet garantit la continuité de l'ensemble des obligations déclaratives et comptables pendant la période de transition, sous réserve de la coopération du cabinet précédent.
      </p>
    </div>`;
}

/** Build an HTML page for the SEPA direct debit mandate. */
function buildMandatSepaHtml(variables?: LdmVariableMap): string {
  const cabinet = getCabinetInfo();
  const cabinetName = cabinet.nom || 'HAYOT EXPERTISE';
  const cabinetSiren = cabinet.siren || variables?.cabinet_siren || '942 525 098';
  const clientRs = variables?.client_raison_sociale || '_______________';
  const clientSiren = variables?.client_siren || '_______________';
  const clientAdresse = variables?.client_adresse || '_______________';
  const honorairesMensuels = variables?.honoraires_mensuels_ht || '_______________';
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
    <div style="font-family:'Times New Roman',serif;max-width:680px;margin:0 auto;padding:32px 40px;">
      <div style="text-align:center;margin-bottom:28px;border-bottom:2px solid #1e3a5f;padding-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0 0 4px;">MANDAT DE PRÉLÈVEMENT SEPA</h2>
        <p style="font-size:12px;color:#6b7280;margin:0;">Référence unique de mandat (RUM) : À compléter par le Cabinet</p>
      </div>
      <div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin-bottom:20px;background:#f9fafb;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 8px;color:#6b7280;width:40%;">Créancier (Cabinet) :</td>
            <td style="padding:4px 8px;font-weight:600;color:#111827;">${cabinetName}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:#6b7280;">SIREN Créancier :</td>
            <td style="padding:4px 8px;color:#111827;">${cabinetSiren}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:#6b7280;">Débiteur (Client) :</td>
            <td style="padding:4px 8px;font-weight:600;color:#111827;">${clientRs}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:#6b7280;">SIREN Débiteur :</td>
            <td style="padding:4px 8px;color:#111827;">${clientSiren}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:#6b7280;">Adresse Débiteur :</td>
            <td style="padding:4px 8px;color:#111827;">${clientAdresse}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;color:#6b7280;">Montant mensuel HT :</td>
            <td style="padding:4px 8px;font-weight:700;color:#1e3a5f;">${honorairesMensuels} €</td>
          </tr>
        </table>
      </div>
      <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;margin:0 0 8px;">Coordonnées bancaires du débiteur</h3>
      <table style="width:100%;font-size:11px;border-collapse:collapse;border:1px solid #d1d5db;margin-bottom:20px;">
        <tr>
          <td style="padding:8px;border:1px solid #d1d5db;background:#f3f4f6;font-weight:600;">IBAN</td>
          <td style="padding:8px;border:1px solid #d1d5db;">__ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __ __</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #d1d5db;background:#f3f4f6;font-weight:600;">BIC / SWIFT</td>
          <td style="padding:8px;border:1px solid #d1d5db;">_______________________</td>
        </tr>
      </table>
      <p style="font-size:10px;line-height:1.6;color:#6b7280;margin-bottom:16px;text-align:justify;">
        En signant ce formulaire de mandat, vous autorisez ${cabinetName} à envoyer des instructions à votre banque pour débiter votre compte, et votre banque à débiter votre compte conformément aux instructions. Vous bénéficiez du droit d'être remboursé par votre banque selon les conditions décrites dans la convention que vous avez passée avec elle. Une demande de remboursement doit être présentée dans les 8 semaines suivant la date de débit de votre compte pour un prélèvement autorisé.
      </p>
      <div style="display:flex;justify-content:space-between;margin-top:32px;">
        <div>
          <p style="font-size:11px;color:#374151;margin:0 0 4px;font-weight:600;">Fait à : _______________</p>
          <p style="font-size:11px;color:#374151;margin:0 0 4px;">Le : ${today}</p>
          <p style="font-size:11px;color:#374151;margin:0;font-weight:600;">Signature du débiteur :</p>
          <div style="height:60px;border-bottom:1px solid #374151;width:200px;margin-top:8px;"></div>
        </div>
      </div>
    </div>`;
}

/**
 * Build the full HTML content for all selected annexes.
 * Returns an empty string when no annexes are selected.
 * Each annex starts with a page break.
 */
export async function buildAnnexesHtml(
  config: LdmConfigState,
  variables?: LdmVariableMap,
): Promise<string> {
  const parts: string[] = [];

  if (config.annexesCGV) {
    parts.push(ANNEX_PAGE_BREAK + buildCgvHtml());
  }
  if (config.annexesRGPD) {
    parts.push(ANNEX_PAGE_BREAK + buildRgpdHtml());
  }
  if (config.annexesPennylane) {
    parts.push(ANNEX_PAGE_BREAK + buildPennylaneHtml());
  }
  if (config.annexesConfraternel) {
    const rawContent = await fetchDocumentContent('confraternal');
    parts.push(ANNEX_PAGE_BREAK + buildConfraternelHtml(rawContent));
  }
  if (config.annexesMandatSEPA) {
    parts.push(ANNEX_PAGE_BREAK + buildMandatSepaHtml(variables));
  }

  return parts.join('\n');
}
