/**
 * DocumentPreview — Clean A4 Lettre de Mission preview.
 *
 * Architecture:
 *  1. Fetches the raw template `contenu` from the Supabase `documents` table via
 *     fetchDocumentContent() from ldmTemplateEngine.
 *  2. Builds the variable map from the form data via buildLdmVariables().
 *  3. Applies formatTemplate(rawTemplate, variables) to produce the final text.
 *  4. Renders a clean A4 white page (max-w-[21cm] min-h-[29.7cm]) with serif
 *     legal typography, whitespace-pre-line paragraph handling, and prose styling.
 *
 * Also exports:
 *  - ValidatedQuoteBreakdown  (used by LettreMission.tsx and ldmTemplateEngine.ts)
 *  - DocumentPreviewData      (form → preview prop bridge, used by LettreMission.tsx)
 *  - buildPrintHtml()         (produces a standalone print/Word HTML document)
 */

import { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Loader2, FileText, Printer, Tag } from 'lucide-react';
import type { LdmConfigState } from './StepLdmConfig';
import type { PricingLine } from '../../components/crm/ProposalPricingEngine';
import {
  buildLdmVariables,
  formatTemplate,
  fetchDocumentContent,
} from '../utils/ldmTemplateEngine';

// ─── Exported types (kept for backward compatibility) ─────────────────────────

export interface ValidatedQuoteBreakdown {
  monthlyAccountingPrice: number;
  monthlyClosurePrice: number;
  monthlySocialPrice: number;
  monthlyOptionsPrice: number;
  setupFees: number;
  totalMonthlyHT: number;
  bulletinsPerMonth: number;
  options?: {
    ticketsSupport5an?: boolean;
    whatsappDedie?: boolean;
    appelsPrioritaires?: boolean;
    assembleGenerale?: boolean;
  };
}

export interface DocumentPreviewData {
  // Client
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
  // Pricing
  prixAnnuel: string;
  // Missions
  missionsSelectionnees: string[];
  // Dates
  dateEffet: string;
  dateRapprochement: string;
  dateRevisionAnnuelle: string;
  delaiPreavisRevision: string;
  indiceBaseTrimestre: string;
  indiceBaseAnnee: string;
  indiceBaseValeur: string;
  // LDM Config
  ldmConfig: LdmConfigState;
  /** Detailed fee breakdown injected from a VALIDATED Supabase quote */
  validatedQuoteData?: ValidatedQuoteBreakdown | null;
  /**
   * Pricing lines derived from computePricing() / buildPricingLinesFromBreakdown().
   * Passed to buildLdmVariables() to populate {{liste_missions_principales}} and
   * {{liste_options_souscrites}} variables in the template.
   */
  pricingLines?: PricingLine[] | null;
}

// ─── Category badge labels ────────────────────────────────────────────────────

const MODELE_LABELS: Record<LdmConfigState['modeleType'], string> = {
  'BIC/IS': 'BIC / IS',
  'BNC': 'BNC',
  'IR': 'IR',
  'Social': 'Social',
};

// ─── Print HTML builder (used by handlePdf / handleDoc in LettreMission.tsx) ──

/**
 * Wraps a formatted HTML string in a standalone, print-ready HTML document.
 * The content must be the result of formatTemplate() (may contain <ul>/<li> HTML
 * plus plain text with \n line breaks).
 *
 * @param htmlContent  Formatted template content (HTML + text with \n)
 * @param title        Document title shown in the browser tab
 */
