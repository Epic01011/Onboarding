import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Zap, ArrowLeft, Clock, CheckCircle2, CalendarClock,
  Mail, AlertTriangle, Bell, Euro, ArrowRight, Sparkles,
  ListTodo, UserX, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDossiersContext } from '@/app/context/DossiersContext';
import { getDossierProgress, formatRelativeTime } from '@/app/utils/dossierUtils';
import type { DossierData } from '@/app/utils/localStorage';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { useProspectStore } from '@/app/store/useProspectStore';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CRITICAL_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const PROSPECT_INACTIVITY_DAYS = 7;
const BULK_MAIL_LIMIT = 5;

// Prospect statuses still requiring follow-up
const ACTIVE_PROSPECT_STATUSES = new Set(['a-contacter', 'email-envoye', 'en-negociation']);

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = 'overdue' | 'critique';

interface ActionItem {
  dossier: DossierData;
  riskLevel: RiskLevel;
  daysSinceUpdate: number;
  financialRisk: number;
}

interface ProspectAlert {
  id: string;
  companyName: string;
  daysInactive: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parsePrix(prix: string): number {
  const num = parseFloat((prix ?? '').replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function getFinancialRisk(dossier: DossierData): number {
  const cd = dossier.clientData;
  const monthlyDevis =
    (cd.devisMonthlyAccounting ?? 0) +
    (cd.devisMonthlyClosing ?? 0) +
    (cd.devisMonthlySocial ?? 0) +
    (cd.devisMonthlyOptions ?? 0);
  if (monthlyDevis > 0) return monthlyDevis;
  return parsePrix(cd.prixAnnuel) / 12;
}

function getClientName(dossier: DossierData): string {
  return (
    dossier.clientData.raisonSociale ||
    dossier.clientData.denominationCreation ||
    dossier.clientData.nom ||
    'Client sans nom'
  );
}

// ─── Action Center ────────────────────────────────────────────────────────────
export function ActionCenter() {
  const navigate = useNavigate();
  const { dossiers, saveDossier } = useDossiersContext();
  const { prospects } = useProspectStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [dismissedProspectIds, setDismissedProspectIds] = useState<Set<string>>(new Set());

  // ── Dossier action items ────────────────────────────────────────────────────
  const items = useMemo<ActionItem[]>(() => {
    const now = Date.now();
    return dossiers
      .filter(d => {
        if (getDossierProgress(d) >= 1) return false;
        if (dismissedIds.has(d.id)) return false;
        const elapsed = now - new Date(d.updatedAt).getTime();
        return elapsed > CRITICAL_THRESHOLD_MS;
      })
      .map(d => {
        const elapsed = now - new Date(d.updatedAt).getTime();
        const riskLevel: RiskLevel = elapsed > OVERDUE_THRESHOLD_MS ? 'overdue' : 'critique';
        return {
          dossier: d,
          riskLevel,
          daysSinceUpdate: Math.floor(elapsed / (1000 * 60 * 60 * 24)),
          financialRisk: getFinancialRisk(d),
        };
      })
      .sort((a, b) => {
        if (b.financialRisk !== a.financialRisk) return b.financialRisk - a.financialRisk;
        return b.daysSinceUpdate - a.daysSinceUpdate;
      });
  }, [dossiers, dismissedIds]);

  // ── Prospect 7-day inactivity alerts ───────────────────────────────────────
  const prospectAlerts = useMemo<ProspectAlert[]>(() => {
    const now = Date.now();
    const thresholdMs = PROSPECT_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
    return prospects
      .filter(p => {
        if (!ACTIVE_PROSPECT_STATUSES.has(p.status)) return false;
        if (dismissedProspectIds.has(p.id)) return false;
        return now - new Date(p.updated_at).getTime() > thresholdMs;
      })
      .map(p => {
        const elapsedMs = now - new Date(p.updated_at).getTime();
        return {
          id: p.id,
          companyName: p.company_name,
          daysInactive: Math.floor(elapsedMs / (1000 * 60 * 60 * 24)),
        };
      })
      .sort((a, b) => b.daysInactive - a.daysInactive);
  }, [prospects, dismissedProspectIds]);

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allIds = useMemo(() => items.map(i => i.dossier.id), [items]);
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const isIndeterminate = !isAllSelected && allIds.some(id => selected.has(id));

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected(isAllSelected ? new Set() : new Set(allIds));
  }, [isAllSelected, allIds]);

  // ── Dossier quick actions ───────────────────────────────────────────────────
  const handleGenerateAI = useCallback((item: ActionItem) => {
    const name = getClientName(item.dossier);
    const amount = item.financialRisk > 0
      ? ` (${Math.round(item.financialRisk).toLocaleString('fr-FR')} €/mois)`
      : '';
    toast.success(`Relance IA générée pour ${name}${amount}`, {
      description: 'Brouillon créé — vérifiez votre Inbox IA avant envoi.',
      action: { label: 'Voir Inbox IA', onClick: () => navigate('/inbox-ia') },
    });
  }, [navigate]);

  const handlePostpone = useCallback((item: ActionItem) => {
    saveDossier({ ...item.dossier });
    setDismissedIds(prev => new Set([...prev, item.dossier.id]));
    toast.info(`${getClientName(item.dossier)} reporté de 3 jours`, {
      description: 'Le dossier réapparaîtra dans 3 jours si aucune nouvelle mise à jour.',
    });
  }, [saveDossier]);

  const handleMarkDone = useCallback((item: ActionItem) => {
    const completed = item.dossier.stepStatuses.map(() => 'completed' as const);
    saveDossier({ ...item.dossier, stepStatuses: completed });
    setDismissedIds(prev => new Set([...prev, item.dossier.id]));
    toast.success(`${getClientName(item.dossier)} marqué comme terminé !`);
  }, [saveDossier]);

  const handleBulkSend = useCallback(async () => {
    const ids = items
      .filter(i => selected.has(i.dossier.id))
      .map(i => i.dossier.id)
      .slice(0, BULK_MAIL_LIMIT);
    if (ids.length === 0) return;
    setIsSendingBulk(true);
    await new Promise(r => setTimeout(r, 1200));
    setIsSendingBulk(false);
    setSelected(new Set());
    toast.success(`${ids.length} relance${ids.length > 1 ? 's' : ''} IA envoyée${ids.length > 1 ? 's' : ''} !`, {
      description: 'Les brouillons ont été soumis depuis votre Inbox IA.',
      action: { label: 'Voir Inbox IA', onClick: () => navigate('/inbox-ia') },
    });
  }, [selected, items, navigate]);

  // ── Prospect alert actions ──────────────────────────────────────────────────
  const handleGoToProspect = useCallback((id: string) => {
    navigate(`/prospection?prospectId=${id}`);
  }, [navigate]);

  const handleDismissProspect = useCallback((id: string) => {
    setDismissedProspectIds(prev => new Set([...prev, id]));
  }, []);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const overdueCount = items.filter(i => i.riskLevel === 'overdue').length;
  const critiqueCount = items.filter(i => i.riskLevel === 'critique').length;
  const selectionCount = selected.size;
  const totalAlerts = items.length + prospectAlerts.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Centre d'action unifié</h1>
              <p className="text-sm text-gray-500">
                {totalAlerts === 0
                  ? 'Aucune action requise — tout est à jour !'
                  : `${items.length} tâche${items.length !== 1 ? 's' : ''} · ${prospectAlerts.length} alerte${prospectAlerts.length !== 1 ? 's' : ''} prospect`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                {overdueCount} overdue
              </span>
            )}
            {critiqueCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <Bell className="w-3.5 h-3.5" />
                {critiqueCount} critique{critiqueCount > 1 ? 's' : ''}
              </span>
            )}
            {prospectAlerts.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                <UserX className="w-3.5 h-3.5" />
                {prospectAlerts.length} prospect{prospectAlerts.length > 1 ? 's' : ''} inactif{prospectAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column content ── */}
      <div className="px-4 py-6 max-w-7xl mx-auto">
        {totalAlerts === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Aucune action requise</p>
            <p className="text-sm text-gray-400 mt-1">Tous vos dossiers et prospects sont à jour. Bravo !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ══ LEFT — Tâches Opérationnelles ══ */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <ListTodo className="w-5 h-5 text-violet-600" />
                <h2 className="text-base font-semibold text-gray-900">Tâches Opérationnelles</h2>
                {items.length > 0 && (
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    {items.length}
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune tâche en attente</p>
                </div>
              ) : (
                <>
                  {/* Bulk action bar */}
                  <div className="flex items-center justify-between mb-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isAllSelected}
                        data-state={isIndeterminate ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked'}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Tout sélectionner"
                      />
                      <span className="text-sm text-gray-600">
                        {selectionCount === 0 ? 'Tout sélectionner' : `${selectionCount} sélectionné${selectionCount > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <button
                      onClick={handleBulkSend}
                      disabled={selectionCount === 0 || isSendingBulk}
                      className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {isSendingBulk ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Mail className="w-3.5 h-3.5" />
                      )}
                      Relances IA{selectionCount > 0 ? ` (${Math.min(selectionCount, BULK_MAIL_LIMIT)})` : ''}
                    </button>
                  </div>

                  {selectionCount > BULK_MAIL_LIMIT && (
                    <p className="text-xs text-amber-600 mb-2 px-1">
                      ⚠ Seules les {BULK_MAIL_LIMIT} premières relances seront envoyées en lot.
                    </p>
                  )}

                  {/* Task list */}
                  <div className="space-y-2">
                    {items.map(item => {
                      const { dossier, riskLevel, daysSinceUpdate, financialRisk } = item;
                      const name = getClientName(dossier);
                      const progress = getDossierProgress(dossier);
                      const isChecked = selected.has(dossier.id);
                      const isOverdue = riskLevel === 'overdue';

                      return (
                        <div
                          key={dossier.id}
                          className={`bg-white rounded-xl border transition-all ${
                            isChecked
                              ? 'border-violet-300 shadow-sm ring-1 ring-violet-200'
                              : isOverdue
                              ? 'border-red-200 hover:border-red-300'
                              : 'border-amber-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-start gap-3 px-4 py-3">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleSelect(dossier.id)}
                              aria-label={`Sélectionner ${name}`}
                              className="mt-0.5 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900 text-sm truncate">{name}</span>
                                {isOverdue ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex-shrink-0">
                                    <AlertTriangle className="w-3 h-3" />
                                    Urgent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 flex-shrink-0">
                                    <Bell className="w-3 h-3" />
                                    Critique
                                  </span>
                                )}
                                {dossier.clientData.missionType && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 capitalize flex-shrink-0">
                                    {dossier.clientData.missionType}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-400' : 'text-amber-400'}`} />
                                  {formatRelativeTime(dossier.updatedAt)}
                                </span>
                                <span>{Math.round(progress * 100)}% complété</span>
                                {financialRisk > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Euro className="w-3 h-3" />
                                    {Math.round(financialRisk).toLocaleString('fr-FR')}/mois
                                  </span>
                                )}
                                <span className={`font-semibold ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                                  {daysSinceUpdate}j inactif
                                </span>
                              </div>
                              <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-300' : 'bg-amber-300'}`}
                                  style={{ width: `${Math.round(progress * 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-1.5 mt-2">
                                <QuickActions
                                  item={item}
                                  onGenerateAI={handleGenerateAI}
                                  onPostpone={handlePostpone}
                                  onMarkDone={handleMarkDone}
                                  navigate={navigate}
                                  compact
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      Urgent — +7 jours sans mise à jour
                    </span>
                    <span className="flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      Critique — 3–7 jours sans mise à jour
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* ══ RIGHT — Relances & Alertes ══ */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-semibold text-gray-900">Relances &amp; Alertes</h2>
                {prospectAlerts.length > 0 && (
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    {prospectAlerts.length}
                  </span>
                )}
              </div>

              {prospectAlerts.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune alerte prospect</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tous vos prospects actifs ont été contactés récemment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prospectAlerts.map(alert => (
                    <ProspectAlertCard
                      key={alert.id}
                      alert={alert}
                      onGo={handleGoToProspect}
                      onDismiss={handleDismissProspect}
                    />
                  ))}
                </div>
              )}

              {/* Overdue dossier secondary section */}
              {overdueCount > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    Dossiers en retard critique
                  </p>
                  <div className="space-y-2">
                    {items
                      .filter(i => i.riskLevel === 'overdue')
                      .map(item => (
                        <div
                          key={item.dossier.id}
                          className="bg-white rounded-xl border border-red-200 px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900 truncate">
                                {getClientName(item.dossier)}
                              </span>
                              <span className="text-xs font-bold text-red-500 flex-shrink-0">
                                {item.daysSinceUpdate}j inactif
                              </span>
                            </div>
                            {item.financialRisk > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                                <Euro className="w-3 h-3" />
                                {Math.round(item.financialRisk).toLocaleString('fr-FR')} €/mois à risque
                              </p>
                            )}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => navigate(`/onboarding/${item.dossier.id}`)}
                                className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-colors"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                Ouvrir
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Ouvrir le dossier</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Prospect Alert Card ──────────────────────────────────────────────────────
interface ProspectAlertCardProps {
  alert: ProspectAlert;
  onGo: (id: string) => void;
  onDismiss: (id: string) => void;
}

function ProspectAlertCard({ alert, onGo, onDismiss }: ProspectAlertCardProps) {
  return (
    <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-orange-400 to-red-400" />
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <UserX className="w-4 h-4 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{alert.companyName}</p>
              <p className="text-xs text-orange-600 mt-0.5 font-medium">
                Inactif depuis {alert.daysInactive} jour{alert.daysInactive > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 flex-shrink-0">
            <AlertTriangle className="w-3 h-3" />
            Action Requise
          </span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onGo(alert.id)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Aller relancer
          </button>
          <button
            onClick={() => onDismiss(alert.id)}
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            Ignorer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Actions sub-component ─────────────────────────────────────────────
interface QuickActionsProps {
  item: ActionItem;
  onGenerateAI: (item: ActionItem) => void;
  onPostpone: (item: ActionItem) => void;
  onMarkDone: (item: ActionItem) => void;
  navigate: ReturnType<typeof useNavigate>;
  compact?: boolean;
}

function QuickActions({ item, onGenerateAI, onPostpone, onMarkDone, navigate, compact = false }: QuickActionsProps) {
  const btnBase = compact
    ? 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors'
    : 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors';

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={e => { e.stopPropagation(); onGenerateAI(item); }}
            className={`${btnBase} bg-violet-50 hover:bg-violet-100 text-violet-700`}
            aria-label="Générer relance IA"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {!compact && 'Relance IA'}
          </button>
        </TooltipTrigger>
        <TooltipContent>Générer relance IA</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={e => { e.stopPropagation(); onPostpone(item); }}
            className={`${btnBase} bg-blue-50 hover:bg-blue-100 text-blue-700`}
            aria-label="Reporter à demain"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            {!compact && 'Reporter'}
          </button>
        </TooltipTrigger>
        <TooltipContent>Reporter à demain</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={e => { e.stopPropagation(); onMarkDone(item); }}
            className={`${btnBase} bg-emerald-50 hover:bg-emerald-100 text-emerald-700`}
            aria-label="Marquer comme fait"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {!compact && 'Fait'}
          </button>
        </TooltipTrigger>
        <TooltipContent>Marquer comme fait</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={e => { e.stopPropagation(); navigate(`/onboarding/${item.dossier.id}`); }}
            className={`${btnBase} bg-gray-50 hover:bg-gray-100 text-gray-600`}
            aria-label="Ouvrir le dossier"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Ouvrir le dossier</TooltipContent>
      </Tooltip>
    </>
  );
}
