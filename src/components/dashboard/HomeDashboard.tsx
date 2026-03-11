import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { SignedClient } from '@/app/utils/supabaseSync';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  Users, AlertTriangle, Plus, ArrowRight,
  Calculator, Calendar, RefreshCw, Mail, FileText, CheckCircle, Bell,
  Radar, Cog, X, BookOpen, Handshake, FolderKanban,
  HardDrive, Send, Zap, ChevronRight,
} from 'lucide-react';
import { useDossiersContext } from '@/app/context/DossiersContext';
import { getDossierProgress } from '@/app/utils/dossierUtils';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/app/components/ui/card';

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/** Index of the AI analysis step in STEPS_REPRISE (0-based, step id 'analyse') */
const AI_ANALYSIS_STEP_INDEX = 7;
const MONTHS_PER_YEAR = 12;
const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function parsePrix(prix: string): number {
  const num = parseFloat((prix ?? '').replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

type Blocker = {
  type: 'missing_doc' | 'pending_signature' | 'action_required';
  message: string;
  dossierId: string;
  clientNom: string;
};

interface HomeDashboardProps {
  /** Pre-loaded signed clients passed from parent to avoid duplicate API calls. */
  signedClients?: SignedClient[];
  /** Count of VALIDATED proposals awaiting a Lettre de Mission. */
  validatedQuotesCount?: number;
  /** Total MRR (€/month) of quotes with status SENT (delivered to clients). */
  sentQuotesMrr?: number;
  /** Number of quotes with status SENT. */
  sentQuotesCount?: number;
}

const TODAY = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

export function HomeDashboard({ signedClients = [], validatedQuotesCount = 0, sentQuotesMrr = 0, sentQuotesCount = 0 }: HomeDashboardProps) {
  const navigate = useNavigate();
  const { dossiers, createDossier, loading } = useDossiersContext();
  const [showNewDossierModal, setShowNewDossierModal] = useState(false);
  const [creatingDossier, setCreatingDossier] = useState(false);

  const kpis = useMemo(() => {
    const now = Date.now();

    const clientsActifs = dossiers.filter(d => {
      const p = getDossierProgress(d);
      return p > 0 && p < 1;
    }).length;

    const overdues = dossiers.filter(d => {
      if (getDossierProgress(d) >= 1) return false;
      return now - new Date(d.updatedAt).getTime() > OVERDUE_THRESHOLD_MS;
    }).length;

    const aiPending = dossiers.filter(d => {
      if (d.clientData.missionType !== 'reprise') return false;
      const s = d.stepStatuses[AI_ANALYSIS_STEP_INDEX];
      return s === 'pending' || s === 'active';
    }).length;

    // CA Onboardé from signed LDMs (sum of monthly * 12 from backend)
    const caOnboarde = signedClients.length > 0
      ? signedClients.reduce((sum, client) => sum + (client.monthlyTotal * 12), 0)
      : dossiers
          .filter(d => d.clientData.lettreMissionSignee)
          .reduce((sum, d) => sum + parsePrix(d.clientData.prixAnnuel), 0);

    // Detailed blockers for in-progress dossiers
    const blockers: Blocker[] = [];
    dossiers.forEach(d => {
      const cd = d.clientData;
      const p = getDossierProgress(d);
      if (p >= 1) return;

      if (cd.missionType === 'creation') {
        if (!cd.carteIdentiteUploaded) {
          blockers.push({
            type: 'missing_doc',
            message: `Carte d'identité manquante`,
            dossierId: d.id,
            clientNom: cd.nom || 'Client inconnu',
          });
        }
        if (!cd.justificatifDomicileUploaded) {
          blockers.push({
            type: 'missing_doc',
            message: `Justificatif de domicile manquant`,
            dossierId: d.id,
            clientNom: cd.nom || 'Client inconnu',
          });
        }
      }

      if (cd.lettreMissionSignatureId && !cd.lettreMissionSignee) {
        blockers.push({
          type: 'pending_signature',
          message: `LDM en attente de signature`,
          dossierId: d.id,
          clientNom: cd.nom || cd.raisonSociale || 'Client inconnu',
        });
      }

      if (!cd.documentDemandeSent && p > 0.2) {
        blockers.push({
          type: 'action_required',
          message: `Demande documentaire non envoyée`,
          dossierId: d.id,
          clientNom: cd.nom || cd.raisonSociale || 'Client inconnu',
        });
      }
    });

    return { clientsActifs, overdues, aiPending, caOnboarde, blockers };
  }, [dossiers, signedClients]);

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const monthOffset = 5 - i;
      const monthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0);

      const monthDossiers = dossiers.filter(d => {
        const created = new Date(d.createdAt);
        return created >= monthStart && created <= monthEnd;
      });

      // CA: only count signed LDMs (lettreMissionSignee = true)
      const ca = monthDossiers
        .filter(d => d.clientData.lettreMissionSignee)
        .reduce((sum, d) => sum + parsePrix(d.clientData.prixAnnuel) / MONTHS_PER_YEAR, 0);

      return {
        mois: MONTHS_FR[monthStart.getMonth()],
        ca: Math.round(ca),
        dossiers: monthDossiers.length,
      };
    });
  }, [dossiers]);

  const handleNewProspect = async () => {
    setCreatingDossier(true);
    setShowNewDossierModal(false);
    try {
      const dossier = await createDossier();
      navigate(`/onboarding/${dossier.id}`);
    } finally {
      setCreatingDossier(false);
    }
  };

  const handleNewReprise = async () => {
    setCreatingDossier(true);
    setShowNewDossierModal(false);
    try {
      const dossier = await createDossier();
      navigate(`/onboarding/${dossier.id}?mission=reprise`);
    } finally {
      setCreatingDossier(false);
    }
  };

  const handleNewCreation = async () => {
    setCreatingDossier(true);
    setShowNewDossierModal(false);
    try {
      const dossier = await createDossier();
      navigate(`/onboarding/${dossier.id}?mission=creation`);
    } finally {
      setCreatingDossier(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-50 rounded-3xl p-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tour de Contrôle</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{TODAY}</p>
        </div>
        <button
          onClick={() => setShowNewDossierModal(true)}
          disabled={creatingDossier}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-60 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nouveau dossier
        </button>
      </div>

      {/* ── Main Layout: Left 1/4 + Right 3/4 ───────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ══════════════════════════════════════════════════════════════
            LEFT PANEL — Flux de Signature (1/4)
        ══════════════════════════════════════════════════════════════ */}
        <div className="w-full lg:w-64 lg:flex-shrink-0 flex flex-col">
          <div className="mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Flux de Signature
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Pipeline client</p>
          </div>

          {/* Step 1 — Prospection */}
          <button
            onClick={() => navigate('/prospection')}
            className="w-full flex flex-col gap-3 bg-white border border-slate-200 rounded-2xl p-5 text-left hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Radar className="w-7 h-7 text-blue-600" />
              </div>
              {sentQuotesCount > 0 && (
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                  {sentQuotesCount}
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Étape 1</span>
              <p className="font-bold text-gray-900 mt-0.5">Prospection</p>
              <p className="text-xs text-slate-400 mt-0.5">CRM & relances</p>
            </div>
          </button>

          <div className="flex justify-center py-1.5" aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
          </div>

          {/* Step 2 — Pricing */}
          <button
            onClick={() => navigate('/pricing')}
            className="w-full flex flex-col gap-3 bg-white border border-slate-200 rounded-2xl p-5 text-left hover:shadow-md hover:border-violet-300 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Calculator className="w-7 h-7 text-violet-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Étape 2</span>
              <p className="font-bold text-gray-900 mt-0.5">Pricing</p>
              <p className="text-xs text-slate-400 mt-0.5">Calcul des honoraires</p>
            </div>
          </button>

          <div className="flex justify-center py-1.5" aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
          </div>

          {/* Step 3 — Conversion / Centre d'actions */}
          <button
            onClick={() => navigate('/action-center')}
            className={`w-full flex flex-col gap-3 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border ${
              kpis.overdues > 0
                ? 'bg-rose-50 border-rose-200 hover:border-rose-400'
                : 'bg-white border-slate-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                kpis.overdues > 0 ? 'bg-rose-100' : 'bg-rose-50'
              }`}>
                <Zap className={`w-7 h-7 ${kpis.overdues > 0 ? 'text-rose-600' : 'text-rose-400'}`} />
              </div>
              {kpis.overdues > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                  {kpis.overdues}
                </span>
              )}
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                kpis.overdues > 0 ? 'text-rose-500' : 'text-rose-400'
              }`}>Étape 3</span>
              <p className={`font-bold mt-0.5 leading-tight ${kpis.overdues > 0 ? 'text-rose-900' : 'text-gray-900'}`}>
                Conversion
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Centre d'actions</p>
              <p className={`text-xs mt-0.5 ${kpis.overdues > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                Relances & tâches unifiées
              </p>
            </div>
          </button>

          <div className="flex justify-center py-1.5" aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
          </div>

          {/* Step 4 — LDM */}
          <button
            onClick={() => navigate('/lettre-mission')}
            className={`w-full flex flex-col gap-3 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border ${
              validatedQuotesCount > 0
                ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'
                : 'bg-white border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                validatedQuotesCount > 0 ? 'bg-emerald-100' : 'bg-emerald-50'
              }`}>
                <Cog className={`w-7 h-7 ${validatedQuotesCount > 0 ? 'text-emerald-600' : 'text-emerald-500'}`} />
              </div>
              {validatedQuotesCount > 0 && (
                <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                  {validatedQuotesCount}
                </span>
              )}
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                validatedQuotesCount > 0 ? 'text-emerald-500' : 'text-emerald-400'
              }`}>Étape 4</span>
              <p className={`font-bold mt-0.5 ${validatedQuotesCount > 0 ? 'text-emerald-900' : 'text-gray-900'}`}>
                LDM
              </p>
              <p className={`text-xs mt-0.5 ${validatedQuotesCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {validatedQuotesCount > 0
                  ? `${validatedQuotesCount} à traiter`
                  : 'Lettres de mission'}
              </p>
            </div>
          </button>

          <div className="flex justify-center py-1.5" aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
          </div>

          {/* Step 5 — Onboarding */}
          <button
            onClick={() => setShowNewDossierModal(true)}
            disabled={creatingDossier}
            className="w-full flex flex-col gap-3 bg-white border border-slate-200 rounded-2xl p-5 text-left hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <FolderKanban className="w-7 h-7 text-indigo-600" />
              </div>
              {kpis.clientsActifs > 0 && (
                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                  {kpis.clientsActifs}
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Étape 5</span>
              <p className="font-bold text-gray-900 mt-0.5">Onboarding</p>
              <p className="text-xs text-slate-400 mt-0.5">Créer un dossier</p>
            </div>
          </button>

          <div className="flex justify-center py-1.5" aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
          </div>

          {/* Final — Validation Client (shiny border) */}
          <button
            onClick={() => navigate('/dossiers-actifs')}
            className="w-full flex flex-col gap-3 rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-emerald-50"
            style={{
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              boxShadow: '0 0 0 2px rgba(251,191,36,0.5), 0 0 24px rgba(251,191,36,0.2), 0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            {/* Animated shimmer strip */}
            <div
              className="shimmer-strip absolute inset-0 opacity-20 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(251,191,36,0.6) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.5s infinite linear',
              }}
            />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              {signedClients.length > 0 && (
                <span className="bg-gradient-to-r from-amber-400 to-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center shadow-sm">
                  {signedClients.length}
                </span>
              )}
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Entrée BDD</span>
              <p className="font-bold text-gray-900 mt-0.5">Validation Client</p>
              <p className="text-xs text-slate-500 mt-0.5">Finaliser & enregistrer</p>
            </div>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT PANEL — Hub Opérationnel (3/4)
        ══════════════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── KPI Mini-Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            {/* Devis envoyés */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200/60 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-blue-700 font-medium">Devis envoyés</p>
                <Send className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {sentQuotesMrr >= 1000
                  ? `${(sentQuotesMrr / 1000).toFixed(0)}k€`
                  : `${sentQuotesMrr.toLocaleString('fr-FR')} €`}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">{sentQuotesCount} devis · MRR</p>
            </div>

            {/* CA Onboardé */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200/60 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-emerald-700 font-medium">CA Onboardé</p>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-900">
                {(kpis.caOnboarde / 1000).toFixed(0)}k€
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">{signedClients.length} LDM signées</p>
            </div>

            {/* Clients actifs */}
            <button
              onClick={() => navigate('/dossiers-actifs')}
              className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 font-medium">Clients actifs</p>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{kpis.clientsActifs}</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                en cours <ArrowRight className="w-3 h-3" />
              </p>
            </button>

            {/* Alertes */}
            <button
              onClick={() => navigate('/taches-overdue')}
              className={`rounded-2xl p-4 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border ${
                kpis.blockers.length > 0
                  ? 'bg-red-50/60 border-red-200/60 hover:border-red-300'
                  : 'bg-white border-slate-200/60 hover:border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-medium ${kpis.blockers.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  Alertes
                </p>
                <AlertTriangle className={`w-4 h-4 ${kpis.blockers.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
              </div>
              <p className={`text-2xl font-bold ${kpis.blockers.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {kpis.blockers.length}
              </p>
              <p className={`text-xs mt-0.5 flex items-center gap-1 ${kpis.blockers.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                blocages <ArrowRight className="w-3 h-3" />
              </p>
            </button>
          </div>

          {/* ── Bento Grid ─────────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Hub Opérationnel
            </h2>
            <div className="grid grid-cols-4 gap-3">

              {/* Inbox IA — col-span-2, wider (action rapide) */}
              <button
                onClick={() => navigate('/inbox-ia')}
                className={`col-span-2 flex items-center gap-4 rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border relative ${
                  kpis.aiPending > 0
                    ? 'bg-purple-50 border-purple-200 hover:border-purple-300'
                    : 'bg-white border-slate-200/60 hover:border-purple-200'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  kpis.aiPending > 0 ? 'bg-purple-100' : 'bg-purple-50'
                }`}>
                  <Mail className={`w-8 h-8 ${kpis.aiPending > 0 ? 'text-purple-600' : 'text-purple-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-base ${kpis.aiPending > 0 ? 'text-purple-900' : 'text-gray-900'}`}>
                    Inbox IA
                  </p>
                  <p className={`text-sm mt-0.5 ${kpis.aiPending > 0 ? 'text-purple-600' : 'text-slate-500'}`}>
                    {kpis.aiPending > 0
                      ? `${kpis.aiPending} brouillon${kpis.aiPending > 1 ? 's' : ''} en attente`
                      : 'Emails & brouillons IA'}
                  </p>
                </div>
                {kpis.aiPending > 0 && (
                  <span className="absolute top-3 right-3 bg-purple-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {kpis.aiPending}
                  </span>
                )}
              </button>

              {/* Calendrier Fiscal */}
              <button
                onClick={() => navigate('/fiscal-calendar')}
                className="col-span-1 flex flex-col gap-3 bg-white border border-slate-200/60 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200 transition-all duration-200"
              >
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">Calendrier Fiscal</p>
                  <p className="text-xs text-slate-400 mt-0.5">Échéances</p>
                </div>
              </button>

              {/* GED SharePoint */}
              <button
                onClick={() => navigate('/ged')}
                className="col-span-1 flex flex-col gap-3 bg-white border border-slate-200/60 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-sky-200 transition-all duration-200"
              >
                <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center">
                  <HardDrive className="w-7 h-7 text-sky-600" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">GED SharePoint</p>
                  <p className="text-xs text-slate-400 mt-0.5">Documents</p>
                </div>
              </button>

              {/* Reprise Confraternelle */}
              <button
                onClick={() => navigate('/lettre-reprise')}
                className="col-span-1 flex flex-col gap-3 bg-white border border-slate-200/60 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200 transition-all duration-200"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Handshake className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">Reprise Confraternelle</p>
                  <p className="text-xs text-slate-400 mt-0.5">Lettres</p>
                </div>
              </button>

              {/* Email Engine — col-span-4, full-width prominent card */}
              <button
                onClick={() => navigate('/email-engine')}
                className="col-span-4 flex items-center gap-5 bg-white border border-slate-200/60 rounded-2xl p-5 text-left hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-200"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Send className="w-8 h-8 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-gray-900">Email Engine</p>
                  <p className="text-sm text-slate-500 mt-0.5">Moteur des emails envoyés — historique complet des envois clients</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 text-xs text-slate-400">
                  <span>Voir les envois</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

            </div>
          </div>

          {/* ── Charts ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-slate-600">
                  CA signé mensuel (LDM signées, €)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 px-5 pb-4">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                      formatter={(val: number) => [`${val.toLocaleString('fr-FR')} €`, 'CA signé']}
                    />
                    <Bar dataKey="ca" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader className="pb-0 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-slate-600">
                  Charge de travail (nouveaux dossiers)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 px-5 pb-4">
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradDossiers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                      formatter={(val: number) => [val, 'Dossiers']}
                    />
                    <Area
                      type="monotone"
                      dataKey="dossiers"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#gradDossiers)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

        </div>{/* end right panel */}
      </div>{/* end main layout */}

      {/* ── Blocages & Actions requises ──────────────────────────────── */}
      {kpis.blockers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Blocages & Actions requises
            </h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
              {kpis.blockers.length}
            </span>
          </div>
          <div className="space-y-2">
            {kpis.blockers.slice(0, 5).map((blocker, i) => (
              <button
                key={i}
                onClick={() => navigate(`/onboarding/${blocker.dossierId}`)}
                className="w-full flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-all group border border-slate-100 hover:border-slate-200"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  blocker.type === 'missing_doc' ? 'bg-red-100' :
                  blocker.type === 'pending_signature' ? 'bg-amber-100' :
                  'bg-blue-100'
                }`}>
                  {blocker.type === 'missing_doc' && <FileText className="w-4 h-4 text-red-600" />}
                  {blocker.type === 'pending_signature' && <Mail className="w-4 h-4 text-amber-600" />}
                  {blocker.type === 'action_required' && <Bell className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{blocker.clientNom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{blocker.message}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
              </button>
            ))}
            {kpis.blockers.length > 5 && (
              <p className="text-xs text-center text-gray-400 pt-2">
                +{kpis.blockers.length - 5} autres blocages
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Nouveau Dossier Modal ─────────────────────────────────────── */}
      {showNewDossierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Choisir le type de mission</h2>
              <button
                onClick={() => setShowNewDossierModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleNewReprise}
                disabled={creatingDossier}
                className="flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group disabled:opacity-60"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                    Reprise de dossier
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Client existant avec SIREN</p>
                </div>
              </button>
              <button
                onClick={handleNewCreation}
                disabled={creatingDossier}
                className="flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group disabled:opacity-60"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                    Création d'entreprise
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Nouveau client sans SIREN</p>
                </div>
              </button>
              <button
                onClick={handleNewProspect}
                disabled={creatingDossier}
                className="flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group disabled:opacity-60"
              >
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                  <FolderKanban className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    Nouveau prospect
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Dossier vierge à compléter</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-strip { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default HomeDashboard;
