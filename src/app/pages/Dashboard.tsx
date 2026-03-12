import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { HomeDashboard } from '@/components/dashboard/HomeDashboard';
import { EmailEngine } from '@/components/dashboard/EmailEngine';
import { NewProspectModal } from '@/components/crm/NewProspectModal';
import {
  FolderOpen, Clock, CheckCircle2, Building2,
  Trash2, ArrowRight, Zap, AlertCircle,
  Settings, LogOut,
  UserPlus, TrendingUp,
} from 'lucide-react';
import { createDemoDossiers } from '../utils/demoData';
import { useAuth } from '../context/AuthContext';
import { useDossiersContext } from '../context/DossiersContext';
import { useServices } from '../context/ServicesContext';
import { type MissionType } from '../context/OnboardingContext';
import { toast } from 'sonner';
import {
  getSignedClients, getValidatedQuotes, getSentQuotes, getSentEmails,
  type SignedClient, type SentEmailRecord,
} from '../utils/supabaseSync';
import { getDossierStatus } from '../utils/dossierUtils';
import { useDashboardStore } from '../store/useDashboardStore';

export function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { dossiers, createDossier, saveDossier, removeDossier } = useDossiersContext();
  const { connections } = useServices();
  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [, setCreatingDossier] = useState(false);
  const [showNewProspectModal, setShowNewProspectModal] = useState(false);
  const { balanceSheets, loadBalanceSheetsFromSupabase } = useDashboardStore();

  // ── Signed clients (propositions SIGNED) ────────────────────────────────
  const [signedClients, setSignedClients] = useState<SignedClient[]>([]);

  // ── Validated quotes count for LDM moteur card ──────────────────────────
  const [validatedQuotesCount, setValidatedQuotesCount] = useState(0);

  // ── Sent quotes analytics (total MRR des devis envoyés) ─────────────────
  const [sentQuotesMrr, setSentQuotesMrr] = useState(0);
  const [sentQuotesCount, setSentQuotesCount] = useState(0);

  // ── Sent emails log for Email Engine widget ──────────────────────────────
  const [sentEmails, setSentEmails] = useState<SentEmailRecord[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  const loadDemoData = async () => {
    const demoDossiers = createDemoDossiers();
    for (const d of demoDossiers) {
      await saveDossier(d);
    }
    toast.success('Dossiers de démonstration chargés');
  };

  const handleCreateNew = async (missionType: MissionType) => {
    if (!missionType) return;
    setCreatingDossier(true);
    try {
      const newDossier = await createDossier();
      await saveDossier({
        ...newDossier,
        clientData: { ...newDossier.clientData, missionType },
        stepStatuses: Array(11).fill('pending').map((s, i) => (i === 0 ? 'active' : s)),
        currentStep: 1,
      });
      navigate(`/onboarding/${newDossier.id}`);
    } catch {
      toast.error('Erreur lors de la création du dossier');
    } finally {
      setCreatingDossier(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Êtes-vous sûr de vouloir supprimer ce dossier ?')) {
      await removeDossier(id);
      toast.success('Dossier supprimé');
    }
  };

  const handleOpenDossier = (id: string) => {
    navigate(`/onboarding/${id}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Déconnexion réussie');
      navigate('/auth');
    } catch {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  // ── Load signed clients & validated quotes count from Supabase ─────────
  const loadDashboardData = useCallback(async () => {
    try {
      const [signedResult, validatedResult, sentResult] = await Promise.all([
        getSignedClients(),
        getValidatedQuotes(),
        getSentQuotes(),
      ]);
      if (signedResult.success) {
        setSignedClients(signedResult.clients);
      }
      if (validatedResult.success) {
        setValidatedQuotesCount(validatedResult.quotes.length);
      }
      if (sentResult.success) {
        setSentQuotesMrr(sentResult.totalMrr);
        setSentQuotesCount(sentResult.quotes.length);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, []);

  const loadSentEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const result = await getSentEmails();
      if (result.success) setSentEmails(result.emails);
    } catch (err) {
      console.error('Error loading sent emails:', err);
    } finally {
      setEmailsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadSentEmails();
    loadBalanceSheetsFromSupabase();
  }, [loadDashboardData, loadSentEmails, loadBalanceSheetsFromSupabase]);

  const filteredDossiers = useMemo(() => dossiers.filter(d => {
    if (activeFilter === 'all') return true;
    const s = getDossierStatus(d);
    if (activeFilter === 'in_progress') return s === 'in_progress';
    if (activeFilter === 'completed') return s === 'completed';
    return true;
  }), [dossiers, activeFilter]);

  const fiscalPeriodValue = useMemo(() => {
    if (balanceSheets.length === 0) return '—';
    const certified = balanceSheets.filter(s => s.productionStep === 'certified').length;
    return `${certified}/${balanceSheets.length}`;
  }, [balanceSheets]);

  const statCards = useMemo(() => [
    { label: 'Total Dossiers', value: dossiers.length, icon: FolderOpen, color: 'blue' },
    { label: 'En cours', value: dossiers.filter(d => getDossierStatus(d) === 'in_progress').length, icon: Clock, color: 'amber' },
    { label: 'Terminés', value: dossiers.filter(d => getDossierStatus(d) === 'completed').length, icon: CheckCircle2, color: 'emerald' },
    {
      label: 'Avancement Période Fiscale',
      value: fiscalPeriodValue,
      icon: TrendingUp,
      color: 'indigo',
      onClick: () => navigate('/balance-sheet'),
    },
  ], [dossiers, fiscalPeriodValue, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg text-gray-900">CabinetFlow</h1>
                <p className="text-xs text-gray-500">Plateforme d'onboarding client automatisée</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Services status */}
              <div className="hidden md:flex items-center gap-1.5 mr-2">
                {Object.entries(connections).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1 text-xs text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${val.connected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span className="capitalize">{key}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Services Connection Warning */}
        {Object.values(connections).some(c => !c.connected) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Services non configurés</p>
              <p className="text-xs text-amber-700 mt-1">
                Certains services nécessaires ne sont pas configurés. Rendez-vous dans les paramètres pour les connecter.
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Configurer →
            </button>
          </div>
        )}

        {/* Home Dashboard Component */}
        <HomeDashboard
          signedClients={signedClients}
          validatedQuotesCount={validatedQuotesCount}
          sentQuotesMrr={sentQuotesMrr}
          sentQuotesCount={sentQuotesCount}
          onNewProspect={() => setShowNewProspectModal(true)}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mb-8">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`bg-white rounded-xl border border-gray-200 p-6 ${'onClick' in card ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all' : ''}`}
              onClick={'onClick' in card ? card.onClick : undefined}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 bg-${card.color}-100 rounded-xl flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 text-${card.color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Signed Clients Section */}
        {signedClients.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Nouveaux clients à intégrer</h2>
              </div>
              <span className="text-sm text-gray-500">{signedClients.length} client(s)</span>
            </div>
            <div className="space-y-3">
              {signedClients.map(client => (
                <div key={client.clientId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{client.clientName}</p>
                      <p className="text-xs text-gray-500">SIRET: {client.siret ?? '—'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCreateNew('creation')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    Démarrer onboarding <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dossiers List */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Dossiers</h2>
            <div className="flex items-center gap-2">
              {(['all', 'in_progress', 'completed'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeFilter === filter
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filter === 'all' ? 'Tous' : filter === 'in_progress' ? 'En cours' : 'Terminés'}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredDossiers.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucun dossier pour le moment</p>
                <p className="mt-2 text-xs text-gray-400">
                  Utilisez le bouton "+ Nouveau dossier" ci-dessus pour créer votre premier dossier.
                </p>
              </div>
            ) : (
              filteredDossiers.map(dossier => (
                <div
                  key={dossier.id}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleOpenDossier(dossier.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {dossier.clientData.raisonSociale || `Dossier ${dossier.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {dossier.clientData.siren || 'SIREN non renseigné'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        getDossierStatus(dossier) === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {getDossierStatus(dossier) === 'completed' ? 'Terminé' : 'En cours'}
                      </span>
                      <button
                        onClick={(e) => handleDelete(dossier.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Demo Data Button */}
        {dossiers.length === 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={loadDemoData}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Charger des données de démonstration
            </button>
          </div>
        )}

        {/* Email Engine */}
        <div className="mt-8">
          <EmailEngine emails={sentEmails} loading={emailsLoading} />
        </div>
      </main>

      <NewProspectModal
        open={showNewProspectModal}
        onClose={() => setShowNewProspectModal(false)}
      />
    </div>
  );
}
