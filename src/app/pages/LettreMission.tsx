/**
 * LettreMission — Contrôleur principal.
 *
 * Architecture :
 *  1. Chargement des devis VALIDATED depuis Supabase (table `quotes`)
 *  2. Sélection d'un devis → toutes les variables sont dérivées automatiquement
 *     OU saisie manuelle complète (mode « Nouvelle LDM »)
 *  3. Le template est lu depuis Supabase (table `documents`)
 *  4. Affichage A4 via DocumentPreview + actions PDF / DOC / Email / Signature
 *  5. Les annexes sélectionnées (CGV, RGPD, Pennylane, Confraternelle, SEPA)
 *     sont ajoutées au document généré.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, FileText, Download, Printer,
  CheckCircle2, CloudDownload, Loader2,
  Mail, PenLine, X, Send, ExternalLink, AlertCircle,
  Building2, User, Euro, Library, Edit2, Plus,
  Paperclip, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { getCabinetInfo } from '../utils/servicesStorage';
import type { LdmConfigState } from '../components/StepLdmConfig';
import {
  DocumentPreview,
  buildPrintHtml,
  type DocumentPreviewData,
  type ValidatedQuoteBreakdown,
} from '../components/DocumentPreview';
import {
  buildPricingLinesFromBreakdown,
  buildLdmVariables,
  formatTemplate,
  fetchDocumentBySlug,
  buildAnnexesHtml,
} from '../utils/ldmTemplateEngine';
import {
  getQuotesForLDM,
  updateQuoteLdmData,
  updateQuoteStatus,
  getProspectPricingData,
  type ValidatedQuote,
} from '../utils/supabaseSync';
import { sendEmail, buildLDMEmail } from '../services/emailService';
import { createSignatureRequest as createYousignRequest, getSignatureStatus } from '../services/yousignApi';
import { createSignatureTransaction as createJeSignRequest, getTransactionStatus } from '../services/jesignexpertApi';
import { generateLDMPdf } from '../services/pdfGenerator';
import { useServices } from '../context/ServicesContext';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LDM_CONFIG: LdmConfigState = {
  modeleType: 'BIC/IS',
  annexesCGV: true,
  annexesRGPD: false,
  annexesPennylane: false,
  annexesConfraternel: false,
  annexesMandatSEPA: false,
};

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow';

/** Intervalle de polling pour le suivi du statut de signature (en ms). */
const SIGNATURE_POLL_INTERVAL_MS = 30_000;
/** Libellé affiché dans l'UI correspondant à SIGNATURE_POLL_INTERVAL_MS. */
const SIGNATURE_POLL_INTERVAL_LABEL = '30 s';

// ─── Manual overrides type ────────────────────────────────────────────────────

/** Fields that the user can manually override on top of auto-filled data. */
interface ManualOverrides {
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
}

const EMPTY_OVERRIDES: ManualOverrides = {
  clientGenre: 'M.',
  clientPrenom: '',
  clientNom: '',
  clientRaisonSociale: '',
  clientSiren: '',
  clientEmail: '',
  clientAdresse: '',
  clientFormeJuridique: 'SARL',
  clientActivite: '',
  clientStatutDirigeant: 'de Gérant(e)',
  prixAnnuel: '',
  dateEffet: '',
  dateRapprochement: '',
  dateRevisionAnnuelle: '1er janvier',
  delaiPreavisRevision: '30',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a client's legal form to the slug used to look up the right LDM
 * template in the Supabase `documents` table.
 *
 * Slugs are stored in the `slug` column (added in migration 5):
 *   - "ldm-sci"                → Société Civile Immobilière
 *   - "ldm-bnc"                → EI / BNC / LMNP / Professions libérales
 *   - "ldm-societe-commerciale" → All other commercial companies (default)
 */
function getSlugFromLegalForm(legalForm?: string | null): string {
  const f = (legalForm ?? '').toUpperCase();
  if (f === 'SCI') return 'ldm-sci';
  if (f === 'EI' || f === 'BNC' || f === 'LMNP') return 'ldm-bnc';
  return 'ldm-societe-commerciale';
}

/** Derive a sensible "statut dirigeant" from the legal form. */
function getStatutDirigeant(legalForm: string | null): string {
  const f = (legalForm ?? '').toUpperCase();
  if (f.includes('SAS') || f === 'SA') return 'de Président(e)';
  if (f === 'EI' || f.includes('LMNP')) return "d'Entrepreneur(e)";
  return 'de Gérant(e)';
}

/**
 * Converts a ValidatedQuote (from Supabase) into a DocumentPreviewData object
 * suitable for rendering by DocumentPreview.  All variables are derived
 * automatically — no manual input required.
 *
 * When `prospectPricingData` is supplied (fetched from the `prospects` table),
 * it enriches the preview with additional client details stored in the CRM
 * (SIREN, address, contact info, etc.) and ensures the fee breakdown reflects
 * the exact proposal that was shared with the prospect.
 */
function buildPreviewDataFromQuote(
  q: ValidatedQuote,
  prospectPricingData?: Record<string, unknown> | null,
): DocumentPreviewData {
  const qd = q.quoteData as Record<string, unknown>;

  // Merge prospect pricing data when available — it may carry richer client info
  const pd = prospectPricingData ?? {};

  // Prefer prospect SIREN (from companyProfile saved at chiffrage time)
  const sirenFromProspect =
    (pd.siren as string | undefined) ||
    ((pd.companyProfile as Record<string, unknown> | undefined)?.siren as string | undefined);

  // Split full name into prénom + nom (best-effort)
  const nameParts = q.clientName.trim().split(/\s+/);
  const clientPrenom = nameParts.length > 1 ? nameParts[0] : '';
  const clientNom =
    nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

  // Derive mission list from pricing breakdown
  const accountingPrice = Number(qd.monthlyAccountingPrice ?? 0);
  const closurePrice = Number(qd.monthlyClosurePrice ?? 0);
  const socialPrice = Number(qd.monthlySocialPrice ?? 0);
  const missions: string[] = [];
  if (accountingPrice > 0) missions.push('Tenue comptable & saisie des pièces');
  if (closurePrice > 0) missions.push('Révision, clôture, bilan & liasse fiscale');
  if (socialPrice > 0) {
    missions.push('Gestion sociale & bulletins de paie');
    missions.push('Déclarations sociales (DSN)');
  }

  const optionsRaw =
    (qd.options as Record<string, boolean> | undefined) ?? {};

  const vqd: ValidatedQuoteBreakdown = {
    monthlyAccountingPrice: accountingPrice,
    monthlyClosurePrice: closurePrice,
    monthlySocialPrice: socialPrice,
    monthlyOptionsPrice: Number(qd.monthlyOptionsPrice ?? 0),
    setupFees: q.setupFees,
    totalMonthlyHT: q.monthlyTotal,
    bulletinsPerMonth: Number(qd.bulletinsPerMonth ?? 0),
    options: {
      ticketsSupport5an: !!optionsRaw.ticketsSupport5an,
      whatsappDedie: !!optionsRaw.whatsappDedie,
      appelsPrioritaires: !!optionsRaw.appelsPrioritaires,
      assembleGenerale: !!optionsRaw.assembleGenerale,
    },
  };

  // Auto-compute dates
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dateEffet = nextMonth.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    clientGenre: 'M.',
    clientPrenom,
    clientNom,
    clientRaisonSociale: q.clientName,
    clientSiren: sirenFromProspect ?? q.siret ?? '',
    clientEmail: q.clientEmail ?? '',
    clientAdresse: '',
    clientFormeJuridique: q.legalForm ?? 'SARL',
    clientActivite: q.activity ?? '',
    clientStatutDirigeant: getStatutDirigeant(q.legalForm),
    prixAnnuel: String(q.monthlyTotal * 12),
    missionsSelectionnees: missions,
    dateEffet,
    dateRapprochement: '',
    dateRevisionAnnuelle: '1er janvier',
    delaiPreavisRevision: '30',
    indiceBaseTrimestre: 'T' + Math.ceil((now.getMonth() + 1) / 3),
    indiceBaseAnnee: String(now.getFullYear()),
    indiceBaseValeur: '131,4',
    ldmConfig: DEFAULT_LDM_CONFIG,
    validatedQuoteData: vqd,
    pricingLines: buildPricingLinesFromBreakdown(vqd),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={`text-right ${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
      >
        {value}
      </span>
    </div>
  );
}

/** An editable field row: shows a text input when in edit mode. */
function EditableInfoRow({
  label,
  fieldKey,
  value,
  overrideValue,
  onOverride,
  highlight,
  type = 'text',
}: {
  label: string;
  fieldKey: keyof ManualOverrides;
  value: string;
  overrideValue: string;
  onOverride: (key: keyof ManualOverrides, val: string) => void;
  highlight?: boolean;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const displayVal = overrideValue || value;
  const isOverridden = Boolean(overrideValue && overrideValue !== value);

  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type={type}
            className="flex-1 min-w-0 rounded border border-blue-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={overrideValue !== '' ? overrideValue : value}
            onChange={e => onOverride(fieldKey, e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
        </div>
      ) : (
        <button
          className={`text-right max-w-[60%] truncate group flex items-center gap-1 ${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'} hover:text-blue-700 transition-colors`}
          onClick={() => setEditing(true)}
          title="Cliquer pour modifier"
        >
          <span className={`truncate ${!displayVal ? 'text-amber-500 italic' : ''}`}>
            {displayVal || '— à compléter —'}
          </span>
          {isOverridden && <span className="text-blue-500 text-[9px] flex-shrink-0">✎</span>}
          <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 flex-shrink-0" />
        </button>
      )}
    </div>
  );
}

