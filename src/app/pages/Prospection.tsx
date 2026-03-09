import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Radar, Search, Mail, Filter, Bookmark, BookmarkCheck,
  Building2, User, Phone, Tag, Send, X, SlidersHorizontal,
  Loader2, MapPin, Calendar, BarChart2, Briefcase, ChevronRight,
  MessageSquare, Check, RefreshCw, ExternalLink,
  Eye, MousePointerClick, Sparkles, PhoneCall, Linkedin,
  TrendingUp, CalendarDays, KanbanSquare, List, Map as MapIcon,
  Zap, CalendarCheck, PartyPopper, XCircle, Clock, ArrowLeft,
  Download, Upload, Trash2, Pencil, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  type Prospect, type ProspectSource, type ProspectDirigeant,
  searchProspects,
} from '../services/prospectApi';
import { EmailCampaignModal, type SequenceStepConfig } from '../components/EmailCampaignModal';
import { ProspectKanban, type KanbanColumn, statusToKanban, kanbanToStatus } from '../components/ProspectKanban';
import { ProspectMapView } from '../components/ProspectMapView';
import { computeLeadScore, scoreColorClass, getCabinetSpecialty, type CabinetSpecialty } from '../utils/leadScoring';
import { getCabinetInfo, getServiceConnections, getEmailConfig } from '../utils/servicesStorage';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { exportProspectsToExcel } from '../utils/excelUtils';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import type { RsvpStatus } from './EventsCampaign';
import { useProspectStore, type ProspectRow } from '../store/useProspectStore';
import { getQuotesByProspect, generateQuoteAcceptToken, type ProspectQuote } from '../utils/supabaseSync';
import { sendEmail } from '../services/emailService';

// ─── Local types ──────────────────────────────────────────────────────────────

type LeadStatus = 'nouveau' | 'contacte' | 'interesse' | 'non-interesse';
type LeadEntry  = Prospect & {
  /** UUID primary key from Supabase */
  id: string;
  statut: LeadStatus;
  /** Tracking email (Chantier 7) */
  openCount: number;
  clicked: boolean;
  emailSentAt?: string;
  /** AI icebreaker (Chantier 8) */
  icebreakerIa?: string;
  icebreakerLoading?: boolean;
  /** Kanban column (Chantier 9) */
  kanbanColumn: KanbanColumn;
  /** Email sequence (Chantier 6) */
  sequenceStep: number;
  nextFollowUpDate?: string;
  /** Call log (Chantier 10) */
  callLogs: string[];
  /** Lead score 0-100 (Chantier Lead Scoring) */
  leadScore: number;
  /** Event RSVP status (Événements Locaux) */
  eventStatus?: RsvpStatus;
  eventId?: string;
  /** Valeur financière estimée du contrat (€) */
  estimatedValue?: number | null;
  /** Date de la prochaine action commerciale */
  nextActionDate?: string | null;
};

interface Filters {
  search: string;
  secteur: string[];      // Changed to array for multi-select
  formeJuridique: string[]; // Changed to array for multi-select
  zone: string;
  effectif: string[];     // Changed to array for multi-select
}

interface SavedSearch {
  id: string;
  name: string;
  filters: Filters;
}

// ─── Static look-up data ──────────────────────────────────────────────────────

const SECTEURS = [
  { value: 'Communication',        label: '📣 Communication / Marketing' },
  { value: 'Construction',         label: '🏗️ Construction' },
  { value: 'Commerce',             label: '🛒 Commerce de détail' },
  { value: 'Immobilier',           label: '🏢 Immobilier' },
  { value: 'Informatique',         label: '💻 Informatique / IT' },
  { value: 'Restauration',         label: '🍽️ Restauration / Hôtellerie' },
  { value: 'Santé',                label: '🏥 Santé / Médical' },
  { value: 'Services financiers',  label: '💼 Services financiers' },
  { value: 'Transport',            label: '🚛 Transport / Logistique' },
];

const FORMES_JURIDIQUES = [
  { value: 'EI',          label: 'EI / Auto-entrepreneur' },
  { value: 'EURL',        label: 'EURL' },
  { value: 'SA',          label: 'SA' },
  { value: 'SAS',         label: 'SAS / SASU' },
  { value: 'SARL',        label: 'SARL' },
  { value: 'SCI',         label: 'SCI' },
  { value: 'Association', label: 'Association' },
];

const EFFECTIFS = [
  { value: '0',         label: '0 salarié' },
  { value: '1-2',       label: '1 à 2 salariés' },
  { value: '3-5',       label: '3 à 5 salariés' },
  { value: '6-9',       label: '6 à 9 salariés' },
  { value: '10-19',     label: '10 à 19 salariés' },
  { value: '20-49',     label: '20 à 49 salariés' },
  { value: '50-99',     label: '50 à 99 salariés' },
  { value: '100-199',   label: '100 à 199 salariés' },
  { value: '200-499',   label: '200 à 499 salariés' },
  { value: '500+',      label: '500+ salariés' },
];

