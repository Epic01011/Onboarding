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
  HardDrive, TrendingUp, Send,
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
    <div className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour, voici votre espace de travail
          </h1>
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

      {/* ── Tools Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* 1. Moteur de Pricing */}
        <button
          onClick={() => navigate('/pricing')}
          className="group flex flex-col items-start gap-3 bg-white border border-slate-200/60 rounded-2xl p-5 h-36 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-blue-200"
        >
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calculator className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Moteur de Pricing</p>
            <p className="text-xs text-muted-foreground mt-0.5">Calculer les honoraires</p>
          </div>
        </button>

        {/* 2. Moteur de LDM */}
        <button
          onClick={() => navigate('/lettre-mission')}
          className={`group flex flex-col items-start gap-3 rounded-2xl p-5 h-36 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border ${
            validatedQuotesCount > 0
              ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
              : 'bg-white border-slate-200/60 hover:border-emerald-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            validatedQuotesCount > 0 ? 'bg-emerald-100' : 'bg-emerald-50'
          }`}>
            <Cog className={`w-5 h-5 ${validatedQuotesCount > 0 ? 'text-emerald-600' : 'text-emerald-500'}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${validatedQuotesCount > 0 ? 'text-emerald-800' : 'text-gray-900'}`}>
              Moteur LDM
            </p>
            <p className={`text-xs mt-0.5 ${validatedQuotesCount > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {validatedQuotesCount > 0
                ? `${validatedQuotesCount} proposition${validatedQuotesCount > 1 ? 's' : ''} validée${validatedQuotesCount > 1 ? 's' : ''} à traiter`
                : 'Lettres de mission'}
            </p>
          </div>
        </button>

        {/* 3. Moteur de Reprise Confraternelle */}
        <button
          onClick={() => navigate('/lettre-reprise')}
          className="group flex flex-col items-start gap-3 bg-white border border-slate-200/60 rounded-2xl p-5 h-36 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-amber-200"
        >
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Handshake className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Moteur de reprise confraternelle</p>
            <p className="text-xs text-muted-foreground mt-0.5">Lettres confraternelles</p>
          </div>
        </button>

        {/* 4. Moteur de Prospection */}
        <button
          onClick={() => navigate('/prospection')}
          className="group flex flex-col items-start gap-3 bg-white border border-slate-200/60 rounded-2xl p-5 h-36 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-blue-200"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Radar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Moteur de Prospection</p>
            <p className="text-xs text-muted-foreground mt-0.5">CRM & relances</p>
          </div>
        </button>

        {/* 5. Inbox IA */}
        <button
          onClick={() => navigate('/inbox-ia')}
          className={`group flex flex-col items-start gap-3 rounded-2xl p-5 h-36 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border ${
            kpis.aiPending > 0
              ? 'bg-purple-50 border-purple-200 hover:border-purple-300'
              : 'bg-white border-slate-200/60 hover:border-purple-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            kpis.aiPending > 0 ? 'bg-purple-100' : 'bg-purple-50'
          }`}>
            <Mail className={`w-5 h-5 ${kpis.aiPending > 0 ? 'text-purple-600' : 'text-purple-500'}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${kpis.aiPending > 0 ? 'text-purple-800' : 'text-gray-900'}`}>
              Inbox IA
            </p>
            <p className={`text-xs mt-0.5 ${kpis.aiPending > 0 ? 'text-purple-600' : 'text-muted-foreground'}`}>
              {kpis.aiPending > 0
                ? `${kpis.aiPending} brouillon${kpis.aiPending > 1 ? 's' : ''} en attente`
                : 'Emails & brouillons IA'}
            </p>
          </div>
        </button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Devis envoyés */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-blue-700 font-medium">Devis envoyés</p>
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {sentQuotesMrr >= 1000
              ? `${(sentQuotesMrr / 1000).toFixed(0)}k€`
              : `${sentQuotesMrr.toLocaleString('fr-FR')} €`}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {sentQuotesCount} devis · MRR envoyé
          </p>
        </div>

        {/* CA Onboardé */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-emerald-700 font-medium">CA Onboardé</p>
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-900">
            {(kpis.caOnboarde / 1000).toFixed(0)}k€
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            {signedClients.length} LDM signées
          </p>
        </div>

        {/* Clients actifs */}
        <button
          className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-300"
          onClick={() => navigate('/dossiers-actifs')}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-500 font-medium">Clients actifs</p>
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{kpis.clientsActifs}</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            dossiers en cours <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Tâches / Alertes */}
        <button
          className={`rounded-2xl p-5 shadow-sm text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border ${
            kpis.blockers.length > 0
              ? 'bg-red-50/50 border-red-200/60 hover:border-red-300'
              : 'bg-white border-slate-200/60 hover:border-red-200'
          }`}
          onClick={() => navigate('/taches-overdue')}
        >
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-medium ${kpis.blockers.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              Tâches / Alertes
            </p>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpis.blockers.length > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${kpis.blockers.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            </div>
          </div>
          <p className={`text-3xl font-bold ${kpis.blockers.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {kpis.blockers.length}
          </p>
          <p className={`text-xs mt-1 flex items-center gap-1 ${kpis.blockers.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            blocages actifs <ArrowRight className="w-3 h-3" />
          </p>
        </button>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CA signé mensuel */}
        <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-slate-700">
              CA signé mensuel (LDM signées, €)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 px-5 pb-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  formatter={(val: number) => [`${val.toLocaleString('fr-FR')} €`, 'CA signé']}
                />
                <Bar dataKey="ca" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Charge de travail */}
        <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-slate-700">
              Charge de travail (nouveaux dossiers)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 px-5 pb-5">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDossiers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
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

      {/* ── Autres accès ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Autres accès
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/fiscal-calendar')}
            className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200 transition-all duration-300"
          >
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">Calendrier Fiscal</p>
              <p className="text-xs text-slate-400 truncate">Échéances</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/ged')}
            className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-300"
          >
            <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-4 h-4 text-sky-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">GED SharePoint</p>
              <p className="text-xs text-slate-400 truncate">Documents</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/taches-overdue')}
            className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-red-200 transition-all duration-300"
          >
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">Tâches en retard</p>
              <p className="text-xs text-slate-400 truncate">Overdue</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/relances-critiques')}
            className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 hover:border-orange-200 transition-all duration-300"
          >
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">Relances critiques</p>
              <p className="text-xs text-slate-400 truncate">Urgences</p>
            </div>
          </button>
        </div>
      </div>

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
                  <p className="text-xs text-gray-500 mt-1">
                    Client existant avec SIREN
                  </p>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Nouveau client sans SIREN
                  </p>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Dossier vierge à compléter
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeDashboard;
