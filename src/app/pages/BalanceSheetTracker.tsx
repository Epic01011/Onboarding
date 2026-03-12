/**
 * BalanceSheetTracker.tsx — Suivi des Bilans
 *
 * Module de production pour la période fiscale du cabinet.
 * Récupère les exercices comptables depuis Pennylane via syncBalanceSheetData(),
 * les persiste dans Supabase (balance_sheets), et affiche :
 *   - Tableau de bord de production avec barres de progression
 *   - Alertes deadline J-30 / J-15
 *   - Filtres par collaborateur et mois de clôture
 *   - Bouton "Actualiser Pennylane" pour sync manuelle
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  ChevronDown,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { BalanceSheetRecord } from '../utils/supabaseSync';
import type { ProductionStep } from '../types/dashboard';

// ─── Production step config ───────────────────────────────────────────────────

const PRODUCTION_STEPS: ProductionStep[] = [
  'not_started',
  'data_collection',
  'revision',
  'final_review',
  'certified',
];

const STEP_LABELS: Record<ProductionStep, string> = {
  not_started:    'Non démarré',
  data_collection: 'Collecte données',
  revision:       'Révision',
  final_review:   'Revue finale',
  certified:      'Certifié',
};

const STEP_PROGRESS: Record<ProductionStep, number> = {
  not_started:    0,
  data_collection: 25,
  revision:       50,
  final_review:   75,
  certified:      100,
};

const STEP_COLOR: Record<ProductionStep, string> = {
  not_started:    'bg-gray-100 text-gray-600',
  data_collection: 'bg-blue-100 text-blue-700',
  revision:       'bg-amber-100 text-amber-700',
  final_review:   'bg-orange-100 text-orange-700',
  certified:      'bg-emerald-100 text-emerald-700',
};

// ─── Pennylane status config ──────────────────────────────────────────────────

const PENNYLANE_STATUS_LABELS: Record<string, string> = {
  open:                'Ouvert',
  closed:              'Clôturé',
  closing_in_progress: 'Clôture en cours',
};

const PENNYLANE_STATUS_COLOR: Record<string, string> = {
  open:                'bg-sky-100 text-sky-700',
  closed:              'bg-emerald-100 text-emerald-700',
  closing_in_progress: 'bg-amber-100 text-amber-700',
};

// ─── Urgency helpers ──────────────────────────────────────────────────────────

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
}

function urgencyBg(urgency: string): string {
  if (urgency === 'red')    return 'bg-red-50 border-red-200';
  if (urgency === 'orange') return 'bg-amber-50 border-amber-200';
  return 'bg-white border-gray-200';
}

function urgencyBadge(days: number): { label: string; className: string } {
  if (days < 0)  return { label: `Dépassé de ${Math.abs(days)}j`, className: 'bg-red-100 text-red-800' };
  if (days === 0) return { label: "Aujourd'hui", className: 'bg-red-100 text-red-800' };
  if (days <= 15) return { label: `J-${days}`, className: 'bg-red-100 text-red-800' };
  if (days <= 30) return { label: `J-${days}`, className: 'bg-amber-100 text-amber-700' };
  return { label: `J-${days}`, className: 'bg-gray-100 text-gray-600' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function closingMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ─── Alert Banner component ───────────────────────────────────────────────────

function AlertBanner({ sheets }: { sheets: BalanceSheetRecord[] }) {
  const critical = sheets.filter(s => {
    if (s.productionStep === 'certified') return false;
    const d = daysUntil(s.dueDate);
    return d <= 30;
  }).sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));

  if (critical.length === 0) return null;

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {critical.length} bilan{critical.length > 1 ? 's' : ''} avec échéance proche
          </p>
          <div className="mt-2 space-y-1">
            {critical.slice(0, 3).map(s => {
              const d = daysUntil(s.dueDate);
              const badge = urgencyBadge(d);
              return (
                <div key={s.pennylaneId} className="flex items-center gap-2 text-xs text-amber-800">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="font-medium">{s.customerName}</span>
                  <span className="text-amber-600">— dépôt avant le {formatDate(s.dueDate)}</span>
                  {s.assignedManager && (
                    <span className="text-amber-500">· {s.assignedManager}</span>
                  )}
                </div>
              );
            })}
            {critical.length > 3 && (
              <p className="text-xs text-amber-600 mt-1">
                + {critical.length - 3} autre{critical.length - 3 > 1 ? 's' : ''}…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

interface RowProps {
  sheet: BalanceSheetRecord;
  onUpdateStep: (pennylaneId: string, step: ProductionStep) => void;
  onUpdateManager: (pennylaneId: string, manager: string) => void;
}

function BalanceSheetRow({ sheet, onUpdateStep, onUpdateManager }: RowProps) {
  const [editingManager, setEditingManager] = useState(false);
  const [managerInput, setManagerInput] = useState(sheet.assignedManager ?? '');
  const days = daysUntil(sheet.dueDate);
  const badge = urgencyBadge(days);
  const progress = STEP_PROGRESS[sheet.productionStep];

  const handleManagerBlur = () => {
    setEditingManager(false);
    if (managerInput !== (sheet.assignedManager ?? '')) {
      onUpdateManager(sheet.pennylaneId, managerInput);
    }
  };

  return (
    <div className={`border rounded-xl p-4 transition-all ${urgencyBg(sheet.urgencySemantic)}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Client + dates */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{sheet.customerName}</p>
            <Badge className={`text-xs ${PENNYLANE_STATUS_COLOR[sheet.pennylaneStatus] ?? 'bg-gray-100 text-gray-600'}`}>
              {PENNYLANE_STATUS_LABELS[sheet.pennylaneStatus] ?? sheet.pennylaneStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Clôture : {formatDate(sheet.closingDate)}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Dépôt légal : {formatDate(sheet.dueDate)}
            </span>
          </div>
        </div>

        {/* Deadline badge */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Avancement production</span>
          <span className="text-xs font-medium text-gray-700">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-1">
          {PRODUCTION_STEPS.map((step) => (
            <span
              key={step}
              className={`text-[10px] ${sheet.productionStep === step ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
              style={{ width: `${100 / PRODUCTION_STEPS.length}%`, textAlign: 'center' }}
            >
              {step === sheet.productionStep ? '▲' : '·'}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {/* Step selector */}
        <Select
          value={sheet.productionStep}
          onValueChange={(val) => onUpdateStep(sheet.pennylaneId, val as ProductionStep)}
        >
          <SelectTrigger className="h-8 text-xs w-44">
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STEP_COLOR[sheet.productionStep]}`}>
                {STEP_LABELS[sheet.productionStep]}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {PRODUCTION_STEPS.map((step) => (
              <SelectItem key={step} value={step} className="text-xs">
                <span className={`px-1.5 py-0.5 rounded ${STEP_COLOR[step]}`}>
                  {STEP_LABELS[step]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Manager assigné */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {editingManager ? (
            <input
              className="text-xs border border-gray-300 rounded px-2 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={managerInput}
              onChange={e => setManagerInput(e.target.value)}
              onBlur={handleManagerBlur}
              onKeyDown={e => e.key === 'Enter' && handleManagerBlur()}
              autoFocus
              placeholder="Collaborateur…"
            />
          ) : (
            <button
              onClick={() => setEditingManager(true)}
              className="text-xs text-gray-600 hover:text-blue-600 hover:underline truncate"
            >
              {sheet.assignedManager ?? <span className="text-gray-400 italic">Assigner un collaborateur</span>}
            </button>
          )}
        </div>

        {/* Certified indicator */}
        {sheet.productionStep === 'certified' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Certifié
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function BalanceSheetTracker() {
  const navigate = useNavigate();
  const {
    balanceSheets,
    syncingBalanceSheets,
    lastBalanceSheetSync,
    syncBalanceSheetData,
    loadBalanceSheetsFromSupabase,
    updateBalanceSheet,
    getProductionPlanning,
  } = useDashboardStore();

  const [filterManager, setFilterManager] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Load from Supabase on mount. If store is still empty after the DB load
  // (first visit or empty DB), trigger a Pennylane sync.
  useEffect(() => {
    loadBalanceSheetsFromSupabase().then(() => {
      const current = useDashboardStore.getState().balanceSheets;
      if (current.length === 0) {
        syncBalanceSheetData();
      }
    }).catch((err: unknown) => {
      console.error('[BalanceSheetTracker] Failed to load from Supabase:', err);
      syncBalanceSheetData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planning = getProductionPlanning();

  // Build filter options
  const managers = useMemo(() => {
    const set = new Set<string>();
    balanceSheets.forEach(s => { if (s.assignedManager) set.add(s.assignedManager); });
    return Array.from(set).sort();
  }, [balanceSheets]);

  const months = useMemo(() => {
    const set = new Set<string>();
    balanceSheets.forEach(s => set.add(closingMonth(s.closingDate)));
    return Array.from(set);
  }, [balanceSheets]);

  // Filtered list
  const filtered = useMemo(() => {
    return planning.filter(s => {
      if (filterManager !== 'all' && s.assignedManager !== filterManager) return false;
      if (filterMonth !== 'all' && closingMonth(s.closingDate) !== filterMonth) return false;
      return true;
    });
  }, [planning, filterManager, filterMonth]);

  // KPI stats
  const stats = useMemo(() => {
    const total = balanceSheets.length;
    const certified = balanceSheets.filter(s => s.productionStep === 'certified').length;
    const inProgress = balanceSheets.filter(s =>
      s.productionStep !== 'not_started' && s.productionStep !== 'certified'
    ).length;
    const overdue = balanceSheets.filter(s =>
      s.productionStep !== 'certified' && daysUntil(s.dueDate) < 0
    ).length;
    return { total, certified, inProgress, overdue };
  }, [balanceSheets]);

  const handleUpdateStep = (pennylaneId: string, step: ProductionStep) => {
    updateBalanceSheet(pennylaneId, { productionStep: step });
  };

  const handleUpdateManager = (pennylaneId: string, manager: string) => {
    updateBalanceSheet(pennylaneId, { assignedManager: manager });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Retour au tableau de bord"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Suivi des Bilans</h1>
                <p className="text-xs text-gray-500">
                  Planning de production — synchronisé avec Pennylane
                  {lastBalanceSheetSync && (
                    <span className="ml-2 text-gray-400">
                      · Mis à jour {new Date(lastBalanceSheetSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Manual sync button */}
            <button
              onClick={() => syncBalanceSheetData()}
              disabled={syncingBalanceSheets}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              title="Synchroniser avec Pennylane"
            >
              <RefreshCw className={`w-4 h-4 ${syncingBalanceSheets ? 'animate-spin' : ''}`} />
              {syncingBalanceSheets ? 'Actualisation…' : 'Actualiser Pennylane'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 mb-1">Total bilans</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-xs text-gray-500">Certifiés</p>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats.certified}</p>
            {stats.total > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {Math.round((stats.certified / stats.total) * 100)}% terminés
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs text-gray-500">En cours</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
          </div>
          <div className={`rounded-xl border p-5 ${stats.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${stats.overdue > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <p className="text-xs text-gray-500">En retard</p>
            </div>
            <p className={`text-3xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {stats.overdue}
            </p>
          </div>
        </div>

        {/* Avancement global */}
        {stats.total > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Avancement Période Fiscale</p>
              <span className="text-sm font-semibold text-gray-900">
                {stats.certified} / {stats.total} bilans certifiés
              </span>
            </div>
            <Progress value={stats.total > 0 ? Math.round((stats.certified / stats.total) * 100) : 0} className="h-3" />
            <p className="text-xs text-gray-400 mt-2">
              {Math.round((stats.certified / stats.total) * 100)}% de la période fiscale complétée
            </p>
          </div>
        )}

        {/* Deadline alerts */}
        <AlertBanner sheets={balanceSheets} />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <p className="text-sm text-gray-500 font-medium">Filtres :</p>

          <Select value={filterManager} onValueChange={setFilterManager}>
            <SelectTrigger className="h-9 text-sm w-52">
              <SelectValue placeholder="Collaborateur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les collaborateurs</SelectItem>
              {managers.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="h-9 text-sm w-52">
              <SelectValue placeholder="Mois de clôture" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mois</SelectItem>
              {months.map(m => (
                <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterManager !== 'all' || filterMonth !== 'all') && (
            <button
              onClick={() => { setFilterManager('all'); setFilterMonth('all'); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Réinitialiser
            </button>
          )}

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} bilan{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Balance sheet list */}
        {syncingBalanceSheets && balanceSheets.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-500">Synchronisation en cours avec Pennylane…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {balanceSheets.length === 0
                ? 'Aucun bilan synchronisé'
                : 'Aucun bilan pour les filtres sélectionnés'}
            </p>
            {balanceSheets.length === 0 && (
              <button
                onClick={() => syncBalanceSheetData()}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Synchroniser avec Pennylane
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(sheet => (
              <BalanceSheetRow
                key={sheet.pennylaneId}
                sheet={sheet}
                onUpdateStep={handleUpdateStep}
                onUpdateManager={handleUpdateManager}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