const STATUS_CONFIG: Record<LeadStatus, { label: string; pill: string; select: string }> = {
  nouveau:         { label: 'Nouveau',       pill: 'bg-blue-100 text-blue-700',    select: 'bg-blue-50 text-blue-700 border-blue-200' },
  contacte:        { label: 'Contacté',      pill: 'bg-amber-100 text-amber-700',  select: 'bg-amber-50 text-amber-700 border-amber-200' },
  interesse:       { label: 'Intéressé',     pill: 'bg-emerald-100 text-emerald-700', select: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'non-interesse': { label: 'Non intéressé', pill: 'bg-slate-100 text-slate-500',  select: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const SOURCE_LABEL: Record<ProspectSource, { text: string; className: string }> = {
  api_direct: { text: '● API directe',   className: 'text-emerald-600' },
  api_proxy:  { text: '● Proxy CORS',    className: 'text-amber-600'   },
  demo:       { text: '⚠ Données démo', className: 'text-slate-400'   },
};

const DEFAULT_FILTERS: Filters = { search: '', secteur: [], formeJuridique: [], zone: '', effectif: [] };

// ─── Helper: safely access STATUS_CONFIG with fallback to 'nouveau' ──────────

function getStatusConfig(statut: string | null | undefined): typeof STATUS_CONFIG['nouveau'] {
  const validStatut = statut as LeadStatus | null | undefined;
  return STATUS_CONFIG[validStatut as LeadStatus] || STATUS_CONFIG['nouveau'];
}

// ─── Helper: extract dept number from zone text ───────────────────────────────

function extractDept(zone: string): string | undefined {
  return /^\d{2,3}$/.test(zone.trim()) ? zone.trim() : undefined;
}

// ─── Helper: convert DB ProspectRow → local LeadEntry ─────────────────────────

function storeRowToLead(
  p: ProspectRow,
  ctx: { cabinetPostalCode: string; specialty: CabinetSpecialty }
): LeadEntry {
  const prospect: Prospect = {
    // When SIREN is absent (rare for small companies), fall back to the DB UUID to
    // ensure each lead has a unique, stable key. The siren field in Prospect is
    // typed as string (non-nullable) so we need a non-empty string fallback.
    siren:                 p.siren ?? p.id,
    siret:                 p.siret ?? '',
    nomSociete:            p.company_name,
    formeJuridique:        p.forme_juridique ?? '',
    libelleFormeJuridique: p.libelle_forme_juridique ?? p.forme_juridique ?? '',
    codeNAF:               p.naf_code ?? '',
    libelleNAF:            p.libelle_naf ?? '',
    secteur:               p.secteur_activite ?? 'Autre',
    adresse:               p.address ?? '',
    codePostal:            p.postal_code ?? '',
    ville:                 p.city ?? '',
    departement:           p.departement ?? '',
    dateCreation:          p.date_creation ?? '',
    effectif:              p.effectif ?? '',
    capitalSocial:         p.capital_social ?? '',
    categorieEntreprise:   p.categorie_entreprise ?? '',
    dirigeants:            (p.dirigeants ?? []) as ProspectDirigeant[],
    dirigeantPrincipal:    (p.dirigeant_principal ?? null) as ProspectDirigeant | null,
    email:                 p.contact_email ?? '',
    telephone:             p.telephone ?? '',
  };
  // Map the DB status (which equals the KanbanColumn value, e.g. 'email-envoye')
  // to the local LeadStatus used by the UI (e.g. 'contacte').
  // The DB CHECK constraint accepts only KanbanColumn values, so we must never
  // validate against the old local-status list here.
  // `kanbanToStatus` has a safe default → 'nouveau' for any unknown value.
  const validatedStatus: LeadStatus = kanbanToStatus(
    (p.status || 'a-contacter') as KanbanColumn
  ) as LeadStatus;

  return {
    ...prospect,
    id:                  p.id,
    statut:              validatedStatus,
    openCount:           p.open_count ?? 0,
    clicked:             p.clicked ?? false,
    emailSentAt:         p.email_sent_at ?? undefined,
    icebreakerIa:        p.icebreaker_ia ?? undefined,
    kanbanColumn:        (p.kanban_column ?? 'a-contacter') as KanbanColumn,
    sequenceStep:        p.sequence_step ?? 0,
    nextFollowUpDate:    p.next_follow_up_date ?? undefined,
    callLogs:            p.call_logs ?? [],
    leadScore:           computeLeadScore(prospect, p.open_count ?? 0, ctx).total,
    estimatedValue:      p.estimated_value ?? null,
    nextActionDate:      p.next_action_date ?? null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Prospection() {
  const navigate = useNavigate();

  // ── Store (Supabase persistence) ──────────────────────────────────────────
  const {
    prospects: storeProspects,
    fetchProspects,
    updateProspectStatus,
    updateProspectFields,
    deleteProspect,
    selectedSecteur: storeSecteur,
    setSelectedSecteur: setStoreSecteur,
  } = useProspectStore();

  // ── Leads state ───────────────────────────────────────────────────────────
  const [leads, setLeads]               = useState<LeadEntry[]>([]);
  const [leadsInitialized, setLeadsInitialized] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [apiSource, setApiSource]       = useState<ProspectSource>('demo');
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const PER_PAGE = 100;  // Load 100 at a time, max 500 total
  const MAX_RESULTS = 500;

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // ── Saved searches ────────────────────────────────────────────────────────
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showSaveInput, setShowSaveInput]   = useState(false);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  // ── Excel Import/Export ───────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);

  // ── View mode (Chantier 9 + 11) ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'carte'>('list');

  // ── Icebreaker generation loading (Chantier 8) ────────────────────────────
  const [generatingIcebreakers, setGeneratingIcebreakers] = useState(false);

  // ── Call log draft (Chantier 10) ─────────────────────────────────────────
  const [callLogDraft, setCallLogDraft] = useState('');

  // ── CRM field drafts (estimated value & next action date) ─────────────────
  const [draftEstimatedValue, setDraftEstimatedValue] = useState('');
  const [draftNextActionDate, setDraftNextActionDate] = useState('');
  const [crmSaved, setCrmSaved] = useState(false);
  const crmSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sheet (prospect detail) ───────────────────────────────────────────────
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetTab, setSheetTab] = useState<'details' | 'timeline'>('details');

  // ── Sheet edit mode ───────────────────────────────────────────────────────
  const [isEditingSheet, setIsEditingSheet] = useState(false);
  const [editDraftCompanyName, setEditDraftCompanyName] = useState('');
  const [editDraftEmail, setEditDraftEmail] = useState('');
  const [editDraftPhone, setEditDraftPhone] = useState('');
  const [editDraftAddress, setEditDraftAddress] = useState('');
  const [editDraftCity, setEditDraftCity] = useState('');
  const [editDraftPostalCode, setEditDraftPostalCode] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Delete confirmation (single prospect from sheet) ─────────────────────
  const [showDeleteOneConfirm, setShowDeleteOneConfirm] = useState(false);
  const [deletingOneId, setDeletingOneId] = useState<string | null>(null);

  // ── Mass delete confirmation ──────────────────────────────────────────────
  const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false);

  // ── Quotes map (keyed by prospect id) ────────────────────────────────────
  const [quotesMap, setQuotesMap] = useState<Record<string, ProspectQuote[]>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);

  // ── Notes (persisted per siren) ───────────────────────────────────────────
  const statusMapRef                        = useRef<Record<string, LeadStatus>>({});
  const [notesMap, setNotesMap]             = useState<Record<string, string>>({});
  const [draftNote, setDraftNote]           = useState('');
  const [noteSaved, setNoteSaved]           = useState(false);
  const noteSavedTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active lead derived from sheetId
  const activeLead = sheetId
    ? leads.find(l => l.id === sheetId) ?? null
    : null;

  // Sync draft when sheet switches lead
  useEffect(() => {
    setDraftNote(sheetId ? (notesMap[sheetId] ?? '') : '');
    setNoteSaved(false);
    const lead = sheetId ? leads.find(l => l.id === sheetId) : null;
    setDraftEstimatedValue(lead?.estimatedValue != null ? String(lead.estimatedValue) : '');
    setDraftNextActionDate(lead?.nextActionDate ?? '');
    setCrmSaved(false);
    // Reset edit mode and tab whenever we switch prospects
    setIsEditingSheet(false);
    setSheetTab('details');
  }, [sheetId, leads, notesMap]);

  // ── Load DB prospects on mount ────────────────────────────────────────────
  useEffect(() => {
    fetchProspects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load quotes when a prospect sheet opens ───────────────────────────────
  useEffect(() => {
    if (!sheetId) return;
    // Only fetch if we don't already have quotes loaded for this prospect
    if (quotesMap[sheetId] !== undefined) return;
    const prospectRow = storeProspects.find(p => p.id === sheetId);
    if (!prospectRow) return;
    setQuotesLoading(true);
    getQuotesByProspect(prospectRow.id).then(result => {
      if (result.success) {
        setQuotesMap(prev => ({ ...prev, [sheetId]: result.quotes }));
      }
      setQuotesLoading(false);
    });
  }, [sheetId, storeProspects, quotesMap]);

  // ── Sync store.prospects → local leads (initial load only) ───────────────
  useEffect(() => {
    if (storeProspects.length > 0 && !leadsInitialized) {
      const ctx = { cabinetPostalCode: getCabinetInfo().codePostal || '69000', specialty: getCabinetSpecialty() };
      setLeads(storeProspects.map(p => storeRowToLead(p, ctx)));
      setLeadsInitialized(true);
    }
  }, [storeProspects, leadsInitialized]);

  // ── Lead scoring context (Chantier Lead Scoring) ─────────────────────────
  const [specialty] = useState<CabinetSpecialty>(() => getCabinetSpecialty());
  const scoringCtx = useMemo(() => {
    const cabinet = getCabinetInfo();
    return { cabinetPostalCode: cabinet.codePostal || '69000', specialty };
  }, [specialty]);

  // ── SIREN → store ID map for efficient status persistence ───────────────
  const sirenToStoreId = useMemo(
    // Key: p.siren ?? p.id — mirrors the siren field produced by storeRowToLead
    () => new Map(storeProspects.map(p => [p.siren ?? p.id, p.id])),
    [storeProspects]
  );

  // ── Unique sectors from DB prospects (for the store sector dropdown) ───────
  const uniqueSectors = useMemo(() => {
    const sectors = new Set<string>();
    storeProspects.forEach(p => {
      if (p.secteur_activite) sectors.add(p.secteur_activite);
    });
    return Array.from(sectors).sort();
  }, [storeProspects]);

  // ── Client-side filter (search + storeSecteur filter) ─────────────────────
  const filtered = useMemo(() => {
    let result = leads;
    if (storeSecteur) {
      result = result.filter(l => l.secteur === storeSecteur);
    }
    if (!filters.search.trim()) return result;
    const q = filters.search.toLowerCase();
    return result.filter(l =>
      l.nomSociete?.toLowerCase().includes(q) ||
      (l.dirigeantPrincipal?.nom?.toLowerCase().includes(q)) ||
      (l.dirigeantPrincipal?.prenom?.toLowerCase().includes(q)) ||
      l.email?.toLowerCase().includes(q) ||
      l.ville?.toLowerCase().includes(q)
    );
  }, [leads, filters.search, storeSecteur]);

  const hasActiveFilter =
    filters.secteur.length > 0 ||
    filters.formeJuridique.length > 0 ||
    filters.zone.trim() !== '' ||
    filters.effectif.length > 0 ||
    filters.search.trim() !== '';

  // ── Selection helpers ─────────────────────────────────────────────────────
  const selectedCount = filtered.filter(l => selected.has(l.siren)).length;
  const allSelected   = filtered.length > 0 && filtered.every(l => selected.has(l.siren));
  const someSelected  = filtered.some(l => selected.has(l.siren)) && !allSelected;

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach(l => next.delete(l.siren));
      else             filtered.forEach(l => next.add(l.siren));
      return next;
    });
  }

  function toggleOne(siren: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(siren)) next.delete(siren); else next.add(siren);
      return next;
    });
  }

  // ── Status update (table + sheet) — also syncs kanban column + Supabase ──
  async function changeStatus(siren: string, statut: LeadStatus) {
    const prevLead = leads.find(l => l.siren === siren);
    if (!prevLead) return;

    try {
      statusMapRef.current[siren] = statut;
      const kanbanCol = statusToKanban(statut);
      setLeads(prev => prev.map(l => l.siren === siren
        ? { ...l, statut, kanbanColumn: kanbanCol }
        : l
      ));
      // Persist to Supabase if this prospect is saved in the store.
      // Use kanbanCol (KanbanColumn value) as the DB status — the DB CHECK constraint
      // only accepts KanbanColumn values, not the local LeadStatus values.
      const storeId = sirenToStoreId.get(siren);
      if (storeId) {
        const result = await updateProspectStatus(storeId, kanbanCol, kanbanCol);
        if (!result.success) {
          // Revert optimistic update
          statusMapRef.current[siren] = prevLead.statut;
          setLeads(prev => prev.map(l => l.siren === siren ? prevLead : l));
          toast.error('Impossible de sauvegarder le statut. Veuillez réessayer.');
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      statusMapRef.current[siren] = prevLead.statut;
      setLeads(prev => prev.map(l => l.siren === siren ? prevLead : l));
      console.error('Error changing status:', error);
      toast.error('Une erreur est survenue lors de la mise à jour du statut.');
    }
  }

  // ── Kanban column move (Chantier 9) — persists to Supabase ───────────────
  async function moveCard(id: string, column: KanbanColumn) {
    const newStatus = (() => {
      switch (column) {
        case 'email-envoye':    return 'contacte' as LeadStatus;
        case 'en-negociation':  return 'interesse' as LeadStatus;
        case 'gagne':           return 'interesse' as LeadStatus;
        case 'perdu':           return 'non-interesse' as LeadStatus;
        default:                return 'nouveau' as LeadStatus;
      }
    })();
    const prevLead = leads.find(l => l.id === id);
    if (!prevLead) return;

    try {
      statusMapRef.current[id] = newStatus;
      setLeads(prev => prev.map(l => l.id === id
        ? { ...l, kanbanColumn: column, statut: newStatus }
        : l
      ));
      // Persist to Supabase only if this prospect exists in the store (has a DB row).
      // For API search leads not yet saved to DB, id falls back to the SIREN which
      // won't match any storeProspect.id, so we skip the DB update.
      // IMPORTANT: the DB `status` column has a CHECK constraint that accepts only
      // KanbanColumn values ('a-contacter', 'email-envoye', …), NOT local LeadStatus
      // values ('contacte', 'interesse', …). We therefore pass `column` for both
      // the status and kanban_column fields.
      const isDbLead = storeProspects.some(p => p.id === id);
      if (isDbLead) {
        const result = await updateProspectStatus(id, column, column);
        if (!result.success) {
          // Revert optimistic update
          statusMapRef.current[id] = prevLead.statut;
          setLeads(prev => prev.map(l => l.id === id ? prevLead : l));
          toast.error('Impossible de déplacer le prospect. Veuillez réessayer.');
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      statusMapRef.current[id] = prevLead.statut;
      setLeads(prev => prev.map(l => l.id === id ? prevLead : l));
      console.error('Error moving card:', error);
      toast.error('Une erreur est survenue lors du déplacement du prospect.');
    }
  }

  // ── API search ────────────────────────────────────────────────────────────
  async function handleSearch() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setCurrentPage(1);

    try {
      const dept = extractDept(filters.zone);
      const zoneQ = dept ? undefined : filters.zone.trim() || undefined;

      const result = await searchProspects({
        q:              zoneQ,
        secteur:        filters.secteur.length > 0 ? filters.secteur : undefined,
        formeJuridique: filters.formeJuridique.length > 0 ? filters.formeJuridique : undefined,
        departement:    dept,
        page:           1,
        perPage:        PER_PAGE,
      });

      if (result.success) {
        // Merge API results with saved statuses from the store.
        // Key: siren — all API prospects have a SIREN. Store prospects may fall
        // back to their UUID when SIREN is null to avoid key collisions.
        const storeMap = new Map(useProspectStore.getState().prospects.map(p => [p.siren ?? p.id, p]));
        const newLeads = result.prospects.map(p => {
          // API prospects always have a SIREN; look up by SIREN only.
          const saved = storeMap.get(p.siren);
          // Use UUID when available, otherwise fall back to SIREN. statusMapRef is
          // keyed the same way so the cache lookup stays consistent with moveCard.
          const leadId = saved?.id ?? p.siren;
          // DB `status` stores KanbanColumn values ('email-envoye', …); convert to
          // local LeadStatus ('contacte', …) for the UI. The statusMapRef fallback
          // already stores local LeadStatus values (written by moveCard/changeStatus).
          const dbStatut = saved?.status
            ? (kanbanToStatus(saved.status as KanbanColumn) as LeadStatus)
            : undefined;
          return {
            ...p,
            id:              leadId,
            statut: (dbStatut ?? statusMapRef.current[leadId] ?? 'nouveau') as LeadStatus,
            openCount: saved?.open_count ?? 0,
            clicked: saved?.clicked ?? false,
            emailSentAt: saved?.email_sent_at ?? undefined,
            icebreakerIa: saved?.icebreaker_ia ?? undefined,
            kanbanColumn: ((saved?.kanban_column ?? statusToKanban(statusMapRef.current[leadId] ?? 'nouveau'))) as KanbanColumn,
            sequenceStep: saved?.sequence_step ?? 0,
            nextFollowUpDate: saved?.next_follow_up_date ?? undefined,
            callLogs: saved?.call_logs ?? [],
            leadScore: computeLeadScore(p, saved?.open_count ?? 0, scoringCtx).total,
          };
        });
        setLeads(newLeads);
        setLeadsInitialized(true);
        setTotalResults(result.total);
        setApiSource(result.source);
        // Check if there are more results and we haven't hit the limit
        setHasMore(result.total > PER_PAGE && newLeads.length < MAX_RESULTS);
      } else {
        setError(result.error);
        toast.error(`Erreur de recherche: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Error in handleSearch:', error);
      toast.error(`Une erreur est survenue lors de la recherche: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Load more results ─────────────────────────────────────────────────────
  async function loadMore() {
    if (loading || !hasMore || leads.length >= MAX_RESULTS) return;

    setLoading(true);

    try {
      const nextPage = currentPage + 1;

      const dept = extractDept(filters.zone);
      const zoneQ = dept ? undefined : filters.zone.trim() || undefined;

      const result = await searchProspects({
        q:              zoneQ,
        secteur:        filters.secteur.length > 0 ? filters.secteur : undefined,
        formeJuridique: filters.formeJuridique.length > 0 ? filters.formeJuridique : undefined,
        departement:    dept,
        page:           nextPage,
        perPage:        PER_PAGE,
      });

      if (result.success) {
        const storeMap2 = new Map(useProspectStore.getState().prospects.map(p => [p.siren ?? p.id, p]));
        const newLeads = result.prospects.map(p => {
          // API prospects always have a SIREN; look up by SIREN only.
          const saved = storeMap2.get(p.siren);
          // Use UUID when available, otherwise fall back to SIREN. statusMapRef is
          // keyed the same way so the cache lookup stays consistent with moveCard.
          const leadId = saved?.id ?? p.siren;
          // DB `status` stores KanbanColumn values; convert to local LeadStatus for UI.
          const dbStatut = saved?.status
            ? (kanbanToStatus(saved.status as KanbanColumn) as LeadStatus)
            : undefined;
          return {
            ...p,
            id:              leadId,
            statut: (dbStatut ?? statusMapRef.current[leadId] ?? 'nouveau') as LeadStatus,
            openCount: saved?.open_count ?? 0,
            clicked: saved?.clicked ?? false,
            emailSentAt: saved?.email_sent_at ?? undefined,
            icebreakerIa: saved?.icebreaker_ia ?? undefined,
            kanbanColumn: ((saved?.kanban_column ?? statusToKanban(statusMapRef.current[leadId] ?? 'nouveau'))) as KanbanColumn,
            sequenceStep: saved?.sequence_step ?? 0,
            nextFollowUpDate: saved?.next_follow_up_date ?? undefined,
            callLogs: saved?.call_logs ?? [],
            leadScore: computeLeadScore(p, saved?.open_count ?? 0, scoringCtx).total,
          };
        });

        const combined = [...leads, ...newLeads];
        // Limit to MAX_RESULTS
        const limited = combined.slice(0, MAX_RESULTS);
        setLeads(limited);
        setCurrentPage(nextPage);
        // Check if we can load more
        setHasMore(result.total > (nextPage * PER_PAGE) && limited.length < MAX_RESULTS);
      } else {
        toast.error(`Impossible de charger plus de résultats: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Error in loadMore:', error);
      toast.error(`Une erreur est survenue lors du chargement: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Saved searches ────────────────────────────────────────────────────────
  function saveSearch() {
    if (!saveSearchName.trim()) return;
    setSavedSearches(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: saveSearchName.trim(), filters: { ...filters } },
    ]);
    setSaveSearchName('');
    setShowSaveInput(false);
  }

  function loadSearch(s: SavedSearch) { setFilters(s.filters); }
  function deleteSearch(id: string)   { setSavedSearches(prev => prev.filter(s => s.id !== id)); }

  // ── Campaign — opens the modal ────────────────────────────────────────────
  const selectedProspects = filtered.filter(l => selected.has(l.siren));

  function openCampaignModal() {
    if (selectedProspects.length > 0) setShowCampaignModal(true);
  }

  // ── Campaign sent callback — update tracking state + persist to Supabase ──
  function handleCampaignSent(count: number, sequenceSteps: SequenceStepConfig[]) {
    if (count > 0) {
      const now = new Date().toISOString();
      const hasSequence = sequenceSteps.some(s => s.enabled);
      const nextStep = sequenceSteps.find(s => s.enabled);
      const nextDate = nextStep
        ? new Date(Date.now() + nextStep.delayDays * 86_400_000).toISOString()
        : undefined;

      // Snapshot the affected SIRENs before clearing selection
      const affectedSirens = new Set(
        Array.from(selected).filter(siren => {
          const lead = leads.find(l => l.siren === siren);
          return lead?.email;
        })
      );

      // Update local UI
      setLeads(prev => prev.map(l => {
        if (!affectedSirens.has(l.siren)) return l;
        return {
          ...l,
          emailSentAt: now,
          kanbanColumn: 'email-envoye' as KanbanColumn,
          statut: 'contacte' as LeadStatus,
          sequenceStep: hasSequence ? 1 : 0,
          nextFollowUpDate: nextDate,
        };
      }));

      // Persist each affected prospect to Supabase (updateProspectFields already
      // handles individual errors with toast + optimistic revert)
      const persistPromises = Array.from(affectedSirens).map(siren => {
        const storeId = sirenToStoreId.get(siren);
        if (!storeId) return Promise.resolve();
        return updateProspectFields(storeId, {
          // DB `status` CHECK constraint requires KanbanColumn values, not local LeadStatus
          status:               'email-envoye',
          kanban_column:        'email-envoye',
          email_sent_at:        now,
          sequence_step:        hasSequence ? 1 : 0,
          next_follow_up_date:  nextDate ?? null,
        });
      });
      Promise.allSettled(persistPromises).then(results => {
        const failures = results.filter(r => r.status === 'rejected').length;
        if (failures > 0) {
          toast.error(`${failures} prospect(s) non sauvegardé(s) en base`);
        }
      });

      setSelected(new Set());
    }
  }

  // ── Mass delete selected prospects ───────────────────────────────────────
  async function handleDeleteSelected() {
    const sirenSet = new Set(selected);
    const idsToDelete: string[] = [];
    for (const siren of selected) {
      const storeId = sirenToStoreId.get(siren);
      if (storeId) idsToDelete.push(storeId);
    }
    // Snapshot leads to restore on total failure
    const prevLeads = leads;
    // Optimistic update
    setLeads(prev => prev.filter(l => !sirenSet.has(l.siren)));
    setSelected(new Set());
    setShowMassDeleteConfirm(false);
    const results = await Promise.allSettled(
      idsToDelete.map(id => deleteProspect(id))
    );
    const errorCount = results.filter(
      r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length;
    if (errorCount === idsToDelete.length && idsToDelete.length > 0) {
      // Total failure — revert
      setLeads(prevLeads);
      setSelected(sirenSet);
      toast.error('La suppression a échoué. Veuillez réessayer.');
    } else if (errorCount > 0) {
      toast.error(`${errorCount} prospect(s) n'ont pas pu être supprimés.`);
    } else {
      toast.success(`${idsToDelete.length} prospect(s) supprimé(s) avec succès.`);
    }
  }

  // ── Delete single prospect (from sheet) ──────────────────────────────────
  async function handleDeleteOne(id: string) {
    const lead = leads.find(l => l.id === id);
    const name = lead?.nomSociete ?? 'ce prospect';
    // Optimistic update
    setLeads(prev => prev.filter(l => l.id !== id));
    if (sheetId === id) setSheetId(null);
    setShowDeleteOneConfirm(false);
    setDeletingOneId(null);
    const result = await deleteProspect(id);
    if (!result.success) {
      toast.error(`Impossible de supprimer "${name}". Veuillez réessayer.`);
      // Revert — reload from store
      const ctx = { cabinetPostalCode: getCabinetInfo().codePostal || '69000', specialty };
      setLeads(useProspectStore.getState().prospects.map(p => storeRowToLead(p, ctx)));
    } else {
      toast.success(`"${name}" supprimé avec succès.`);
    }
  }

  // ── Enter edit mode for the active sheet prospect ─────────────────────────
  function startEditingSheet() {
    if (!activeLead) return;
    setEditDraftCompanyName(activeLead.nomSociete ?? '');
    setEditDraftEmail(activeLead.email ?? '');
    setEditDraftPhone(activeLead.telephone ?? '');
    setEditDraftAddress(activeLead.adresse ?? '');
    setEditDraftCity(activeLead.ville ?? '');
    setEditDraftPostalCode(activeLead.codePostal ?? '');
    setIsEditingSheet(true);
  }

  // ── Save inline edits ─────────────────────────────────────────────────────
  async function handleSaveEdit() {
    if (!sheetId || !activeLead) return;
    const fields = {
      // company_name is required (NOT NULL) — keep existing value if draft is empty
      company_name: editDraftCompanyName.trim() || activeLead.nomSociete,
      // Optional fields — null clears the value in DB
      contact_email: editDraftEmail.trim() || null,
      telephone: editDraftPhone.trim() || null,
      address: editDraftAddress.trim() || null,
      city: editDraftCity.trim() || null,
      postal_code: editDraftPostalCode.trim() || null,
    };
    setEditSaving(true);
    // Optimistic local update
    setLeads(prev => prev.map(l => {
      if (l.id !== sheetId) return l;
      return {
        ...l,
        nomSociete: fields.company_name,
        email: fields.contact_email ?? '',
        telephone: fields.telephone ?? '',
        adresse: fields.address ?? '',
        ville: fields.city ?? '',
        codePostal: fields.postal_code ?? '',
      };
    }));
    if (storeProspects.some(p => p.id === sheetId)) {
      const result = await updateProspectFields(sheetId, fields);
      if (!result.success) {
        toast.error('Impossible de sauvegarder les modifications. Veuillez réessayer.');
        // Revert
        setLeads(prev => prev.map(l => l.id === sheetId ? activeLead : l));
        setEditSaving(false);
        return;
      }
    }
    setEditSaving(false);
    setIsEditingSheet(false);
    toast.success('Prospect mis à jour avec succès.');
  }
  async function generateIcebreakers() {
    setGeneratingIcebreakers(true);
    const toGenerate = filtered.filter(l => !l.icebreakerIa);
    setLeads(prev => prev.map(l =>
      toGenerate.some(t => t.siren === l.siren)
        ? { ...l, icebreakerLoading: true }
        : l
    ));

    for (const lead of toGenerate) {
      const icebreaker = generateIcebreakerLocal(lead);
      setLeads(prev => prev.map(l =>
        l.siren === lead.siren
          ? { ...l, icebreakerIa: icebreaker, icebreakerLoading: false }
          : l
      ));
    }
    setGeneratingIcebreakers(false);
  }

  // ── Note save ─────────────────────────────────────────────────────────────
  function saveNote() {
    if (!sheetId) return;
    setNotesMap(prev => ({ ...prev, [sheetId]: draftNote }));
    setNoteSaved(true);
    if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
    noteSavedTimerRef.current = setTimeout(() => setNoteSaved(false), 2500);
  }

  // ── CRM fields save (estimated_value + next_action_date) ─────────────────
  function saveCrmFields() {
    if (!sheetId) return;
    const parsed = Number(draftEstimatedValue);
    const estimatedValue = draftEstimatedValue !== '' && !isNaN(parsed) && parsed >= 0 ? parsed : null;
    const nextActionDate = draftNextActionDate || null;

    setLeads(prev => prev.map(l =>
      l.id === sheetId
        ? { ...l, estimatedValue, nextActionDate }
        : l
    ));

    if (storeProspects.some(p => p.id === sheetId)) {
      updateProspectFields(sheetId, {
        estimated_value: estimatedValue,
        next_action_date: nextActionDate,
      });
    }

    setCrmSaved(true);
    if (crmSavedTimerRef.current) clearTimeout(crmSavedTimerRef.current);
    crmSavedTimerRef.current = setTimeout(() => setCrmSaved(false), 2500);
  }

  // ── Call log (Chantier 10) — update local state + persist to Supabase ───────
  function logCall() {
    if (!sheetId || !callLogDraft.trim()) return;
    const entry = `[${new Date().toLocaleString('fr-FR')}] ${callLogDraft.trim()}`;
    const currentLead = leads.find(l => l.id === sheetId);
    const updatedCallLogs = [...(currentLead?.callLogs ?? []), entry];

    setLeads(prev => prev.map(l =>
      l.id === sheetId
        ? { ...l, callLogs: updatedCallLogs }
        : l
    ));
    setCallLogDraft('');

    // Persist to Supabase only if the lead has a DB row
    if (storeProspects.some(p => p.id === sheetId)) {
      updateProspectFields(sheetId, { call_logs: updatedCallLogs });
    }
  }

  // ── Computed analytics (Chantier 7) ───────────────────────────────────────
  const sentLeads     = leads.filter(l => l.emailSentAt);
  const openedLeads   = leads.filter(l => l.openCount > 0);
  const clickedLeads  = leads.filter(l => l.clicked);
  const rdvLeads      = leads.filter(l => l.statut === 'interesse');
  const openRate      = sentLeads.length > 0 ? Math.round((openedLeads.length / sentLeads.length) * 100) : 0;
  const clickRate     = sentLeads.length > 0 ? Math.round((clickedLeads.length / sentLeads.length) * 100) : 0;

  // ── Send quote with magic acceptance link ────────────────────────────────
  async function handleSendQuote(quote: ProspectQuote) {
    if (!sheetId) return;
    const lead = leads.find(l => l.id === sheetId);
    if (!lead) return;

    const emailConfig = getEmailConfig();
    if (!emailConfig) {
      toast.error('Aucune configuration email trouvée. Configurez votre compte email dans les Paramètres.');
      return;
    }

    const contactEmail = lead.email;
    if (!contactEmail) {
      toast.error('Aucun email de contact renseigné pour ce prospect.');
      return;
    }

    setSendingQuoteId(quote.id);
    try {
      // 1. Generate token and mark quote as SENT
      const tokenResult = await generateQuoteAcceptToken(quote.id);
      if (!tokenResult.success) {
        toast.error(`Erreur lors de la génération du lien : ${tokenResult.error}`);
        return;
      }

      const appBaseUrl = window.location.origin;
      const acceptLink = `${appBaseUrl}/api/accept-quote?token=${tokenResult.token}`;

      // 2. Build the email
      const cabinetInfo = getCabinetInfo();
      const cabinetName = cabinetInfo.name || 'Votre cabinet comptable';
      const versionLabel = `v${quote.version}`;
      const monthlyFormatted = quote.monthlyTotal.toFixed(2).replace('.', ',');
      const setupFormatted = quote.setupFees.toFixed(2).replace('.', ',');

      const subject = `Votre devis ${versionLabel} — ${monthlyFormatted} € HT / mois`;
      const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;padding:2rem;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);overflow:hidden;">
    <div style="background:#1d4ed8;padding:2rem;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:1.5rem;font-weight:700;">${cabinetName}</h1>
      <p style="color:#bfdbfe;margin:.5rem 0 0;font-size:.875rem;">Votre proposition comptable personnalisée</p>
    </div>
    <div style="padding:2rem;">
      <p style="color:#374151;font-size:1rem;margin:0 0 1rem;">Bonjour,</p>
      <p style="color:#374151;font-size:1rem;line-height:1.6;margin:0 0 1.5rem;">
        Nous avons le plaisir de vous adresser votre devis <strong>${versionLabel}</strong> pour la mission comptable de <strong>${lead.nomSociete}</strong>.
      </p>
      <div style="background:#f3f4f6;border-radius:8px;padding:1.5rem;margin:0 0 1.5rem;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#6b7280;font-size:.875rem;padding:.25rem 0;">Honoraires mensuels HT</td>
            <td style="color:#111827;font-weight:700;font-size:1.125rem;text-align:right;">${monthlyFormatted} €</td>
          </tr>
          ${quote.setupFees > 0 ? `<tr>
            <td style="color:#6b7280;font-size:.875rem;padding:.25rem 0;">Frais de démarrage (une fois)</td>
            <td style="color:#111827;font-weight:600;text-align:right;">${setupFormatted} €</td>
          </tr>` : ''}
        </table>
      </div>
      <p style="color:#374151;font-size:1rem;line-height:1.6;margin:0 0 2rem;">
        Pour accepter ce devis et démarrer notre collaboration, cliquez sur le bouton ci-dessous :
      </p>
      <div style="text-align:center;margin:0 0 2rem;">
        <a href="${acceptLink}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:1rem;font-weight:700;padding:.875rem 2.5rem;border-radius:8px;">
          ✓ J'accepte ce devis
        </a>
      </div>
      <p style="color:#9ca3af;font-size:.75rem;line-height:1.5;margin:0;border-top:1px solid #f3f4f6;padding-top:1.5rem;">
        Ce lien est personnel et sécurisé. En cas de problème, contactez-nous directement.<br/>
        ${cabinetName} • ${cabinetInfo.adresse || ''} ${cabinetInfo.codePostal || ''} ${cabinetInfo.ville || ''}
      </p>
    </div>
  </div>
</body>
</html>`;

      // 3. Send the email via /api/send-email
      const emailResult = await sendEmail({
        to: contactEmail,
        toName: lead.dirigeantPrincipal
          ? `${lead.dirigeantPrincipal.prenom ?? ''} ${lead.dirigeantPrincipal.nom ?? ''}`.trim()
          : lead.nomSociete,
        subject,
        htmlContent,
        emailConfig,
      });

      if (!emailResult.success) {
        toast.error(`Échec de l'envoi : ${emailResult.error ?? 'Erreur inconnue'}`);
        return;
      }

      // 4. Update local quotes state to reflect SENT status
      setQuotesMap(prev => ({
        ...prev,
        [sheetId]: (prev[sheetId] ?? []).map(q =>
          q.id === quote.id ? { ...q, status: 'SENT', acceptToken: tokenResult.token } : q
        ),
      }));

      toast.success(`Devis ${versionLabel} envoyé à ${contactEmail} avec lien d'acceptation.`);
    } finally {
      setSendingQuoteId(null);
    }
  }

  // ── Excel Import/Export handlers ───────────────────────────────────────────
  function handleExportExcel() {
    if (filtered.length === 0) return;

    // Convert LeadEntry back to Prospect for export
    const prospectsToExport: Prospect[] = filtered.map(lead => ({
      siren: lead.siren,
      siret: lead.siret,
      nomSociete: lead.nomSociete,
      formeJuridique: lead.formeJuridique,
      libelleFormeJuridique: lead.libelleFormeJuridique,
      codeNAF: lead.codeNAF,
      libelleNAF: lead.libelleNAF,
      secteur: lead.secteur,
      adresse: lead.adresse,
      codePostal: lead.codePostal,
      ville: lead.ville,
      departement: lead.departement,
      dateCreation: lead.dateCreation,
      effectif: lead.effectif,
      capitalSocial: lead.capitalSocial,
      categorieEntreprise: lead.categorieEntreprise,
      dirigeants: lead.dirigeants,
      dirigeantPrincipal: lead.dirigeantPrincipal,
      email: lead.email,
      telephone: lead.telephone,
    }));

    const filename = `prospects_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportProspectsToExcel(prospectsToExport, filename);
    toast.success(`${prospectsToExport.length} prospect(s) exporté(s)`);
  }

  function handleImportProspects(_importedProspects: Partial<Prospect>[]) {
    // batchImportProspects already saved and enriched the prospects in the store.
    // Use the store's enriched data instead of the raw Excel rows to avoid
    // stale / un-enriched data appearing in the UI.
    const ctx = { cabinetPostalCode: getCabinetInfo().codePostal || '69000', specialty };
    const storeRows = useProspectStore.getState().prospects;

    setLeads(prev => {
      const existingKeys = new Set(prev.map(l => l.siren));
      const newLeads = storeRows
        // Only add rows that aren't already shown (keyed by siren ?? id)
        .filter(p => !existingKeys.has(p.siren ?? p.id))
        .map(p => storeRowToLead(p, ctx));
      return [...prev, ...newLeads];
    });

    setShowImportModal(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ══ LEFT SIDEBAR — Filters ═══════════════════════════════════════════ */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">

        {/* Header */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              title="Retour au dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Radar className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">Prospection</p>
              <p className="text-xs text-gray-400 mt-0.5">Acquisition client automatisée</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-5 space-y-5 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtres de recherche
          </div>

          {/* Free text */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Recherche libre</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Société, dirigeant, ville…"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Secteur NAF */}
          <MultiSelectFilter
            label="Secteur d'activité (NAF)"
            options={SECTEURS}
            selected={filters.secteur}
            onChange={secteur => setFilters(f => ({ ...f, secteur }))}
            placeholder="Tous les secteurs"
          />

          {/* Forme juridique */}
          <MultiSelectFilter
            label="Forme juridique"
            options={FORMES_JURIDIQUES}
            selected={filters.formeJuridique}
            onChange={formeJuridique => setFilters(f => ({ ...f, formeJuridique }))}
            placeholder="Toutes formes"
          />

          {/* Zone géographique */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Zone géographique</label>
            <Input
              placeholder="Ville ou n° département…"
              value={filters.zone}
              onChange={e => setFilters(f => ({ ...f, zone: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>

          {/* Effectif */}
          <MultiSelectFilter
            label="Nombre d'employés"
            options={EFFECTIFS}
            selected={filters.effectif}
            onChange={effectif => setFilters(f => ({ ...f, effectif }))}
            placeholder="Tous effectifs"
          />

          {/* Reset */}
          {hasActiveFilter && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-3 h-3" /> Réinitialiser les filtres
            </button>
          )}

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Recherche…</>
              : <><RefreshCw className="w-4 h-4" /> Rechercher</>
            }
          </button>

          {/* Saved searches */}
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <Bookmark className="w-3.5 h-3.5" />
              Recherches sauvegardées
            </div>

            {savedSearches.length > 0 && (
              <ul className="space-y-1">
                {savedSearches.map(s => (
                  <li key={s.id} className="flex items-center gap-1">
                    <button
                      onClick={() => loadSearch(s)}
                      className="flex-1 flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1.5 rounded-lg transition-colors text-left"
                    >
                      <BookmarkCheck className="w-3 h-3 flex-shrink-0 text-blue-500" />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <button
                      onClick={() => deleteSearch(s.id)}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                      aria-label="Supprimer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showSaveInput ? (
              <div className="space-y-2">
                <Input
                  placeholder="Nom de la recherche…"
                  value={saveSearchName}
                  onChange={e => setSaveSearchName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveSearch();
                    if (e.key === 'Escape') { setShowSaveInput(false); setSaveSearchName(''); }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveSearch}
                    disabled={!saveSearchName.trim()}
                    className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Sauvegarder
                  </button>
                  <button
                    onClick={() => { setShowSaveInput(false); setSaveSearchName(''); }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Sauvegarder cette recherche
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ══ MAIN CONTENT — Leads table ═══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Mini-dashboard (Chantier 7) ───────────────────────────────── */}
        {sentLeads.length > 0 && (
          <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Emails envoyés</p>
                  <p className="text-sm font-bold text-gray-900">{sentLeads.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Taux d'ouverture</p>
                  <p className="text-sm font-bold text-emerald-700">{openRate}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <MousePointerClick className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Taux de clic</p>
                  <p className="text-sm font-bold text-violet-700">{clickRate}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">RDV générés</p>
                  <p className="text-sm font-bold text-amber-700">{rdvLeads.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            {/* View tabs (Chantier 9 + 11) */}
            <Tabs value={viewMode} onValueChange={v => setViewMode(v as 'list' | 'kanban' | 'carte')}>
              <TabsList className="h-8">
                <TabsTrigger value="list" className="flex items-center gap-1.5 text-xs px-3 h-7">
                  <List className="w-3.5 h-3.5" /> Liste
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-1.5 text-xs px-3 h-7">
                  <KanbanSquare className="w-3.5 h-3.5" /> Pipeline Kanban
                </TabsTrigger>
                <TabsTrigger value="carte" className="flex items-center gap-1.5 text-xs px-3 h-7">
                  <MapIcon className="w-3.5 h-3.5" /> Vue Carte
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-gray-400 mt-1">
              {filtered.length} prospect{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              {totalResults > filtered.length && (
                <span className="ml-1">(sur {totalResults} au total)</span>
              )}
              {selectedCount > 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  · {selectedCount} sélectionné{selectedCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className={`ml-3 text-xs ${SOURCE_LABEL[apiSource].className}`}>
                {SOURCE_LABEL[apiSource].text}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Sector filter from store (deduplicated from saved prospects) */}
            {uniqueSectors.length > 0 && (
              <Select
                value={storeSecteur || 'all'}
                onValueChange={v => setStoreSecteur(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-8 text-xs w-48 border-gray-200">
                  <SelectValue placeholder="Filtrer par secteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Tous les secteurs</SelectItem>
                  {uniqueSectors.map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* API Connection Status */}
            {(() => {
              const services = getServiceConnections();
              const pappersConnected = services.pappers?.connected || false;
              return (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  pappersConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${pappersConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {pappersConnected ? 'API connectée' : 'Mode démo'}
                </div>
              );
            })()}

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                filtered.length > 0
                  ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Exporter Excel
            </button>

            {/* Import Excel */}
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Importer Excel
            </button>

            {/* Generate icebreakers (Chantier 8) */}
            <button
              onClick={generateIcebreakers}
              disabled={generatingIcebreakers || filtered.every(l => l.icebreakerIa)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                generatingIcebreakers || filtered.every(l => l.icebreakerIa)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              }`}
            >
              {generatingIcebreakers
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</>
                : <><Sparkles className="w-3.5 h-3.5" /> Icebreakers IA</>
              }
            </button>

            {/* Mass campaign button */}
            <button
              onClick={openCampaignModal}
              disabled={selectedCount === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCount > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              Envoyer une campagne
              {selectedCount > 0 && (
                <span className="ml-1 bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {selectedCount}
                </span>
              )}
            </button>

            {/* Mass delete button — visible only when prospects are selected */}
            {selectedCount > 0 && (
              <button
                onClick={() => setShowMassDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
                <span className="ml-1 bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {selectedCount}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2.5">
            <X className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Map view (Chantier 11) ───────────────────────────────────────── */}
        {viewMode === 'carte' && (
          <ProspectMapView
            prospects={filtered.map(l => ({
              siren: l.siren,
              nomSociete: l.nomSociete,
              formeJuridique: l.formeJuridique,
              secteur: l.secteur,
              ville: l.ville,
              codePostal: l.codePostal,
              dirigeantPrincipal: l.dirigeantPrincipal,
              email: l.email,
              leadScore: l.leadScore,
            }))}
            onAddToCampaign={siren => {
              toggleOne(siren);
              setViewMode('list');
            }}
          />
        )}

        {/* ── Kanban view (Chantier 9) ─────────────────────────────────────── */}
        {viewMode === 'kanban' && (
          <div className="flex-1 overflow-hidden">
            <ProspectKanban
              leads={filtered.map(l => ({
                ...l,
                id: l.id,
                kanbanColumn: l.kanbanColumn,
                openCount: l.openCount,
                clicked: l.clicked,
                emailSentAt: l.emailSentAt,
                icebreakerIa: l.icebreakerIa,
                sequenceStep: l.sequenceStep,
                nextFollowUpDate: l.nextFollowUpDate,
                callLogs: l.callLogs,
                estimatedValue: l.estimatedValue,
                nextActionDate: l.nextActionDate,
                leadScore: l.leadScore,
              }))}
              onMoveCard={moveCard}
              onCardClick={id => setSheetId(id)}
            />
          </div>
        )}

        {/* ── List view (default) ─────────────────────────────────────────── */}
        {viewMode === 'list' && (
        <div className="flex-1 overflow-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                Recherche en cours…
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-10 pl-5">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-gray-400" />Société</div>
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" />Dirigeant</div>
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-gray-400" />Tracking</div>
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />Email</div>
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />Téléphone</div>
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-gray-400" />Statut</div>
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-xs uppercase tracking-wide w-28">
                  <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-gray-400" />Score</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && !loading ? (
                <TableRow>
                  <td colSpan={8} className="text-center py-16">
                    <Filter className="w-8 h-8 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm font-medium text-gray-500">Aucun prospect trouvé</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Modifiez vos filtres ou cliquez sur Rechercher.
                    </p>
                  </td>
                </TableRow>
              ) : (
                filtered.map(lead => (
                  <TableRow
                    key={lead.siren}
                    onClick={() => setSheetId(lead.id)}
                    className={`cursor-pointer transition-colors ${
                      sheetId === lead.id
                        ? 'bg-blue-50 hover:bg-blue-50'
                        : selected.has(lead.siren)
                          ? 'bg-blue-50/40 hover:bg-blue-50/60'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox — stop row-click propagation */}
                    <TableCell className="pl-5" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(lead.siren)}
                        onCheckedChange={() => toggleOne(lead.siren)}
                        aria-label={`Sélectionner ${lead.nomSociete}`}
                      />
                    </TableCell>

                    <TableCell>
                      <p className="font-medium text-gray-900 text-sm leading-tight">{lead.nomSociete}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lead.formeJuridique} · {lead.secteur} · {lead.ville}
                        {lead.departement && ` (${lead.departement})`}
                      </p>
                      {/* AI Icebreaker preview (Chantier 8) */}
                      {lead.icebreakerLoading && (
                        <p className="text-[10px] text-violet-400 mt-1 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Génération icebreaker…
                        </p>
                      )}
                      {lead.icebreakerIa && !lead.icebreakerLoading && (
                        <p className="text-[10px] text-violet-600 mt-1 italic truncate max-w-xs">
                          ✨ {lead.icebreakerIa}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      {lead.dirigeantPrincipal ? (
                        <div>
                          <p className="text-sm text-gray-800 font-medium">
                            {lead.dirigeantPrincipal.prenom} {lead.dirigeantPrincipal.nom}
                          </p>
                          {lead.dirigeantPrincipal.qualite && (
                            <p className="text-xs text-gray-400">{lead.dirigeantPrincipal.qualite}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>

                    {/* Tracking badges (Chantier 7) */}
                    <TableCell>
                      {lead.emailSentAt ? (
                        <div className="flex flex-col gap-1">
                          {lead.openCount > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                              <Eye className="w-2.5 h-2.5" /> Ouvert ({lead.openCount}×)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-400 w-fit">
                              Non ouvert
                            </span>
                          )}
                          {lead.clicked && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 w-fit">
                              <MousePointerClick className="w-2.5 h-2.5" /> Cliqué
                            </span>
                          )}
                          {lead.sequenceStep > 0 && lead.nextFollowUpDate && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 w-fit">
                              <CalendarDays className="w-2.5 h-2.5" /> Relance {new Date(lead.nextFollowUpDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {lead.email
                        ? <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} className="text-sm text-blue-600 hover:underline">{lead.email}</a>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </TableCell>

                    {/* Phone with click-to-call (Chantier 10) */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      {lead.telephone
                        ? (
                          <a href={`tel:${lead.telephone}`} className="flex items-center gap-1 text-sm text-green-700 hover:text-green-900 hover:underline transition-colors">
                            <Phone className="w-3 h-3 text-green-500" />
                            {lead.telephone}
                          </a>
                        )
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </TableCell>

                    {/* Status select — stop row-click propagation */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Select
                        value={lead.statut}
                        onValueChange={v => changeStatus(lead.siren, v as LeadStatus)}
                      >
                        <SelectTrigger
                          size="sm"
                          className={`h-7 text-xs font-medium w-36 border ${getStatusConfig(lead.statut).select}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(
                            ([value, cfg]) => (
                              <SelectItem key={value} value={value} className="text-xs">{cfg.label}</SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Lead Score (Chantier Lead Scoring) */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <LeadScoreCell score={lead.leadScore} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Load More Button */}
          {viewMode === 'list' && hasMore && !loading && (
            <div className="flex justify-center py-6 border-t border-gray-200">
              <button
                onClick={loadMore}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Charger plus de résultats
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {leads.length} / {Math.min(totalResults, MAX_RESULTS)}
                </span>
              </button>
            </div>
          )}

          {/* Max results reached message */}
          {viewMode === 'list' && leads.length >= MAX_RESULTS && totalResults > MAX_RESULTS && (
            <div className="flex justify-center py-4 border-t border-gray-200">
              <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                Limite de {MAX_RESULTS} résultats atteinte. Affinez vos filtres pour des résultats plus ciblés.
              </p>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ══ SHEET — Prospect detail + notes ══════════════════════════════════ */}
      <Sheet open={activeLead !== null} onOpenChange={open => { if (!open) setSheetId(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] flex flex-col p-0 overflow-hidden"
        >
          {activeLead && (
            <>
              {/* ── Sheet header ── */}
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                <div className="pr-6">
                  <SheetTitle className="text-base font-bold text-gray-900 leading-tight">
                    {activeLead.nomSociete}
                  </SheetTitle>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {activeLead.formeJuridique}
                    </span>
                    {activeLead.secteur && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {activeLead.secteur}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(activeLead.statut).pill}`}>
                      {getStatusConfig(activeLead.statut).label}
                    </span>
                  </div>
                </div>

                {/* Status change inline */}
                <div className="mt-3">
                  <Select
                    value={activeLead.statut}
                    onValueChange={v => changeStatus(activeLead.siren, v as LeadStatus)}
                  >
                    <SelectTrigger
                      size="sm"
                      className={`h-8 text-xs font-medium border w-40 ${getStatusConfig(activeLead.statut).select}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(
                        ([value, cfg]) => (
                          <SelectItem key={value} value={value} className="text-xs">{cfg.label}</SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </SheetHeader>

              {/* ── Tab navigation: Détails | Timeline ── */}
              <div className="flex-shrink-0 border-b border-gray-100 px-6 pt-3 pb-0 bg-white">
                <div className="flex gap-1">
                  <button
                    onClick={() => setSheetTab('details')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                      sheetTab === 'details'
                        ? 'border-blue-600 text-blue-700 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📋 Détails
                  </button>
                  <button
                    onClick={() => setSheetTab('timeline')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                      sheetTab === 'timeline'
                        ? 'border-blue-600 text-blue-700 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🕐 Timeline
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto">
                {sheetTab === 'details' ? (
                  <>

                {/* ── Inline edit form (visible when isEditingSheet) ── */}
                {isEditingSheet && (
                  <section className="px-6 py-5 space-y-4 border-b border-gray-100 bg-amber-50/30">
                    <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" /> Modifier le prospect
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Raison sociale</label>
                        <Input
                          value={editDraftCompanyName}
                          onChange={e => setEditDraftCompanyName(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Raison sociale…"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                        <Input
                          type="email"
                          value={editDraftEmail}
                          onChange={e => setEditDraftEmail(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="contact@entreprise.fr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                        <Input
                          type="tel"
                          value={editDraftPhone}
                          onChange={e => setEditDraftPhone(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Ex : 06 12 34 56 78"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                        <Input
                          value={editDraftAddress}
                          onChange={e => setEditDraftAddress(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Adresse…"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Code postal</label>
                          <Input
                            value={editDraftPostalCode}
                            onChange={e => setEditDraftPostalCode(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="75001"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                          <Input
                            value={editDraftCity}
                            onChange={e => setEditDraftCity(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Ville…"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={editSaving}
                        className="text-xs"
                      >
                        {editSaving
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde…</>
                          : <><Check className="w-3 h-3" /> Enregistrer</>
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingSheet(false)}
                        disabled={editSaving}
                        className="text-xs"
                      >
                        <X className="w-3 h-3" /> Annuler
                      </Button>
                    </div>
                  </section>
                )}

                {/* Société */}
                <section className="px-6 py-5 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Société
                  </h3>
                  <dl className="space-y-2">
                    <Row label="SIREN"         value={activeLead.siren} mono />
                    <Row label="Forme juridique" value={activeLead.libelleFormeJuridique || activeLead.formeJuridique} />
                    <Row label="Code NAF"      value={activeLead.codeNAF ? `${activeLead.codeNAF} — ${activeLead.libelleNAF}` : '—'} />
                    {activeLead.dateCreation && (
                      <Row label="Création"    value={formatDate(activeLead.dateCreation)} icon={<Calendar className="w-3.5 h-3.5 text-gray-400" />} />
                    )}
                    {activeLead.effectif && (
                      <Row label="Effectif"    value={activeLead.effectif} icon={<BarChart2 className="w-3.5 h-3.5 text-gray-400" />} />
                    )}
                    {activeLead.capitalSocial && (
                      <Row label="Capital"     value={activeLead.capitalSocial} icon={<Briefcase className="w-3.5 h-3.5 text-gray-400" />} />
                    )}
                  </dl>
                </section>

                {/* Adresse */}
                {(activeLead.adresse || activeLead.ville) && (
                  <section className="px-6 py-5 space-y-3 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Adresse
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {[activeLead.adresse, activeLead.codePostal, activeLead.ville]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    {activeLead.adresse && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent([activeLead.adresse, activeLead.ville].filter(Boolean).join(', '))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Voir sur Google Maps
                      </a>
                    )}
                  </section>
                )}

                {/* Dirigeants */}
                <section className="px-6 py-5 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Dirigeant{activeLead.dirigeants.length !== 1 ? 's' : ''}
                  </h3>
                  {activeLead.dirigeants.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun dirigeant renseigné</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {activeLead.dirigeants.map((d, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-semibold text-blue-600">
                              {(d?.prenom?.[0] ?? '') + (d?.nom?.[0] ?? '')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {d?.prenom ?? ''} {d?.nom ?? ''}
                            </p>
                            {d?.qualite && (
                              <p className="text-xs text-gray-400">{d.qualite}</p>
                            )}
                          </div>
                          {i === 0 && activeLead.dirigeants.length > 1 && (
                            <span className="ml-auto text-xs text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                              Principal
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Contact (Chantier 10 – LinkedIn + click-to-call) */}
                <section className="px-6 py-5 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Contact
                  </h3>
                  <dl className="space-y-2">
                    {/* Email */}
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {activeLead.email
                        ? <a href={`mailto:${activeLead.email}`} className="text-sm text-blue-600 hover:underline">{activeLead.email}</a>
                        : <span className="text-xs text-gray-300 italic">Non disponible — enrichissement requis</span>
                      }
                    </div>
                    {/* Phone — click-to-call (Chantier 10) */}
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {activeLead.telephone
                        ? (
                          <a href={`tel:${activeLead.telephone}`} className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-900 hover:underline font-medium transition-colors">
                            <PhoneCall className="w-3.5 h-3.5 text-green-500" />
                            {activeLead.telephone}
                          </a>
                        )
                        : <span className="text-xs text-gray-300 italic">Non disponible — enrichissement requis</span>
                      }
                    </div>
                    {/* LinkedIn search link (Chantier 10) */}
                    {activeLead.dirigeantPrincipal && (
                      <div className="flex items-center gap-2">
                        <Linkedin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <a
                          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                            [activeLead.dirigeantPrincipal?.prenom ?? '', activeLead.dirigeantPrincipal?.nom ?? '', activeLead.nomSociete ?? ''].filter(Boolean).join(' ')
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Rechercher sur LinkedIn <ExternalLink className="w-3 h-3 inline" />
                        </a>
                      </div>
                    )}
                  </dl>
                </section>

                {/* AI Icebreaker display (Chantier 8) */}
                {activeLead.icebreakerIa && (
                  <section className="px-6 py-4 space-y-2 border-b border-gray-100 bg-violet-50/30">
                    <h3 className="text-xs font-semibold text-violet-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Icebreaker IA
                    </h3>
                    <p className="text-sm text-violet-800 italic leading-relaxed">"{activeLead.icebreakerIa}"</p>
                    <p className="text-[10px] text-violet-400">
                      Utilisez <code className="bg-violet-100 px-1 rounded">{'{{icebreaker_ia}}'}</code> dans vos emails
                    </p>
                  </section>
                )}

                {/* Sequence info (Chantier 6) */}
                {activeLead.emailSentAt && (
                  <section className="px-6 py-4 space-y-2 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" /> Séquence email
                    </h3>
                    <dl className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">J+0</span>
                        Email initial envoyé {new Date(activeLead.emailSentAt).toLocaleDateString('fr-FR')}
                      </div>
                      {activeLead.sequenceStep > 0 && activeLead.nextFollowUpDate && (
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Relance {activeLead.sequenceStep}</span>
                          Planifiée le {new Date(activeLead.nextFollowUpDate).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                      {activeLead.openCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <Eye className="w-3 h-3" /> Ouvert {activeLead.openCount} fois
                        </div>
                      )}
                    </dl>
                  </section>
                )}

                {/* Call log (Chantier 10) */}
                <section className="px-6 py-5 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5" /> Journal d'appels
                  </h3>
                  {activeLead.callLogs.length > 0 && (
                    <ul className="space-y-1.5 mb-3">
                      {activeLead.callLogs.map((log, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          <PhoneCall className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{log}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex : Appelé, pas répondu — rappeler vendredi…"
                      value={callLogDraft}
                      onChange={e => setCallLogDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') logCall(); }}
                      className="h-8 text-xs flex-1"
                    />
                    <button
                      onClick={logCall}
                      disabled={!callLogDraft.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                      <PhoneCall className="w-3 h-3" /> Loguer
                    </button>
                  </div>
                </section>

                {/* Lead score (Chantier Lead Scoring) */}
                <section className="px-6 py-4 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Lead Score
                  </h3>
                  <LeadScoreSection score={activeLead.leadScore} />
                </section>

                {/* CRM Pipeline fields */}
                <section className="px-6 py-4 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Pipeline CRM
                  </h3>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Valeur estimée (€)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={100}
                          placeholder="Ex : 5000"
                          value={draftEstimatedValue}
                          onChange={e => { setDraftEstimatedValue(e.target.value); setCrmSaved(false); }}
                          className="w-full h-8 px-3 pr-8 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all bg-white"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Prochaine action</label>
                      <input
                        type="date"
                        value={draftNextActionDate}
                        onChange={e => { setDraftNextActionDate(e.target.value); setCrmSaved(false); }}
                        className="w-full h-8 px-3 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all bg-white"
                      />
                    </div>
                    <button
                      onClick={saveCrmFields}
                      disabled={crmSaved}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        crmSaved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {crmSaved
                        ? <><Check className="w-3.5 h-3.5" /> Sauvegardé</>
                        : <><TrendingUp className="w-3.5 h-3.5" /> Enregistrer</>
                      }
                    </button>
                  </div>
                </section>

                {/* Event status (Événements Locaux) */}
                {activeLead.eventStatus && (
                  <section className="px-6 py-4 space-y-3 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5" /> Statut événement
                    </h3>
                    <EventStatusBadge status={activeLead.eventStatus} />
                  </section>
                )}

                {/* Devis liés au prospect */}
                <section className="px-6 py-5 space-y-3 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Devis
                  </h3>
                  {quotesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement des devis…
                    </div>
                  ) : (quotesMap[sheetId ?? ''] ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun devis généré pour ce prospect.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-3 font-semibold text-gray-500">Version</th>
                            <th className="text-left py-2 pr-3 font-semibold text-gray-500">Statut</th>
                            <th className="text-right py-2 pr-3 font-semibold text-gray-500">Mensuel HT</th>
                            <th className="text-right py-2 pr-3 font-semibold text-gray-500">Démarrage</th>
                            <th className="py-2 font-semibold text-gray-500">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(quotesMap[sheetId ?? ''] ?? []).map(q => {
                            const statusLabel: Record<string, string> = {
                              DRAFT: 'Brouillon',
                              SENT: 'Envoyé',
                              ACCEPTED: 'Accepté',
                              VALIDATED: 'Validé',
                              SIGNED: 'Signé',
                              PENDING_ONBOARDING: 'En attente',
                              ARCHIVED: 'Archivé',
                            };
                            const statusColor: Record<string, string> = {
                              DRAFT: 'bg-gray-100 text-gray-600',
                              SENT: 'bg-blue-100 text-blue-700',
                              ACCEPTED: 'bg-emerald-100 text-emerald-700',
                              VALIDATED: 'bg-green-100 text-green-700',
                              SIGNED: 'bg-violet-100 text-violet-700',
                              PENDING_ONBOARDING: 'bg-amber-100 text-amber-700',
                              ARCHIVED: 'bg-gray-100 text-gray-500',
                            };
                            const canSend = q.status !== 'ACCEPTED' && q.status !== 'VALIDATED' && q.status !== 'SIGNED';
                            return (
                              <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="py-2 pr-3 font-semibold text-gray-800">v{q.version}</td>
                                <td className="py-2 pr-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {statusLabel[q.status] ?? q.status}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-right font-medium text-gray-900">
                                  {q.monthlyTotal.toFixed(2).replace('.', ',')} €
                                </td>
                                <td className="py-2 pr-3 text-right text-gray-600">
                                  {q.setupFees > 0 ? `${q.setupFees.toFixed(2).replace('.', ',')} €` : '—'}
                                </td>
                                <td className="py-2">
                                  {canSend && (
                                    <button
                                      onClick={() => handleSendQuote(q)}
                                      disabled={sendingQuoteId === q.id}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {sendingQuoteId === q.id
                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Envoi…</>
                                        : <><Send className="w-3 h-3" /> Envoyer</>
                                      }
                                    </button>
                                  )}
                                  {!canSend && (
                                    <span className="text-[11px] text-gray-400 italic">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Notes */}
                <section className="px-6 py-5 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Notes & commentaires
                  </h3>
                  <Textarea
                    placeholder={`Ex : Appelé le ${new Date().toLocaleDateString('fr-FR')}, rappeler en septembre…`}
                    value={draftNote}
                    onChange={e => { setDraftNote(e.target.value); setNoteSaved(false); }}
                    className="min-h-[120px] text-sm resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{draftNote.length} caractère{draftNote.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={saveNote}
                      disabled={draftNote === (notesMap[activeLead.siren] ?? '')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        noteSaved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : draftNote === (notesMap[activeLead.siren] ?? '')
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {noteSaved
                        ? <><Check className="w-3.5 h-3.5" /> Note sauvegardée</>
                        : <><MessageSquare className="w-3.5 h-3.5" /> Sauvegarder la note</>
                      }
                    </button>
                  </div>
                </section>
                  </>
                ) : (
                  <ProspectTimeline lead={activeLead} storeProspects={storeProspects} />
                )}
              </div>

              {/* ── Sheet footer — quick actions ── */}
              <div className="border-t border-gray-100 px-6 py-4 flex-shrink-0 flex items-center gap-3 bg-gray-50 flex-wrap">
                {!isEditingSheet && (
                  <>
                    <button
                      onClick={() => {
                        setSelected(new Set([activeLead.siren]));
                        setSheetId(null);
                        setShowCampaignModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Lancer une campagne
                    </button>
                    <button
                      onClick={() => {
                        toggleOne(activeLead.siren);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        selected.has(activeLead.siren)
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      {selected.has(activeLead.siren) ? 'Sélectionné' : 'Sélectionner'}
                    </button>
                    {/* Edit button */}
                    <button
                      onClick={startEditingSheet}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </button>
                    {/* Delete button — opens confirmation dialog */}
                    {storeProspects.some(p => p.id === activeLead.id) && (
                      <button
                        onClick={() => {
                          setDeletingOneId(activeLead.id);
                          setShowDeleteOneConfirm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ══ EMAIL CAMPAIGN MODAL ════════════════════════════════════════════════ */}
      <EmailCampaignModal
        open={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        prospects={selectedProspects.map(p => ({ ...p, icebreakerIa: p.icebreakerIa }))}
        onSent={handleCampaignSent}
      />

      {/* ══ EXCEL IMPORT MODAL ══════════════════════════════════════════════════ */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportProspects}
      />

      {/* ══ MASS DELETE CONFIRMATION ══════════════════════════════════════════════ */}
      <AlertDialog open={showMassDeleteConfirm} onOpenChange={setShowMassDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedCount} prospect{selectedCount !== 1 ? 's' : ''} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Les{' '}
              <strong>{selectedCount} prospect{selectedCount !== 1 ? 's' : ''}</strong> sélectionné{selectedCount !== 1 ? 's' : ''}{' '}
              seront définitivement supprimés de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowMassDeleteConfirm(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══ SINGLE PROSPECT DELETE CONFIRMATION ══════════════════════════════════ */}
      <AlertDialog
        open={showDeleteOneConfirm}
        onOpenChange={open => {
          setShowDeleteOneConfirm(open);
          if (!open) setDeletingOneId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce prospect ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Le prospect{' '}
              <strong>
                {deletingOneId ? (leads.find(l => l.id === deletingOneId)?.nomSociete ?? 'ce prospect') : ''}
              </strong>{' '}
              sera définitivement supprimé de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteOneConfirm(false); setDeletingOneId(null); }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingOneId) handleDeleteOne(deletingOneId); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── AI Icebreaker generator (Chantier 8) ─────────────────────────────────────

function generateIcebreakerLocal(lead: { nomSociete: string; secteur: string; formeJuridique: string; ville: string; codeNAF: string; dirigeantPrincipal: { prenom: string; nom: string; qualite: string } | null }): string {
  const { nomSociete, secteur, formeJuridique, ville, codeNAF, dirigeantPrincipal } = lead;
  const prenom = dirigeantPrincipal?.prenom ?? '';

  const templates: Record<string, string[]> = {
    Construction: [
      `J'ai remarqué que ${nomSociete} développe son activité de construction à ${ville} — votre secteur connaît une forte croissance en ce moment.`,
      `Les ${formeJuridique} du BTP font face à des défis fiscaux spécifiques que nous accompagnons au quotidien à ${ville}.`,
      `En tant qu'expert du secteur BTP, j'ai vu des entreprises comme ${nomSociete} optimiser leur fiscalité grâce à des dispositifs souvent méconnus.`,
    ],
    Informatique: [
      `Les sociétés tech comme ${nomSociete} bénéficient souvent du Crédit Impôt Recherche (CIR) — avez-vous optimisé ce dispositif ?`,
      `J'ai vu que ${nomSociete} évolue dans le secteur IT à ${ville} — nos clients tech économisent en moyenne 15 % d'IS grâce à une structuration adaptée.`,
      `Le secteur logiciel à ${ville} est en plein essor — notre cabinet accompagne plusieurs ${formeJuridique} tech comme la vôtre.`,
    ],
    Transport: [
      `Les entreprises de transport comme ${nomSociete} peuvent bénéficier d'avantages fiscaux sur le gazole professionnel souvent sous-exploités.`,
      `J'ai constaté que le secteur transport à ${ville} connaît des mutations importantes — notre expertise vous aiderait à optimiser vos charges.`,
    ],
    Restauration: [
      `La restauration à ${ville} demande une gestion rigoureuse des charges sociales — c'est notre spécialité pour les ${formeJuridique} comme ${nomSociete}.`,
      `Les établissements de restauration bénéficient de régimes fiscaux spécifiques — avez-vous exploré les options disponibles pour ${nomSociete} ?`,
    ],
    Immobilier: [
      `Les ${formeJuridique} immobilières comme ${nomSociete} peuvent optimiser leur fiscalité via des mécanismes souvent méconnus des dirigeants.`,
      `Le marché immobilier à ${ville} offre des opportunités d'optimisation fiscale que notre cabinet accompagne régulièrement.`,
    ],
    'Services financiers': [
      `Notre cabinet accompagne plusieurs structures financières à ${ville} — nous comprenons les enjeux spécifiques de votre secteur.`,
      `Les ${formeJuridique} comme ${nomSociete} bénéficient de régimes comptables particuliers que nous maîtrisons parfaitement.`,
    ],
    Communication: [
      `Les agences créatives comme ${nomSociete} à ${ville} peuvent optimiser leur TVA sur les prestations intellectuelles.`,
      `J'ai remarqué l'activité de ${nomSociete} dans le secteur communication — nous accompagnons plusieurs agences sur leurs enjeux fiscaux.`,
    ],
    Santé: [
      `Le secteur médical à ${ville} connaît des spécificités comptables importantes — notre cabinet est spécialisé dans l'accompagnement des structures de santé.`,
      `Les professionnels de santé comme ${nomSociete} bénéficient de régimes d'imposition spécifiques souvent avantageux.`,
    ],
    Commerce: [
      `La gestion des stocks et de la TVA pour les commerces comme ${nomSociete} à ${ville} peut être optimisée significativement.`,
      `Notre cabinet accompagne de nombreux commerces de détail — nous connaissons les enjeux spécifiques des ${formeJuridique} comme la vôtre.`,
    ],
  };

  const defaultTemplates = [
    `J'ai vu que ${nomSociete} (${formeJuridique}) développe son activité à ${ville} — notre cabinet comptable accompagne des structures similaires avec un vrai impact.`,
    `En tant qu'${formeJuridique} basée à ${ville}, ${nomSociete} fait face à des enjeux fiscaux spécifiques que nous traitons quotidiennement.`,
    `Notre expertise auprès des ${formeJuridique} du secteur ${secteur} nous permet d'apporter une valeur ajoutée concrète à ${nomSociete}.`,
    `Le code NAF ${codeNAF} de ${nomSociete} correspond à des spécificités comptables que nous maîtrisons parfaitement${prenom ? `, ${prenom}` : ''}.`,
  ];

  const pool = templates[secteur] ?? defaultTemplates;
  return pool[Math.floor(Math.random() * pool.length)] ?? defaultTemplates[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({
  label, value, mono = false, icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
      <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className={`text-sm text-gray-800 break-all ${mono ? 'font-mono text-xs tracking-wide' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y) return iso;
  return [d, m, y].filter(Boolean).join('/');
}


// ─── Lead Score sub-components ────────────────────────────────────────────────

function LeadScoreCell({ score }: { score: number }) {
  const colors = scoreColorClass(score);
  return (
    <div className="space-y-1 w-24">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${colors.text}`}>{score}</span>
        <span className="text-[10px] text-gray-400">/100</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {score >= 70 && (
        <p className="text-[10px] font-medium text-emerald-600">🔥 Lead chaud</p>
      )}
    </div>
  );
}

function LeadScoreSection({ score }: { score: number }) {
  const colors = scoreColorClass(score);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`text-2xl font-bold ${colors.text}`}>
          {score}<span className="text-sm font-normal text-gray-400">/100</span>
        </div>
        {score >= 70 && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            🔥 Lead chaud — à appeler en priorité
          </span>
        )}
        {score >= 40 && score < 70 && (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
            Tiède — à surveiller
          </span>
        )}
        {score < 40 && (
          <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">
            Froid
          </span>
        )}
      </div>
      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        Basé sur : proximité département (+20), spécialité NAF (+30), ouvertures email (+10/ouverture)
      </p>
    </div>
  );
}

// ─── Event Status badge ───────────────────────────────────────────────────────

const EVENT_STATUS_CONFIG: Record<RsvpStatus, { label: string; pill: string; icon: React.ReactNode }> = {
  invite:          { label: 'Invité',       pill: 'bg-gray-100 text-gray-600',       icon: <Clock className="w-3.5 h-3.5" /> },
  inscrit:         { label: 'Inscrit',      pill: 'bg-emerald-100 text-emerald-700', icon: <Check className="w-3.5 h-3.5" /> },
  'a-participe':   { label: 'A participé',  pill: 'bg-blue-100 text-blue-700',       icon: <PartyPopper className="w-3.5 h-3.5" /> },
  absent:          { label: 'Absent',       pill: 'bg-red-100 text-red-600',         icon: <XCircle className="w-3.5 h-3.5" /> },
};

function EventStatusBadge({ status }: { status: RsvpStatus }) {
  const cfg = EVENT_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.pill}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

interface TimelineEvent {
  date: Date;
  icon: string;
  label: string;
  detail?: string;
  color: string;
}

function ProspectTimeline({
  lead,
  storeProspects,
}: {
  lead: LeadEntry;
  storeProspects: ProspectRow[];
}) {
  const storeRow = storeProspects.find(p => p.id === lead.id);

  const events: TimelineEvent[] = useMemo(() => {
    const raw: TimelineEvent[] = [];

    // 1. Prospect créé
    const createdAt = storeRow?.created_at;
    if (createdAt) {
      raw.push({
        date: new Date(createdAt),
        icon: '🏢',
        label: 'Prospect ajouté',
        detail: lead.nomSociete,
        color: 'bg-gray-100 text-gray-600 border-gray-200',
      });
    }

    // 2. Email initial envoyé
    if (lead.emailSentAt) {
      raw.push({
        date: new Date(lead.emailSentAt),
        icon: '📧',
        label: 'Email initial envoyé',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
      });
    }

    // 3. Email ouvert (exact open timestamp not stored; approximate with sent date)
    if (lead.openCount > 0 && lead.emailSentAt) {
      raw.push({
        date: new Date(lead.emailSentAt),
        icon: '👁️',
        label: `Email ouvert ${lead.openCount} fois`,
        detail: 'Horodatage exact non disponible — daté à l\'envoi',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      });
    }

    // 4. Lien cliqué (exact click timestamp not stored; approximate with sent date)
    if (lead.clicked && lead.emailSentAt) {
      raw.push({
        date: new Date(lead.emailSentAt),
        icon: '🖱️',
        label: 'Lien / devis cliqué',
        detail: 'Horodatage exact non disponible — daté à l\'envoi',
        color: 'bg-violet-50 text-violet-700 border-violet-200',
      });
    }

    // 5. Relances planifiées
    if (lead.sequenceStep > 0 && lead.nextFollowUpDate) {
      raw.push({
        date: new Date(lead.nextFollowUpDate),
        icon: '🔁',
        label: `Relance ${lead.sequenceStep} planifiée`,
        color: 'bg-amber-50 text-amber-700 border-amber-200',
      });
    }

    // 6. Call logs (format: "[DD/MM/YYYY, HH:MM] note" from toLocaleString)
    for (const log of lead.callLogs) {
      const bracketMatch = log.match(/^\[([^\]]+)\]/);
      const logDate = bracketMatch
        ? (() => {
            // parse "DD/MM/YYYY, HH:MM:SS" locale format
            const parts = bracketMatch[1].split(/[\s,\/]+/);
            if (parts.length >= 5) {
              const [d, m, y, h, min] = parts;
              const dd = Number(d), mm = Number(m), yyyy = Number(y), hh = Number(h), mi = Number(min);
              if (
                !isNaN(dd) && !isNaN(mm) && !isNaN(yyyy) && !isNaN(hh) && !isNaN(mi) &&
                dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy > 2000
              ) {
                const parsed = new Date(
                  `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00`,
                );
                if (!isNaN(parsed.getTime())) return parsed;
              }
            }
            return new Date();
          })()
        : new Date();
      raw.push({
        date: logDate,
        icon: '📞',
        label: 'Appel journalisé',
        detail: bracketMatch ? log.replace(/^\[[^\]]+\]\s*/, '') : log,
        color: 'bg-purple-50 text-purple-700 border-purple-200',
      });
    }

    // 7. Next action date
    if (lead.nextActionDate) {
      raw.push({
        date: new Date(lead.nextActionDate),
        icon: '📅',
        label: 'Prochaine action prévue',
        color: 'bg-sky-50 text-sky-700 border-sky-200',
      });
    }

    return raw.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [lead, storeRow]);

  if (events.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-xs text-gray-400 italic">
        Aucun événement enregistré pour ce prospect.
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
        <Clock className="w-3.5 h-3.5" /> Historique chronologique
      </h3>
      <ol className="relative border-l border-gray-200 space-y-5 ml-2">
        {events.map((event, i) => (
          <li key={i} className="ml-4">
            <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 text-sm select-none">
              {event.icon}
            </span>
            <div className={`rounded-lg border px-3 py-2 ${event.color}`}>
              <p className="text-xs font-semibold">{event.label}</p>
              {event.detail && (
                <p className="text-[11px] mt-0.5 opacity-80 leading-relaxed">{event.detail}</p>
              )}
              <p className="text-[10px] mt-1 opacity-60">
                {event.date.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