export function buildPrintHtml(htmlContent: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 11pt;
      color: #1e293b;
      background: #f1f5f9;
      line-height: 1.7;
      white-space: pre-line;
    }
    .page {
      background: #ffffff;
      max-width: 21cm;
      min-height: 29.7cm;
      margin: 24px auto;
      padding: 3cm 2.5cm;
      box-shadow: 0 4px 24px rgba(30,58,95,0.10);
    }
    h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; color: #1e3a5f; }
    ul { padding-left: 20px; margin: 8px 0; white-space: normal; }
    li { margin-bottom: 4px; white-space: normal; }
    p { margin-bottom: 10px; text-align: justify; white-space: pre-line; }
    @media print {
      body { background: #fff; white-space: pre-line; }
      .page { box-shadow: none; margin: 0; padding: 2cm; max-width: none; min-height: auto; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">${htmlContent}</div>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the most specific display name available for the client. */
function getClientDisplayName(data: DocumentPreviewData): string {
  return (
    data.clientRaisonSociale ||
    [data.clientPrenom, data.clientNom].filter(Boolean).join(' ') ||
    'Client'
  );
}

// ─── DocumentPreview component ────────────────────────────────────────────────

interface DocumentPreviewProps {
  data: DocumentPreviewData;
  className?: string;
  /** Pre-fetched template `contenu` from LettreMission.tsx. When provided the
   *  component skips its own Supabase fetch and renders immediately. */
  rawTemplate?: string | null;
}

export function DocumentPreview({ data, className = '', rawTemplate: rawTemplateProp }: DocumentPreviewProps) {
  const [templateContent, setTemplateContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Three-state handling:
  //   rawTemplateProp === undefined → no prop passed, fall back to internal fetch
  //   rawTemplateProp === null      → parent is fetching; show loading spinner
  //   rawTemplateProp === string    → use content directly, skip internal fetch
  const modeleType = data.ldmConfig.modeleType;
  useEffect(() => {
    if (rawTemplateProp !== undefined) {
      // Parent controls the template lifecycle
      if (rawTemplateProp === null) {
        setLoading(true);
        setFetchError(false);
      } else {
        setTemplateContent(rawTemplateProp);
        setLoading(false);
        setFetchError(false);
      }
      return;
    }

    // Legacy internal fetch (used when rawTemplate prop is not passed at all)
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    fetchDocumentContent('mission')
      .then(content => {
        if (!cancelled) {
          setTemplateContent(content);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [modeleType, rawTemplateProp]);

  // Build the variable map from the form data (debounced via useMemo).
  const variables = useMemo(
    () => buildLdmVariables(data, data.pricingLines ?? undefined, data.validatedQuoteData ?? undefined),
    [data],
  );

  // Apply template substitution and sanitize the resulting HTML.
  const sanitized = useMemo(() => {
    if (!templateContent) return '';
    const rendered = formatTemplate(templateContent, variables);
    return DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
  }, [templateContent, variables]);

  const categoryLabel = MODELE_LABELS[modeleType] ?? modeleType;
  const societeDisplay = getClientDisplayName(data);

  return (
    <div className={`rounded-xl border border-gray-200 overflow-hidden bg-slate-100 ${className}`}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          <span className="ml-2 text-gray-500">Aperçu · Lettre de Mission A4</span>
        </span>
        <div className="flex items-center gap-2">
          {/* Category badge */}
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Tag className="w-2.5 h-2.5" />
            {categoryLabel}
          </span>
          {/* Print PDF button */}
          <button
            onClick={() => {
              if (!sanitized) return;
              const html = buildPrintHtml(sanitized, `Lettre de Mission — ${societeDisplay}`);
              const win = window.open('', '_blank');
              if (!win) return;
              win.document.open();
              win.document.write(html);
              win.document.close();
              win.focus();
              const triggerPrint = () => { try { win.print(); } catch { /* popup closed */ } };
              if (win.document.fonts?.ready) {
                win.document.fonts.ready.then(triggerPrint);
              } else {
                setTimeout(triggerPrint, 1500);
              }
            }}
            disabled={loading || !sanitized}
            title="Télécharger en PDF"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 disabled:opacity-40 transition-colors"
          >
            <Printer className="w-2.5 h-2.5" />
            Télécharger PDF
          </button>
          <span className="text-xs text-gray-400">Mise à jour en temps réel</span>
        </div>
      </div>

      {/* ── A4 page ── */}
      <div className="overflow-auto bg-slate-100" style={{ height: 'calc(100vh - 160px)', minHeight: '600px' }}>
        <div className="py-8 px-4">
          {loading ? (
            <div className="max-w-[21cm] min-h-[29.7cm] bg-white shadow-2xl mx-auto p-16 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm">Chargement du modèle…</span>
              </div>
            </div>
          ) : fetchError ? (
            <div className="max-w-[21cm] min-h-[29.7cm] bg-white shadow-2xl mx-auto p-16 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <FileText className="w-10 h-10 text-red-200" />
                <p className="text-sm font-medium text-red-500">Erreur de chargement du modèle</p>
                <p className="text-xs text-gray-400 max-w-xs">
                  Impossible de récupérer le modèle depuis Supabase. Vérifiez votre connexion et rechargez la page.
                </p>
              </div>
            </div>
          ) : !templateContent ? (
            <div className="max-w-[21cm] min-h-[29.7cm] bg-white shadow-2xl mx-auto p-16 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center text-gray-400">
                <FileText className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">Aucun modèle disponible</p>
                <p className="text-xs text-gray-400 max-w-xs">
                  Créez un modèle de type «&nbsp;Mission&nbsp;» dans l'onglet «&nbsp;Modèles&nbsp;» pour voir la prévisualisation.
                </p>
              </div>
            </div>
          ) : (
            /* A4 white page — legal typography */
            <div
              className="
                max-w-[21cm] min-h-[29.7cm] bg-white shadow-2xl mx-auto p-16
                text-gray-900 font-serif text-[11pt] leading-relaxed text-justify
                prose prose-sm max-w-none
                prose-headings:font-serif prose-headings:text-blue-900
                prose-li:my-0.5 prose-ul:my-2
                [&_h2]:border-l-4 [&_h2]:border-[#c9a84c] [&_h2]:pl-3 [&_h2]:my-4
                [&_h3]:border-l-4 [&_h3]:border-[#c9a84c] [&_h3]:pl-3 [&_h3]:my-3
                [&_blockquote]:border-l-4 [&_blockquote]:border-[#c9a84c] [&_blockquote]:pl-3
              "
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