// ─── Signature status badge ───────────────────────────────────────────────────

/** Statut visuel de la signature électronique d'un document. */
export type DocSignatureStatus = 'draft' | 'sent' | 'read' | 'signed';

/**
 * Badge shadcn affichant le statut de signature d'un document :
 *  - Brouillon (Gris)   → document non encore envoyé
 *  - Envoyé   (Bleu)   → envoyé au signataire, en attente
 *  - Lu       (Jaune)  → le signataire a ouvert le document
 *  - Signé    (Vert)   → signature complétée
 */
function SignatureBadge({ status }: { status: DocSignatureStatus }) {
  if (status === 'signed') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Signé
      </Badge>
    );
  }
  if (status === 'read') {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-100">
        Lu
      </Badge>
    );
  }
  if (status === 'sent') {
    return (
      <Badge className="bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100">
        Envoyé
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50 hover:bg-gray-50">
      Brouillon
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LettreMission() {
  const navigate = useNavigate();
  const { connections } = useServices();

  // ── Validated quotes ─────────────────────────────────────────────────────────
  const [validatedQuotes, setValidatedQuotes] = useState<ValidatedQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<ValidatedQuote | null>(null);

  // ── Manual mode (saisie manuelle sans devis) ──────────────────────────────────
  const [manualMode, setManualMode] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({ ...EMPTY_OVERRIDES });

  const setOverride = useCallback(
    (key: keyof ManualOverrides, val: string) =>
      setManualOverrides(prev => ({ ...prev, [key]: val })),
    [],
  );

  // ── LDM Config (model + annexes) ──────────────────────────────────────────────
  const [ldmConfig, setLdmConfig] = useState<LdmConfigState>({ ...DEFAULT_LDM_CONFIG });
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const setConfigField = useCallback(
    <K extends keyof LdmConfigState>(key: K, value: LdmConfigState[K]) =>
      setLdmConfig(prev => ({ ...prev, [key]: value })),
    [],
  );

  // ── Prospect pricing data (CRM enrichment) ───────────────────────────────────
  const [prospectPricingData, setProspectPricingData] = useState<Record<string, unknown> | null>(null);

  // ── Electronic signature tracking ─────────────────────────────────────────────
  const [docSignatureStatus, setDocSignatureStatus] = useState<DocSignatureStatus>('draft');
  const [localSignatureId, setLocalSignatureId] = useState<string | null>(null);
  const [localSignatureProvider, setLocalSignatureProvider] = useState<'yousign' | 'jesignexpert'>('yousign');
  // Ref to avoid stale closure in polling interval
  const pollingRef = useRef<{ id: string; provider: 'yousign' | 'jesignexpert'; quoteId: string } | null>(null);

  useEffect(() => {
    getQuotesForLDM()
      .then(res => {
        if (res.success) setValidatedQuotes(res.quotes);
      })
      .finally(() => setLoadingQuotes(false));
  }, []);

  useEffect(() => {
    if (!selectedQuote) {
      setProspectPricingData(null);
      return;
    }
    const siren = selectedQuote.siret
      ? selectedQuote.siret.slice(0, 9)
      : null;
    getProspectPricingData(siren, selectedQuote.clientName).then(res => {
      if (res.success) {
        setProspectPricingData(res.pricingData);
      } else {
        setProspectPricingData(null);
      }
    }).catch(() => setProspectPricingData(null));
  }, [selectedQuote]);

  // ── Derive docSignatureStatus from selected quote ─────────────────────────────
  useEffect(() => {
    if (!selectedQuote) {
      setDocSignatureStatus('draft');
      setLocalSignatureId(null);
      pollingRef.current = null;
      return;
    }
    // Restore signatureId saved in quoteData after a previous send
    const qd = selectedQuote.quoteData as Record<string, unknown>;
    const savedId = qd.signatureId as string | undefined;
    const savedProvider = qd.signatureProvider as 'yousign' | 'jesignexpert' | undefined;
    if (savedId) {
      setLocalSignatureId(savedId);
      if (savedProvider) setLocalSignatureProvider(savedProvider);
      pollingRef.current = {
        id: savedId,
        provider: savedProvider ?? 'yousign',
        quoteId: selectedQuote.quoteId,
      };
    } else {
      setLocalSignatureId(null);
      pollingRef.current = null;
    }
    // Map quote status to visual badge status
    if (selectedQuote.status === 'SIGNED') {
      setDocSignatureStatus('signed');
    } else if (selectedQuote.status === 'SENT') {
      setDocSignatureStatus('sent');
    } else {
      setDocSignatureStatus('draft');
    }
  }, [selectedQuote]);

  // ── Polling — met à jour le statut en temps réel quand le client signe ────────
  useEffect(() => {
    if (!localSignatureId || docSignatureStatus === 'signed') return;

    const poll = async () => {
      const ctx = pollingRef.current;
      if (!ctx) return;
      try {
        if (ctx.provider === 'jesignexpert') {
          const res = await getTransactionStatus(ctx.id);
          if (!res.success) return;
          if (
            res.status === 'completed' ||
            res.signerStatuses?.some(s => s.status === 'signed')
          ) {
            setDocSignatureStatus('signed');
            await updateQuoteStatus(ctx.quoteId, 'SIGNED');
            // Update local quotes list so the badge stays correct
            setValidatedQuotes(prev =>
              prev.map(q => q.quoteId === ctx.quoteId ? { ...q, status: 'SIGNED' } : q)
            );
          }
        } else {
          const res = await getSignatureStatus(ctx.id);
          if (!res.success) return;
          if (res.status === 'done' || res.signerStatus === 'signed') {
            setDocSignatureStatus('signed');
            await updateQuoteStatus(ctx.quoteId, 'SIGNED');
            setValidatedQuotes(prev =>
              prev.map(q => q.quoteId === ctx.quoteId ? { ...q, status: 'SIGNED' } : q)
            );
          }
        }
      } catch {
        // Ignore transient polling errors
      }
    };

    const intervalId = setInterval(poll, SIGNATURE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [localSignatureId, localSignatureProvider, docSignatureStatus]);

  // ── Auto-derived base preview data ───────────────────────────────────────────
  const autoPreviewData: DocumentPreviewData | null = useMemo(
    () => (selectedQuote ? buildPreviewDataFromQuote(selectedQuote, prospectPricingData) : null),
    [selectedQuote, prospectPricingData],
  );

  // ── Effective preview data (auto + manual overrides + ldmConfig) ─────────────
  const previewData: DocumentPreviewData | null = useMemo(() => {
    if (manualMode) {
      // Pure manual mode: use only manual inputs
      const now = new Date();
      return {
        clientGenre: manualOverrides.clientGenre || 'M.',
        clientPrenom: manualOverrides.clientPrenom,
        clientNom: manualOverrides.clientNom,
        clientRaisonSociale: manualOverrides.clientRaisonSociale,
        clientSiren: manualOverrides.clientSiren,
        clientEmail: manualOverrides.clientEmail,
        clientAdresse: manualOverrides.clientAdresse,
        clientFormeJuridique: manualOverrides.clientFormeJuridique,
        clientActivite: manualOverrides.clientActivite,
        clientStatutDirigeant: manualOverrides.clientStatutDirigeant,
        prixAnnuel: manualOverrides.prixAnnuel,
        missionsSelectionnees: [],
        dateEffet: manualOverrides.dateEffet,
        dateRapprochement: manualOverrides.dateRapprochement,
        dateRevisionAnnuelle: manualOverrides.dateRevisionAnnuelle || '1er janvier',
        delaiPreavisRevision: manualOverrides.delaiPreavisRevision || '30',
        indiceBaseTrimestre: 'T' + Math.ceil((now.getMonth() + 1) / 3),
        indiceBaseAnnee: String(now.getFullYear()),
        indiceBaseValeur: '131,4',
        ldmConfig,
        validatedQuoteData: null,
        pricingLines: [],
      };
    }
    if (!autoPreviewData) return null;
    // Quote mode: merge auto data + manual overrides + current ldmConfig
    return {
      ...autoPreviewData,
      ldmConfig,
      // Apply manual overrides when set
      ...(manualOverrides.clientGenre && { clientGenre: manualOverrides.clientGenre }),
      ...(manualOverrides.clientPrenom && { clientPrenom: manualOverrides.clientPrenom }),
      ...(manualOverrides.clientNom && { clientNom: manualOverrides.clientNom }),
      ...(manualOverrides.clientRaisonSociale && { clientRaisonSociale: manualOverrides.clientRaisonSociale }),
      ...(manualOverrides.clientSiren && { clientSiren: manualOverrides.clientSiren }),
      ...(manualOverrides.clientEmail && { clientEmail: manualOverrides.clientEmail }),
      ...(manualOverrides.clientAdresse && { clientAdresse: manualOverrides.clientAdresse }),
      ...(manualOverrides.clientFormeJuridique && { clientFormeJuridique: manualOverrides.clientFormeJuridique }),
      ...(manualOverrides.clientActivite && { clientActivite: manualOverrides.clientActivite }),
      ...(manualOverrides.clientStatutDirigeant && { clientStatutDirigeant: manualOverrides.clientStatutDirigeant }),
      ...(manualOverrides.prixAnnuel && { prixAnnuel: manualOverrides.prixAnnuel }),
      ...(manualOverrides.dateEffet && { dateEffet: manualOverrides.dateEffet }),
      ...(manualOverrides.dateRapprochement && { dateRapprochement: manualOverrides.dateRapprochement }),
      ...(manualOverrides.dateRevisionAnnuelle && { dateRevisionAnnuelle: manualOverrides.dateRevisionAnnuelle }),
      ...(manualOverrides.delaiPreavisRevision && { delaiPreavisRevision: manualOverrides.delaiPreavisRevision }),
    };
  }, [manualMode, autoPreviewData, manualOverrides, ldmConfig]);

  const hasQuote = previewData !== null;

  // Reset overrides when switching quote
  useEffect(() => {
    setManualOverrides({ ...EMPTY_OVERRIDES });
  }, [selectedQuote]);

  // ── Template fetch ────────────────────────────────────────────────────────────
  const [rawTemplate, setRawTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (manualMode) {
      // In manual mode, fetch the default 'BIC/IS' template by form
      const slug = getSlugFromLegalForm(manualOverrides.clientFormeJuridique || null);
      let cancelled = false;
      fetchDocumentBySlug(slug).then(content => {
        if (!cancelled) setRawTemplate(content);
      }).catch(() => { if (!cancelled) setRawTemplate(null); });
      return () => { cancelled = true; };
    }
    if (!selectedQuote) {
      setRawTemplate(null);
      return;
    }
    const slug = getSlugFromLegalForm(selectedQuote.legalForm);
    let cancelled = false;
    fetchDocumentBySlug(slug).then(content => {
      if (!cancelled) setRawTemplate(content);
    }).catch(() => { if (!cancelled) setRawTemplate(null); });
    return () => { cancelled = true; };
  }, [selectedQuote, manualMode, manualOverrides.clientFormeJuridique]);

  // ── Export handlers ───────────────────────────────────────────────────────────

  const handlePdf = useCallback(async () => {
    if (!previewData) return;
    try {
      const variables = buildLdmVariables(
        previewData,
        previewData.pricingLines ?? undefined,
        previewData.validatedQuoteData ?? undefined,
      );
      const rawContent = rawTemplate ?? await fetchDocumentBySlug(
        getSlugFromLegalForm(selectedQuote?.legalForm ?? previewData.clientFormeJuridique),
      );
      const formatted = formatTemplate(rawContent, variables);
      const title = `Lettre de Mission — ${previewData.clientRaisonSociale || previewData.clientNom || 'client'}`;
      const annexesHtml = await buildAnnexesHtml(ldmConfig, variables);
      const fullBodyHtml = formatted + annexesHtml;
      const html = buildPrintHtml(fullBodyHtml, title);
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      const triggerPrint = () => {
        try { win.print(); } catch { /* popup closed */ }
      };
      if (win.document.fonts?.ready) {
        win.document.fonts.ready.then(triggerPrint);
      } else {
        setTimeout(triggerPrint, 1500);
      }
    } catch {
      toast.error('Impossible de récupérer le modèle depuis Supabase pour le PDF.');
    }
  }, [previewData, rawTemplate, selectedQuote, ldmConfig]);

  const handleDoc = useCallback(async () => {
    if (!previewData) return;
    try {
      const variables = buildLdmVariables(
        previewData,
        previewData.pricingLines ?? undefined,
        previewData.validatedQuoteData ?? undefined,
      );
      const rawContent = rawTemplate ?? await fetchDocumentBySlug(
        getSlugFromLegalForm(selectedQuote?.legalForm ?? previewData.clientFormeJuridique),
      );
      const formatted = formatTemplate(rawContent, variables);
      const title = `Lettre de Mission — ${previewData.clientRaisonSociale || previewData.clientNom || 'client'}`;
      const annexesHtml = await buildAnnexesHtml(ldmConfig, variables);
      const fullBodyHtml = formatted + annexesHtml;
      const baseHtml = buildPrintHtml(fullBodyHtml, title);
      const wordHtml = baseHtml
        .replace(
          '<html lang="fr">',
          `<html lang="fr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`,
        )
        .replace(
          '<head>',
          '<head><meta name="ProgId" content="Word.Document"><meta name="Generator" content="Microsoft Word 15">',
        );
      const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lettre-mission-${(previewData.clientRaisonSociale || previewData.clientNom || 'client').replace(/\s+/g, '-').toLowerCase()}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Impossible de récupérer le modèle depuis Supabase pour l'export Word.");
    }
  }, [previewData, rawTemplate, selectedQuote, ldmConfig]);

  // ── Email & Signature ─────────────────────────────────────────────────────────

  const [showSendModal, setShowSendModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [signatureProvider, setSignatureProvider] = useState<'yousign' | 'jesignexpert'>('yousign');
  const [signatureStatus, setSignatureStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [signatureDemo, setSignatureDemo] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const handleOpenEmailModal = useCallback(() => {
    setSendRecipient(previewData?.clientEmail ?? '');
    setShowSendModal(true);
  }, [previewData]);

  const handleOpenSignModal = useCallback(() => {
    setSignatureStatus('idle');
    setSigningUrl(null);
    setSignatureError(null);
    setShowSignModal(true);
  }, []);

  const buildPdfBase64 = useCallback(async (): Promise<{ base64: string; filename: string }> => {
    if (!previewData) throw new Error('No quote selected');
    const cabinet = getCabinetInfo();
    const annualPrice = parseFloat(previewData.prixAnnuel) || 0;
    const monthlyPrice = annualPrice > 0 ? Math.round(annualPrice / 12) : 0;
    const vqd = previewData.validatedQuoteData;
    const doc = await generateLDMPdf(
      {
        raisonSociale: previewData.clientRaisonSociale || previewData.clientNom,
        nom: [previewData.clientPrenom, previewData.clientNom].filter(Boolean).join(' ') || previewData.clientNom,
        siren: previewData.clientSiren,
        adresse: previewData.clientAdresse,
        codePostal: '',
        ville: '',
        email: previewData.clientEmail,
        formeJuridique: previewData.clientFormeJuridique,
        missionsSelectionnees: previewData.missionsSelectionnees,
        prixAnnuel: previewData.prixAnnuel,
        ...(vqd ? {
          monthlyAccountingPrice: vqd.monthlyAccountingPrice,
          monthlyClosurePrice: vqd.monthlyClosurePrice,
          monthlySocialPrice: vqd.monthlySocialPrice,
          monthlyOptionsPrice: vqd.monthlyOptionsPrice,
          setupFees: vqd.setupFees,
          bulletinsPerMonth: vqd.bulletinsPerMonth,
          options: vqd.options,
        } : {}),
      },
      {
        nom: cabinet.nom,
        adresse: cabinet.adresse,
        codePostal: cabinet.codePostal,
        ville: cabinet.ville,
        siren: cabinet.siren,
        telephone: cabinet.telephone,
        expertNom: cabinet.expertNom,
        expertEmail: cabinet.expertEmail,
        numeroOrdre: cabinet.numeroOrdre,
      },
      monthlyPrice,
    );
    const dataUri = doc.output('datauristring');
    const base64 = dataUri.split(',')[1] ?? '';
    const clientSlug = (previewData.clientRaisonSociale || previewData.clientNom || 'client').replace(/\s+/g, '_');
    const filename = `Lettre_Mission_${clientSlug}.pdf`;
    return { base64, filename };
  }, [previewData]);

  const handleSendEmail = useCallback(async () => {
    if (!sendRecipient || !previewData) return;
    setSending(true);
    try {
      const { base64, filename } = await buildPdfBase64();
      const cabinet = getCabinetInfo();
      const annualPrice = parseFloat(previewData.prixAnnuel) || 0;
      const monthlyPrice = annualPrice > 0 ? Math.round(annualPrice / 12) : 0;
      const htmlContent = buildLDMEmail({
        clientGenre: previewData.clientGenre,
        clientPrenom: previewData.clientPrenom,
        clientNom: previewData.clientNom,
        clientRaisonSociale: previewData.clientRaisonSociale,
        missions: previewData.missionsSelectionnees,
        prixAnnuel: previewData.prixAnnuel,
        prixMensuel: monthlyPrice > 0 ? String(monthlyPrice) : '',
        dateEffet: previewData.dateEffet,
        expertName: cabinet.expertNom,
      });
      const result = await sendEmail({
        to: sendRecipient,
        toName: previewData.clientRaisonSociale || previewData.clientNom,
        subject: `Lettre de Mission — ${previewData.clientRaisonSociale || previewData.clientNom} — ${cabinet.nom}`,
        htmlContent,
        attachments: [{ filename, content: base64, type: 'application/pdf' }],
      });
      if (result.success) {
        toast.success(result.demo ? 'Email simulé avec succès (mode démo)' : 'Lettre de Mission envoyée par email ✓');
        setShowSendModal(false);
      } else {
        toast.error(result.error ?? "Erreur lors de l'envoi de l'email");
      }
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setSending(false);
    }
  }, [sendRecipient, previewData, buildPdfBase64]);

  const handleSendSignature = useCallback(async () => {
    if (!previewData) return;
    setSignatureStatus('loading');
    setSignatureError(null);
    setSigningUrl(null);
    try {
      const { base64, filename } = await buildPdfBase64();
      const nameParts = [previewData.clientPrenom, previewData.clientNom]
        .filter(Boolean).join(' ').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Client';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
      const signerPayload = {
        name: `LDM — ${previewData.clientRaisonSociale || previewData.clientNom || 'Client'}`,
        signers: [{
          firstName,
          lastName,
          email: previewData.clientEmail,
          locale: 'fr' as const,
        }],
        documentBase64: base64,
        documentName: filename,
        documentType: 'ldm',
      };

      const raw = signatureProvider === 'jesignexpert'
        ? await createJeSignRequest(signerPayload)
        : await createYousignRequest(signerPayload);

      if (raw.success && raw.data) {
        const url = raw.data.signers[0]?.signatureLink ?? raw.data.signingUrl ?? null;
        const signatureId = raw.data.id ?? (raw.data as { transactionId?: string }).transactionId ?? null;
        setSigningUrl(url);
        setSignatureDemo(raw.demo ?? false);
        setSignatureStatus('success');
        const label = signatureProvider === 'jesignexpert' ? 'JeSignExpert' : 'Yousign';
        toast.success(raw.demo ? `LDM envoyée (mode démo ${label})` : `LDM envoyée via ${label} ✓`);

        // Mise à jour du statut de signature local
        setDocSignatureStatus('sent');
        if (signatureId) {
          setLocalSignatureId(signatureId);
          setLocalSignatureProvider(signatureProvider);
          pollingRef.current = {
            id: signatureId,
            provider: signatureProvider,
            quoteId: selectedQuote?.quoteId ?? '',
          };
        }

        if (selectedQuote) {
          const ldmResult = await updateQuoteLdmData(selectedQuote.quoteId, {
            missionsSelectionnees: previewData.missionsSelectionnees,
            clientSiren: previewData.clientSiren,
            clientRaisonSociale: previewData.clientRaisonSociale,
            clientNom: previewData.clientNom,
            clientPrenom: previewData.clientPrenom,
            clientGenre: previewData.clientGenre,
            clientStatutDirigeant: previewData.clientStatutDirigeant,
            clientAdresse: previewData.clientAdresse,
            clientActivite: previewData.clientActivite,
            clientEmail: previewData.clientEmail,
            clientFormeJuridique: previewData.clientFormeJuridique,
            prixAnnuel: previewData.prixAnnuel,
            ...(signatureId ? { signatureId, signatureProvider } : {}),
          });
          if (!ldmResult.success) {
            toast.warning("Les données LDM n'ont pas pu être liées au devis. Le dossier onboarding devra être rempli manuellement.");
          }
          // Statut → SENT (le statut SIGNED sera mis à jour automatiquement via le polling)
          const statusResult = await updateQuoteStatus(selectedQuote.quoteId, 'SENT');
          if (!statusResult.success) {
            toast.warning("Le statut du devis n'a pas pu être mis à jour. Actualisez manuellement depuis le tableau de bord.");
          } else {
            // Update local list to reflect new status
            setValidatedQuotes(prev =>
              prev.map(q => q.quoteId === selectedQuote.quoteId ? { ...q, status: 'SENT' } : q)
            );
          }
        }
      } else {
        setSignatureError(raw.error ?? "Erreur lors de l'envoi en signature");
        setSignatureStatus('error');
      }
    } catch {
      setSignatureError('Erreur lors de la génération du PDF');
      setSignatureStatus('error');
    }
  }, [previewData, selectedQuote, signatureProvider, buildPdfBase64]);

  // Count selected annexes for badge
  const annexesCount = [
    ldmConfig.annexesCGV,
    ldmConfig.annexesRGPD,
    ldmConfig.annexesPennylane,
    ldmConfig.annexesConfraternel,
    ldmConfig.annexesMandatSEPA,
  ].filter(Boolean).length;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Tableau de bord</span>
            </button>
            <div className="h-4 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-violet-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                    Lettre de Mission
                  </h1>
                  {!manualMode && (selectedQuote || docSignatureStatus !== 'draft') && (
                    <SignatureBadge status={docSignatureStatus} />
                  )}
                </div>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {manualMode ? 'Saisie manuelle' : 'Générée depuis le devis validé'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <button
              onClick={() => navigate('/templates')}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors font-medium"
              title="Bibliothèque de modèles"
            >
              <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Modèles</span>
            </button>
            <button
              onClick={handleDoc}
              disabled={!hasQuote}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-blue-300 bg-blue-50 text-xs sm:text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">DOC</span>
            </button>
            <button
              onClick={handlePdf}
              disabled={!hasQuote}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-blue-600 text-white text-xs sm:text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={handleOpenEmailModal}
              disabled={!hasQuote}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-xs sm:text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Envoyer la LDM par email"
            >
              <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={handleOpenSignModal}
              disabled={!hasQuote || docSignatureStatus === 'signed'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-violet-300 bg-violet-50 text-xs sm:text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={docSignatureStatus === 'signed' ? 'Document déjà signé' : 'Envoyer la LDM en signature électronique'}
            >
              <PenLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">
                {docSignatureStatus === 'sent' ? 'Renvoyer' : 'Signer'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="flex flex-col xl:flex-row gap-6">
          {/* ── Left panel ───────────────────────────────────────────────── */}
          <div className="w-full xl:w-[380px] xl:flex-shrink-0 space-y-4">

            {/* Mode selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => { setManualMode(false); setManualOverrides({ ...EMPTY_OVERRIDES }); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-medium transition-colors ${!manualMode ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                  Depuis un devis
                </button>
                <button
                  onClick={() => { setManualMode(true); setSelectedQuote(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-medium transition-colors ${manualMode ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Saisie manuelle
                </button>
              </div>
            </div>

            {/* ── Quote selector (non-manual mode) ──────────────────────── */}
            {!manualMode && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CloudDownload className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-gray-800">Devis</p>
                  {loadingQuotes && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-auto" />}
                </div>
                {!loadingQuotes && validatedQuotes.length === 0 ? (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Aucun devis validé trouvé. Validez d'abord un devis dans le Moteur de Tarification, ou utilisez la saisie manuelle.
                    </p>
                  </div>
                ) : (
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent disabled:opacity-60"
                    value={selectedQuote?.quoteId ?? ''}
                    onChange={e => {
                      const q = validatedQuotes.find(q => q.quoteId === e.target.value) ?? null;
                      setSelectedQuote(q);
                    }}
                    disabled={loadingQuotes}
                  >
                    <option value="">— Sélectionner un devis —</option>
                    {validatedQuotes.map(q => {
                      const statusSuffix =
                        q.status === 'SIGNED' ? ' ✓ Signé' :
                        q.status === 'SENT'   ? ' · Envoyé' :
                        '';
                      return (
                        <option key={q.quoteId} value={q.quoteId}>
                          {q.clientName}
                          {q.legalForm ? ` · ${q.legalForm}` : ''}
                          {` · ${q.monthlyTotal.toLocaleString('fr-FR')} €/mois`}
                          {statusSuffix}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {/* ── Manual entry form ─────────────────────────────────────── */}
            {manualMode && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <User className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Saisie manuelle</span>
                </div>

                {/* Genre */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Genre</label>
                  <select
                    className={inputCls}
                    value={manualOverrides.clientGenre}
                    onChange={e => setOverride('clientGenre', e.target.value)}
                  >
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Prénom</label>
                    <input className={inputCls} placeholder="Jean" value={manualOverrides.clientPrenom} onChange={e => setOverride('clientPrenom', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nom</label>
                    <input className={inputCls} placeholder="DUPONT" value={manualOverrides.clientNom} onChange={e => setOverride('clientNom', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Raison sociale <span className="text-red-400" aria-hidden="true">*</span></label>
                  <input required aria-required="true" className={inputCls} placeholder="DUPONT SERVICES SARL" value={manualOverrides.clientRaisonSociale} onChange={e => setOverride('clientRaisonSociale', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">SIREN</label>
                    <input className={inputCls} placeholder="123 456 789" value={manualOverrides.clientSiren} onChange={e => setOverride('clientSiren', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Forme juridique</label>
                    <select className={inputCls} value={manualOverrides.clientFormeJuridique} onChange={e => setOverride('clientFormeJuridique', e.target.value)}>
                      {['SARL','SAS','SASU','EURL','SA','SCI','EI','BNC','LMNP','SNC'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email <span className="text-red-400" aria-hidden="true">*</span></label>
                  <input required aria-required="true" type="email" className={inputCls} placeholder="contact@societe.fr" value={manualOverrides.clientEmail} onChange={e => setOverride('clientEmail', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Adresse</label>
                  <input className={inputCls} placeholder="12 rue de la Paix, 75001 Paris" value={manualOverrides.clientAdresse} onChange={e => setOverride('clientAdresse', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Activité</label>
                  <input className={inputCls} placeholder="Commerce de détail" value={manualOverrides.clientActivite} onChange={e => setOverride('clientActivite', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Statut dirigeant</label>
                  <select className={inputCls} value={manualOverrides.clientStatutDirigeant} onChange={e => setOverride('clientStatutDirigeant', e.target.value)}>
                    <option value="de Gérant(e)">de Gérant(e)</option>
                    <option value="de Président(e)">de Président(e)</option>
                    <option value="d'Entrepreneur(e)">d'Entrepreneur(e)</option>
                    <option value="d'Associé(e)">d'Associé(e)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Honoraires annuels HT (€) <span className="text-red-400" aria-hidden="true">*</span></label>
                  <input required aria-required="true" type="number" className={inputCls} placeholder="6000" value={manualOverrides.prixAnnuel} onChange={e => setOverride('prixAnnuel', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date d'effet</label>
                  <input type="date" className={inputCls} value={manualOverrides.dateEffet} onChange={e => setOverride('dateEffet', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date révision annuelle</label>
                    <input className={inputCls} placeholder="1er janvier" value={manualOverrides.dateRevisionAnnuelle} onChange={e => setOverride('dateRevisionAnnuelle', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Préavis (jours)</label>
                    <input type="number" className={inputCls} placeholder="30" value={manualOverrides.delaiPreavisRevision} onChange={e => setOverride('delaiPreavisRevision', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Auto-populated info cards (quote mode) ─────────────────── */}
            {!manualMode && previewData && (
              <>
                {/* Client info — editable */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Client</span>
                    <span className="ml-auto text-[10px] text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" />Auto
                    </span>
                    <span className="text-[10px] text-blue-500 flex items-center gap-0.5 ml-1">
                      <Edit2 className="w-2.5 h-2.5" />cliquer pour éditer
                    </span>
                  </div>
                  <EditableInfoRow label="Genre" fieldKey="clientGenre" value={autoPreviewData?.clientGenre ?? ''} overrideValue={manualOverrides.clientGenre} onOverride={setOverride} />
                  <EditableInfoRow label="Prénom" fieldKey="clientPrenom" value={autoPreviewData?.clientPrenom ?? ''} overrideValue={manualOverrides.clientPrenom} onOverride={setOverride} />
                  <EditableInfoRow label="Nom" fieldKey="clientNom" value={autoPreviewData?.clientNom ?? ''} overrideValue={manualOverrides.clientNom} onOverride={setOverride} />
                  <EditableInfoRow label="Raison sociale" fieldKey="clientRaisonSociale" value={autoPreviewData?.clientRaisonSociale ?? ''} overrideValue={manualOverrides.clientRaisonSociale} onOverride={setOverride} />
                  <EditableInfoRow label="SIREN" fieldKey="clientSiren" value={autoPreviewData?.clientSiren ?? ''} overrideValue={manualOverrides.clientSiren} onOverride={setOverride} />
                  <EditableInfoRow label="Email" fieldKey="clientEmail" value={autoPreviewData?.clientEmail ?? ''} overrideValue={manualOverrides.clientEmail} onOverride={setOverride} type="email" />
                  <EditableInfoRow label="Adresse" fieldKey="clientAdresse" value={autoPreviewData?.clientAdresse ?? ''} overrideValue={manualOverrides.clientAdresse} onOverride={setOverride} />
                  <EditableInfoRow label="Forme juridique" fieldKey="clientFormeJuridique" value={autoPreviewData?.clientFormeJuridique ?? ''} overrideValue={manualOverrides.clientFormeJuridique} onOverride={setOverride} />
                  {(autoPreviewData?.clientActivite || manualOverrides.clientActivite) && (
                    <EditableInfoRow label="Activité" fieldKey="clientActivite" value={autoPreviewData?.clientActivite ?? ''} overrideValue={manualOverrides.clientActivite} onOverride={setOverride} />
                  )}
                  <EditableInfoRow label="Date d'effet" fieldKey="dateEffet" value={autoPreviewData?.dateEffet ?? ''} overrideValue={manualOverrides.dateEffet} onOverride={setOverride} />
                </div>

                {/* Pricing info — editable */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Euro className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Honoraires</span>
                  </div>
                  <InfoRow label="Total mensuel HT" value={`${(selectedQuote?.monthlyTotal ?? 0).toLocaleString('fr-FR')} €`} highlight />
                  <InfoRow label="Total annuel HT" value={`${((selectedQuote?.monthlyTotal ?? 0) * 12).toLocaleString('fr-FR')} €`} />
                  {(selectedQuote?.setupFees ?? 0) > 0 && (
                    <InfoRow label="Frais de dossier" value={`${(selectedQuote?.setupFees ?? 0).toLocaleString('fr-FR')} €`} />
                  )}
                  <div className="pt-1 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 mb-1">Remplacer le montant annuel</p>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Laisser vide pour garder la valeur du devis"
                      value={manualOverrides.prixAnnuel}
                      onChange={e => setOverride('prixAnnuel', e.target.value)}
                    />
                  </div>
                </div>

                {/* Detected missions */}
                {previewData.pricingLines && previewData.pricingLines.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Missions détectées</span>
                    </div>
                    {previewData.pricingLines.map(line => (
                      <div key={line.label} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-gray-700">{line.label}</span>
                        <span className="text-gray-500 flex-shrink-0">{line.montantMensuel.toLocaleString('fr-FR')} €/mois</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick send buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenEmailModal}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />Email
                  </button>
                  <button
                    onClick={handleOpenSignModal}
                    disabled={docSignatureStatus === 'signed'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={docSignatureStatus === 'signed' ? 'Document déjà signé' : 'Envoyer pour signature électronique'}
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    {docSignatureStatus === 'sent' ? 'Renvoyer' : 'Signature'}
                  </button>
                </div>

                {/* Signature status card */}
                <div className={`rounded-xl border p-3 space-y-2 ${
                  docSignatureStatus === 'signed' ? 'bg-emerald-50 border-emerald-200' :
                  docSignatureStatus === 'read'   ? 'bg-yellow-50 border-yellow-200' :
                  docSignatureStatus === 'sent'   ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Statut signature</span>
                    <SignatureBadge status={docSignatureStatus} />
                  </div>
                  {docSignatureStatus === 'sent' && localSignatureId && (
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-600">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Suivi automatique toutes les {SIGNATURE_POLL_INTERVAL_LABEL}
                    </div>
                  )}
                  {docSignatureStatus === 'signed' && (
                    <p className="text-[10px] text-emerald-600 font-medium">
                      La lettre de mission a été signée électroniquement ✓
                    </p>
                  )}
                  {docSignatureStatus === 'draft' && (
                    <p className="text-[10px] text-gray-400">
                      Cliquez sur « Signature » pour envoyer la LDM au signataire.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Empty state (quote mode, no quote selected) */}
            {!manualMode && !previewData && !loadingQuotes && (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 text-center">
                <FileText className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">Sélectionnez un devis validé</p>
                <p className="text-xs text-gray-400 mt-1">La lettre de mission sera générée automatiquement.</p>
                <button
                  onClick={() => setManualMode(true)}
                  className="mt-3 text-xs text-violet-600 hover:text-violet-800 underline"
                >
                  Ou créer une LDM manuellement
                </button>
              </div>
            )}

            {/* ── Config panel (annexes & modele) ───────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowConfigPanel(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <Paperclip className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-700 flex-1 text-left">
                  Annexes &amp; Configuration
                </span>
                {annexesCount > 0 && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                    {annexesCount} annexe{annexesCount > 1 ? 's' : ''}
                  </span>
                )}
                {showConfigPanel
                  ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </button>

              {showConfigPanel && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                  {/* Model type */}
                  <div className="pt-3">
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Modèle de contrat</label>
                    <select
                      className={inputCls}
                      value={ldmConfig.modeleType}
                      onChange={e => setConfigField('modeleType', e.target.value as LdmConfigState['modeleType'])}
                    >
                      <option value="BIC/IS">BIC / IS</option>
                      <option value="BNC">BNC — Professions libérales</option>
                      <option value="Social">Social</option>
                      <option value="IR">Impôt sur le revenu</option>
                    </select>
                  </div>

                  {/* Annexe checkboxes */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 font-medium">Annexes à joindre</label>
                    <div className="space-y-2">
                      {(
                        [
                          { key: 'annexesCGV', label: 'Conditions Générales (CGV)', desc: 'CGV HAYOT EXPERTISE' },
                          { key: 'annexesRGPD', label: 'Annexe RGPD', desc: 'Traitement des données personnelles' },
                          { key: 'annexesPennylane', label: 'Annexe Pennylane', desc: "Utilisation du logiciel" },
                          { key: 'annexesConfraternel', label: 'Reprise confraternelle', desc: 'Clause de reprise de dossier' },
                          { key: 'annexesMandatSEPA', label: 'Mandat SEPA', desc: 'Autorisation de prélèvement' },
                        ] as const
                      ).map(({ key, label, desc }) => (
                        <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                            checked={ldmConfig[key]}
                            onChange={e => setConfigField(key, e.target.checked)}
                          />
                          <div>
                            <p className="text-xs font-medium text-gray-800 group-hover:text-gray-900">{label}</p>
                            <p className="text-[10px] text-gray-400">{desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile preview */}
            {previewData && (
              <div className="xl:hidden">
                <DocumentPreview data={previewData} rawTemplate={rawTemplate} />
              </div>
            )}

            {/* Manual mode quick-send buttons */}
            {manualMode && previewData && (
              <div className="flex gap-2">
                <button
                  onClick={handleOpenEmailModal}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />Email
                </button>
                <button
                  onClick={handleOpenSignModal}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                >
                  <PenLine className="w-3.5 h-3.5" />Signature
                </button>
              </div>
            )}
          </div>

          {/* ── Right panel — A4 preview (desktop only) ──────────────────── */}
          <div className="flex-1 min-w-0 hidden xl:block">
            <div className="sticky top-[88px]">
              {previewData ? (
                <DocumentPreview data={previewData} rawTemplate={rawTemplate} />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-slate-100 overflow-hidden">
                  <div className="flex items-center px-4 py-2.5 bg-white border-b border-gray-200">
                    <span className="text-xs text-gray-400">Aperçu · Lettre de Mission A4</span>
                  </div>
                  <div
                    className="flex items-center justify-center"
                    style={{ height: 'calc(100vh - 160px)', minHeight: '600px' }}
                  >
                    <div className="text-center text-gray-400">
                      <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-500">Aucun document en cours</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Choisissez un devis validé ou utilisez la saisie manuelle
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Send by Email Modal ─────────────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Envoyer la Lettre de Mission par email</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-gray-500">La LDM sera générée en PDF et envoyée en pièce jointe.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Adresse email du destinataire <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="client@societe.fr"
                  value={sendRecipient}
                  onChange={e => setSendRecipient(e.target.value)}
                  autoFocus
                />
              </div>
              {previewData?.clientRaisonSociale && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <strong>Société :</strong> {previewData.clientRaisonSociale}
                  {previewData.missionsSelectionnees.length > 0 && (
                    <span className="ml-2 text-gray-400">
                      · {previewData.missionsSelectionnees.length} mission{previewData.missionsSelectionnees.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
              {annexesCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Paperclip className="w-3.5 h-3.5" />
                  {annexesCount} annexe{annexesCount > 1 ? 's' : ''} incluse{annexesCount > 1 ? 's' : ''} dans le PDF
                </div>
              )}
            </div>
            <div className="px-5 pb-4 flex gap-2 justify-end">
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending || !sendRecipient}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Envoi en cours…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Electronic Signature Modal ─────────────────────────────────────── */}
      {showSignModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <PenLine className="w-4 h-4 text-violet-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Signature électronique de la LDM</h2>
              </div>
              <button onClick={() => setShowSignModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {signatureStatus === 'idle' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prestataire de signature</label>
                    <div className="flex gap-2">
                      {(['yousign', 'jesignexpert'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setSignatureProvider(p)}
                          className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${signatureProvider === p ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        >
                          <span className="font-medium">{p === 'yousign' ? 'Yousign' : 'JeSignExpert (OEC)'}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${p === 'yousign' ? connections.yousign.connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700' : connections.jesignexpert.connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p === 'yousign' ? (connections.yousign.connected ? 'Live' : 'Démo') : (connections.jesignexpert.connected ? 'Live' : 'Démo')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Signataire</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{[previewData.clientGenre, previewData.clientPrenom, previewData.clientNom].filter(Boolean).join(' ') || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className={previewData.clientEmail ? 'text-gray-700' : 'text-amber-600 italic'}>
                        {previewData.clientEmail || 'Email non disponible'}
                      </span>
                    </div>
                    {previewData.clientRaisonSociale && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{previewData.clientRaisonSociale}</span>
                      </div>
                    )}
                  </div>

                  {!previewData.clientEmail && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        L'adresse email du signataire est absente. Cliquez sur le champ Email dans le panneau client pour le saisir.
                      </p>
                    </div>
                  )}

                  {annexesCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <Paperclip className="w-3.5 h-3.5" />
                      {annexesCount} annexe{annexesCount > 1 ? 's' : ''} incluse{annexesCount > 1 ? 's' : ''} dans le document signé
                    </div>
                  )}
                </>
              )}

              {signatureStatus === 'loading' && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                  <p className="text-sm text-gray-600">Génération du PDF et envoi en signature…</p>
                </div>
              )}

              {signatureStatus === 'success' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-emerald-800">LDM envoyée en signature</p>
                        {signatureDemo && (
                          <span className="text-xs font-normal bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Démo</span>
                        )}
                        <SignatureBadge status="sent" />
                      </div>
                      <p className="text-xs text-emerald-700">
                        Email envoyé à <strong>{previewData.clientEmail}</strong> via{' '}
                        {signatureProvider === 'jesignexpert' ? 'JeSignExpert' : 'Yousign'}.
                      </p>
                      {localSignatureId && (
                        <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Statut mis à jour automatiquement toutes les {SIGNATURE_POLL_INTERVAL_LABEL}
                        </p>
                      )}
                    </div>
                  </div>
                  {signingUrl && (
                    <a
                      href={signingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ouvrir le lien de signature
                    </a>
                  )}
                </div>
              )}

              {signatureStatus === 'error' && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Erreur lors de l'envoi</p>
                    <p className="text-xs text-red-600 mt-0.5">{signatureError}</p>
                    <button onClick={() => setSignatureStatus('idle')} className="text-xs text-red-700 underline mt-1">Réessayer</button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 pb-4 flex gap-2 justify-end">
              <button
                onClick={() => { setShowSignModal(false); setSignatureStatus('idle'); }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {signatureStatus === 'success' ? 'Fermer' : 'Annuler'}
              </button>
              {signatureStatus === 'idle' && (
                <button
                  onClick={handleSendSignature}
                  disabled={!previewData.clientEmail}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Envoyer pour signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

