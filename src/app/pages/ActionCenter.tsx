import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Zap, ArrowLeft, Clock, CheckCircle2, CalendarClock,
  Mail, AlertTriangle, Bell, Euro, ArrowRight, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDossiersContext } from '@/app/context/DossiersContext';
import { getDossierProgress, formatRelativeTime } from '@/app/utils/dossierUtils';
import type { DossierData } from '@/app/utils/localStorage';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days → "Overdue"
const CRITICAL_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days → "Critique"
const BULK_MAIL_LIMIT = 5;

// ─── Risk levels ──────────────────────────────────────────────────────────────
type RiskLevel = 'overdue' | 'critique';

interface ActionItem {
  dossier: DossierData;
  riskLevel: RiskLevel;
  daysSinceUpdate: number;
  financialRisk: number; // €/month
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parsePrix(prix: string): number {
  const num = parseFloat((prix ?? '').replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

/** Compute a monthly financial risk score for sorting. */
function getFinancialRisk(dossier: DossierData): number {
  const cd = dossier.clientData;
  const monthlyDevis =
    (cd.devisMonthlyAccounting ?? 0) +
    (cd.devisMonthlyClosing ?? 0) +
    (cd.devisMonthlySocial ?? 0) +
    (cd.devisMonthlyOptions ?? 0);
  if (monthlyDevis > 0) return monthlyDevis;
  // Fall back to annual price divided by 12
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // ── Build + sort action items ───────────────────────────────────────────────
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
      // Smart sort: highest financial risk first, then most overdue
      .sort((a, b) => {
        if (b.financialRisk !== a.financialRisk) return b.financialRisk - a.financialRisk;
        return b.daysSinceUpdate - a.daysSinceUpdate;
      });
  }, [dossiers, dismissedIds]);

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allIds = items.map(i => i.dossier.id);
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const isIndeterminate = !isAllSelected && allIds.some(id => selected.has(id));

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }, [isAllSelected, allIds]);

  // ── Quick Actions ───────────────────────────────────────────────────────────
  const handleGenerateAI = useCallback((item: ActionItem) => {
    const name = getClientName(item.dossier);
    const amount = item.financialRisk > 0
      ? ` (${Math.round(item.financialRisk).toLocaleString('fr-FR')} €/mois)`
      : '';
    toast.success(`Relance IA générée pour ${name}${amount}`, {
      description: `Brouillon créé — vérifiez votre Inbox IA avant envoi.`,
      action: { label: 'Voir Inbox IA', onClick: () => navigate('/inbox-ia') },
    });
  }, [navigate]);

  const handlePostpone = useCallback((item: ActionItem) => {
    // Updating the dossier resets updatedAt to now, pushing it out of the overdue window for 3 days
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

  // ── Bulk send ───────────────────────────────────────────────────────────────
  const handleBulkSend = useCallback(async () => {
    // Preserve display order by filtering items (already sorted by financial risk)
    const ids = items
      .filter(i => selected.has(i.dossier.id))
      .map(i => i.dossier.id)
      .slice(0, BULK_MAIL_LIMIT);
    if (ids.length === 0) return;
    setIsSendingBulk(true);
    // Simulate async send (replace with real API call as needed)
    await new Promise(r => setTimeout(r, 1200));
    setIsSendingBulk(false);
    setSelected(new Set());
    toast.success(`${ids.length} relance${ids.length > 1 ? 's' : ''} IA envoyée${ids.length > 1 ? 's' : ''} !`, {
      description: 'Les brouillons ont été soumis depuis votre Inbox IA.',
      action: { label: 'Voir Inbox IA', onClick: () => navigate('/inbox-ia') },
    });
  }, [selected, navigate]);

  // ─── Render ──────────────────────────────────────────────────────────────
  const overdueCount = items.filter(i => i.riskLevel === 'overdue').length;
  const critiqueCount = items.filter(i => i.riskLevel === 'critique').length;
  const selectionCount = selected.size;

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
                {items.length === 0
                  ? 'Aucune action requise — tout est à jour !'
                  : `${items.length} dossier${items.length > 1 ? 's' : ''} requièrent votre attention`}
              </p>
            </div>
          </div>

          {/* Summary badges */}
          {items.length > 0 && (
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
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6 max-w-5xl mx-auto">
        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Aucune action requise</p>
            <p className="text-sm text-gray-400 mt-1">Tous vos dossiers sont à jour. Bravo !</p>
          </div>
        ) : (
          <>
            {/* ── Bulk action bar ── */}
            <div className="flex items-center justify-between mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isAllSelected}
                  data-state={isIndeterminate ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked'}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Tout sélectionner"
                />
                <span className="text-sm text-gray-600">
                  {selectionCount === 0
                    ? 'Sélectionner tout'
                    : `${selectionCount} sélectionné${selectionCount > 1 ? 's' : ''}`}
                </span>
              </div>

              <button
                onClick={handleBulkSend}
                disabled={selectionCount === 0 || isSendingBulk}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isSendingBulk ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Envoyer {selectionCount > 0 ? `${Math.min(selectionCount, BULK_MAIL_LIMIT)} ` : ''}relance{selectionCount !== 1 ? 's' : ''} IA
              </button>
            </div>

            {selectionCount > BULK_MAIL_LIMIT && (
              <p className="text-xs text-amber-600 mb-3 px-1">
                ⚠ Seules les {BULK_MAIL_LIMIT} premières relances seront envoyées en lot.
              </p>
            )}

            {/* ── Table header (md+) ── */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              <span />
              <span>Client / Dossier</span>
              <span className="text-right">Risque financier</span>
              <span className="text-center">Niveau</span>
              <span className="text-center">Inactivité</span>
              <span className="text-right">Actions</span>
            </div>

            {/* ── Rows ── */}
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
                        ? 'border-violet-300 shadow-md ring-1 ring-violet-200'
                        : isOverdue
                        ? 'border-red-200 hover:border-red-300'
                        : 'border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 md:gap-4 px-4 py-4">
                      {/* Checkbox */}
                      <div className="flex items-center">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(dossier.id)}
                          aria-label={`Sélectionner ${name}`}
                        />
                      </div>

                      {/* Client info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{name}</span>
                          {dossier.clientData.missionType && (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 capitalize">
                              {dossier.clientData.missionType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-400' : 'text-amber-400'}`} />
                            {formatRelativeTime(dossier.updatedAt)}
                          </span>
                          <span>{Math.round(progress * 100)}% complété</span>
                          {/* Progress bar (mobile) */}
                          <span className="flex-1 md:hidden">
                            <span className="block h-1 bg-gray-200 rounded-full overflow-hidden w-16">
                              <span
                                className={`block h-full rounded-full ${isOverdue ? 'bg-red-400' : 'bg-amber-400'}`}
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </span>
                          </span>
                        </div>

                        {/* Quick actions (mobile layout) */}
                        <div className="flex items-center gap-2 mt-2 md:hidden">
                          <QuickActions item={item} onGenerateAI={handleGenerateAI} onPostpone={handlePostpone} onMarkDone={handleMarkDone} navigate={navigate} compact />
                        </div>
                      </div>

                      {/* Financial risk (md+) */}
                      <div className="hidden md:flex items-center justify-end gap-1">
                        {financialRisk > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
                            <Euro className="w-3.5 h-3.5 text-gray-400" />
                            {Math.round(financialRisk).toLocaleString('fr-FR')}
                            <span className="text-xs font-normal text-gray-400">/mois</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>

                      {/* Risk badge (md+) */}
                      <div className="hidden md:flex justify-center">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            <Bell className="w-3 h-3" />
                            Critique
                          </span>
                        )}
                      </div>

                      {/* Days inactive (md+) */}
                      <div className="hidden md:flex flex-col items-center">
                        <span className={`text-lg font-bold ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                          {daysSinceUpdate}j
                        </span>
                        <span className="text-xs text-gray-400">inactif</span>
                      </div>

                      {/* Quick actions (md+) */}
                      <div className="hidden md:flex items-center gap-1.5 justify-end">
                        <QuickActions item={item} onGenerateAI={handleGenerateAI} onPostpone={handlePostpone} onMarkDone={handleMarkDone} navigate={navigate} />
                      </div>
                    </div>

                    {/* Progress bar footer (md+) */}
                    <div className="hidden md:block px-4 pb-3">
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-300' : 'bg-amber-300'}`}
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Legend ── */}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                Overdue — sans mise à jour depuis plus de 7 jours
              </span>
              <span className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                Critique — sans mise à jour depuis 3–7 jours
              </span>
              <span className="flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5 text-gray-400" />
                Trié par risque financier décroissant
              </span>
            </div>
          </>
        )}
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
      {/* Generate AI reminder */}
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

      {/* Postpone to tomorrow */}
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

      {/* Mark as done */}
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

      {/* Open dossier */}
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
