/**
 * HabilitationsFiscales.tsx — Suivi des Habilitations et Dettes Fiscales
 *
 * Module de suivi des mandats EDI/EFI et des dettes fiscales (TVA, IS, CFE).
 * Affiche :
 *   - KPIs : dossiers avec dettes actives, mandats expirant bientôt, dernière sync
 *   - Filtres : recherche par nom, statut du mandat, type de dette
 *   - DataTable consolidé : client, dettes (badges), mandats EDI/EFI, actions
 *   - Gestion batch : sélection multiple pour renouvellement en masse
 *   - Tri automatique : dossiers urgents remontent en haut via useFiscalAlerts
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Shield,
  FileWarning,
  MoreVertical,
  RotateCcw,
  Mail,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';
import { useFiscalAlerts } from '../hooks/useFiscalAlerts';
import { syncFiscalDeadlines } from '../services/dgfipApi';
import type { FiscalTask } from '../types/dashboard';

// ─── Domain types ─────────────────────────────────────────────────────────────

type MandatStatus = 'actif' | 'expiré' | 'bientot_expiré';
type DebtTypeFilter = 'all' | 'TVA' | 'IS' | 'CFE';
type MandatStatusFilter = 'all' | MandatStatus;
type SortField = 'client' | 'TVA' | 'IS' | 'CFE' | 'mandatEDI' | 'mandatEFI';
type SortDir = 'asc' | 'desc';

interface FiscalDebt {
  TVA: number;
  IS: number;
  CFE: number;
}

interface Mandat {
  status: MandatStatus;
  expiresAt: string;
  daysUntilExpiry: number;
}

interface DossierHabilitation {
  id: string;
  clientName: string;
  siren: string;
  fiscalDebts: FiscalDebt;
  mandatEDI: Mandat;
  mandatEFI: Mandat;
}

// ─── Demo data factory ────────────────────────────────────────────────────────

function makeMandatFromExpiry(daysUntilExpiry: number): Mandat {
  const expiresAt = new Date(Date.now() + daysUntilExpiry * 86_400_000).toISOString().split('T')[0];
  const status: MandatStatus =
    daysUntilExpiry < 0 ? 'expiré' : daysUntilExpiry < 30 ? 'bientot_expiré' : 'actif';
  return { status, expiresAt, daysUntilExpiry };
}

const DEMO_DOSSIERS: DossierHabilitation[] = [
  {
    id: '1',
    clientName: 'SARL Martin & Associés',
    siren: '123456789',
    fiscalDebts: { TVA: 4820, IS: 0, CFE: 1200 },
    mandatEDI: makeMandatFromExpiry(-5),
    mandatEFI: makeMandatFromExpiry(120),
  },
  {
    id: '2',
    clientName: 'SAS TechPro Solutions',
    siren: '987654321',
    fiscalDebts: { TVA: 0, IS: 12500, CFE: 0 },
    mandatEDI: makeMandatFromExpiry(22),
    mandatEFI: makeMandatFromExpiry(18),
  },
  {
    id: '3',
    clientName: 'EURL Dupont Conseil',
    siren: '456789123',
    fiscalDebts: { TVA: 0, IS: 0, CFE: 0 },
    mandatEDI: makeMandatFromExpiry(180),
    mandatEFI: makeMandatFromExpiry(200),
  },
  {
    id: '4',
    clientName: 'SCI Les Oliviers',
    siren: '321654987',
    fiscalDebts: { TVA: 890, IS: 3400, CFE: 560 },
    mandatEDI: makeMandatFromExpiry(8),
    mandatEFI: makeMandatFromExpiry(-12),
  },
  {
    id: '5',
    clientName: 'SA Boulangerie Centrale',
    siren: '654987321',
    fiscalDebts: { TVA: 0, IS: 0, CFE: 740 },
    mandatEDI: makeMandatFromExpiry(365),
    mandatEFI: makeMandatFromExpiry(290),
  },
  {
    id: '6',
    clientName: 'SASU Digital Factory',
    siren: '789123456',
    fiscalDebts: { TVA: 6100, IS: 0, CFE: 0 },
    mandatEDI: makeMandatFromExpiry(14),
    mandatEFI: makeMandatFromExpiry(350),
  },
  {
    id: '7',
    clientName: 'GmbH Import Export Euro',
    siren: '159753486',
    fiscalDebts: { TVA: 0, IS: 8200, CFE: 1800 },
    mandatEDI: makeMandatFromExpiry(95),
    mandatEFI: makeMandatFromExpiry(25),
  },
];

// Convert demo dossiers to FiscalTask[] for useFiscalAlerts
function toFiscalTasks(dossiers: DossierHabilitation[]): FiscalTask[] {
  const tasks: FiscalTask[] = [];
  dossiers.forEach(d => {
    if (d.mandatEDI.daysUntilExpiry < 30) {
      tasks.push({
        id: `${d.id}-edi`,
        client_id: d.id,
        client_name: d.clientName,
        task_type: 'OTHER',
        due_date: d.mandatEDI.expiresAt,
        status: d.mandatEDI.status === 'expiré' ? 'declared' : 'preparation',
        urgency_semantic: getUrgencySemantic(d.mandatEDI.daysUntilExpiry),
        updated_at: new Date().toISOString(),
        is_dgfip_certified: d.mandatEDI.status === 'expiré',
        mismatch_alert: d.mandatEDI.status === 'expiré',
      });
    }
  });
  return tasks;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasActiveDette(d: DossierHabilitation): boolean {
  return d.fiscalDebts.TVA > 0 || d.fiscalDebts.IS > 0 || d.fiscalDebts.CFE > 0;
}

function hasCriticalMandat(d: DossierHabilitation): boolean {
  return (
    d.mandatEDI.status === 'expiré' ||
    d.mandatEFI.status === 'expiré' ||
    d.mandatEDI.status === 'bientot_expiré' ||
    d.mandatEFI.status === 'bientot_expiré'
  );
}

/** Computes a priority score for sorting — higher = more urgent */
function priorityScore(d: DossierHabilitation): number {
  let score = 0;
  if (d.mandatEDI.status === 'expiré' || d.mandatEFI.status === 'expiré') score += 1000;
  if (d.mandatEDI.status === 'bientot_expiré' || d.mandatEFI.status === 'bientot_expiré') score += 500;
  if (hasActiveDette(d)) score += 300;
  score -= Math.min(d.mandatEDI.daysUntilExpiry, d.mandatEFI.daysUntilExpiry);
  return score;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getUrgencySemantic(daysUntilExpiry: number): 'red' | 'orange' | 'green' {
  if (daysUntilExpiry < 0) return 'red';
  if (daysUntilExpiry < 30) return 'orange';
  return 'green';
}

function DebtBadge({ label, amount }: { label: string; amount: number }) {
  if (amount > 0) {
    return (
      <Badge className="bg-red-100 text-red-700 border border-red-200 font-medium text-xs">
        {label} {formatAmount(amount)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium text-xs">
      {label} ✓
    </Badge>
  );
}

function MandatBadge({ mandat }: { mandat: Mandat }) {
  if (mandat.status === 'expiré') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs font-medium">
          Expiré
        </Badge>
        <span className="text-[10px] text-red-500">{formatDate(mandat.expiresAt)}</span>
      </div>
    );
  }
  if (mandat.status === 'bientot_expiré') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge className="bg-orange-100 text-orange-700 border border-orange-200 text-xs font-medium">
          J-{mandat.daysUntilExpiry}
        </Badge>
        <span className="text-[10px] text-orange-500">{formatDate(mandat.expiresAt)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium">
        Actif
      </Badge>
      <span className="text-[10px] text-slate-400">{formatDate(mandat.expiresAt)}</span>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32 bg-slate-700" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 bg-slate-700 mb-1" />
        <Skeleton className="h-3 w-24 bg-slate-700" />
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-700">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full bg-slate-700" />
        </td>
      ))}
    </tr>
  );
}

// ─── Sort header helper ───────────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200 transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HabilitationsFiscales() {
  const navigate = useNavigate();

  // ── State ───────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [fiscalTasks, setFiscalTasks] = useState<FiscalTask[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [mandatFilter, setMandatFilter] = useState<MandatStatusFilter>('all');
  const [debtFilter, setDebtFilter] = useState<DebtTypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('client');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [userHasSorted, setUserHasSorted] = useState(false);

  // ── Initial load (simulate API call) ────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const result = await syncFiscalDeadlines();
        setSyncedAt(result.synced_at);
        setFiscalTasks(result.tasks.length > 0 ? result.tasks : toFiscalTasks(DEMO_DOSSIERS));
      } catch {
        setSyncedAt(new Date().toISOString());
        setFiscalTasks(toFiscalTasks(DEMO_DOSSIERS));
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, []);

  // ── Sync handler ─────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncFiscalDeadlines();
      setSyncedAt(result.synced_at);
      if (result.tasks.length > 0) setFiscalTasks(result.tasks);
      toast.success('Synchronisation DGFiP réussie', { description: formatSyncTime(result.synced_at) });
    } catch {
      toast.error('Erreur de synchronisation DGFiP');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // ── Use fiscal alerts hook to surface urgent tasks ───────────────────────
  // Use a large threshold so we get all tasks in the alert list for sorting
  const fiscalAlerts = useFiscalAlerts(fiscalTasks, 365);

  // Build an urgency map: client_id -> alert priority
  const urgencyMap = useMemo(() => {
    const map = new Map<string, number>();
    fiscalAlerts.forEach(alert => {
      const existing = map.get(alert.task.client_id) ?? 0;
      const score = alert.priority === 'high' ? 1000 - alert.daysLeft : 500 - alert.daysLeft;
      map.set(alert.task.client_id, Math.max(existing, score));
    });
    return map;
  }, [fiscalAlerts]);

  // ── KPI computations ─────────────────────────────────────────────────────
  const kpiDettesActives = useMemo(
    () => DEMO_DOSSIERS.filter(d => hasActiveDette(d)).length,
    [],
  );

  const kpiMandatsUrgents = useMemo(
    () =>
      DEMO_DOSSIERS.filter(
        d =>
          d.mandatEDI.status === 'expiré' ||
          d.mandatEFI.status === 'expiré' ||
          d.mandatEDI.status === 'bientot_expiré' ||
          d.mandatEFI.status === 'bientot_expiré',
      ).length,
    [],
  );

  // ── Filtered + sorted dossiers ───────────────────────────────────────────
  const filteredDossiers = useMemo(() => {
    let result = [...DEMO_DOSSIERS];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        d => d.clientName.toLowerCase().includes(q) || d.siren.includes(q),
      );
    }

    // Mandat status filter
    if (mandatFilter !== 'all') {
      result = result.filter(
        d => d.mandatEDI.status === mandatFilter || d.mandatEFI.status === mandatFilter,
      );
    }

    // Debt type filter
    if (debtFilter !== 'all') {
      result = result.filter(d => d.fiscalDebts[debtFilter] > 0);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'client':
          aVal = a.clientName;
          bVal = b.clientName;
          break;
        case 'TVA':
          aVal = a.fiscalDebts.TVA;
          bVal = b.fiscalDebts.TVA;
          break;
        case 'IS':
          aVal = a.fiscalDebts.IS;
          bVal = b.fiscalDebts.IS;
          break;
        case 'CFE':
          aVal = a.fiscalDebts.CFE;
          bVal = b.fiscalDebts.CFE;
          break;
        case 'mandatEDI':
          aVal = a.mandatEDI.daysUntilExpiry;
          bVal = b.mandatEDI.daysUntilExpiry;
          break;
        case 'mandatEFI':
          aVal = a.mandatEFI.daysUntilExpiry;
          bVal = b.mandatEFI.daysUntilExpiry;
          break;
      }

      const dir = sortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal, 'fr') * dir;
      }
      return ((aVal as number) - (bVal as number)) * dir;
    });

    // When no explicit user sort, apply fiscal-alerts-based priority sort
    if (!userHasSorted) {
      result.sort((a, b) => {
        const pa = urgencyMap.get(a.id) ?? priorityScore(a);
        const pb = urgencyMap.get(b.id) ?? priorityScore(b);
        return pb - pa;
      });
    }

    return result;
  }, [searchQuery, mandatFilter, debtFilter, sortField, sortDir, urgencyMap, userHasSorted]);

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === filteredDossiers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredDossiers.map(d => d.id)));
    }
  }, [selected.size, filteredDossiers]);

  // ── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = useCallback((field: SortField) => {
    setUserHasSorted(true);
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  // ── Row actions ───────────────────────────────────────────────────────────
  const handleRenewMandat = useCallback((dossier: DossierHabilitation) => {
    toast.success(`Renouvellement initié`, {
      description: `Mandat pour ${dossier.clientName} envoyé à la DGFIP.`,
    });
  }, []);

  const handleSendRelance = useCallback((dossier: DossierHabilitation) => {
    toast.info(`Relance envoyée`, {
      description: `Email de relance envoyé à ${dossier.clientName}.`,
    });
  }, []);

  // ── Bulk renewal ─────────────────────────────────────────────────────────
  const handleBulkRenew = useCallback(() => {
    if (selected.size === 0) {
      toast.error('Sélectionnez au moins un dossier.');
      return;
    }
    toast.success(`${selected.size} renouvellement(s) initié(s)`, {
      description: 'Les mandats sélectionnés ont été envoyés à la DGFIP.',
    });
    setSelected(new Set());
  }, [selected]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">
                Habilitations &amp; Dettes Fiscales
              </h1>
              <p className="text-slate-400 text-xs">
                Suivi des mandats EDI/EFI et dettes TVA · IS · CFE
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Synchronisation…' : 'Sync DGFiP'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            {/* KPI 1: Dossiers avec dettes actives */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-300">
                  Dossiers avec dettes actives
                </CardTitle>
                <FileWarning className={`w-4 h-4 ${kpiDettesActives > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${kpiDettesActives > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {kpiDettesActives}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {kpiDettesActives > 0
                    ? `${kpiDettesActives} dossier(s) nécessitent une action`
                    : 'Aucune dette fiscale en cours'}
                </p>
              </CardContent>
            </Card>

            {/* KPI 2: Mandats expirés ou à renouveler < 30j */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-300">
                  Mandats EDI/EFI urgents
                </CardTitle>
                <AlertTriangle className={`w-4 h-4 ${kpiMandatsUrgents > 0 ? 'text-orange-400' : 'text-emerald-400'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${kpiMandatsUrgents > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {kpiMandatsUrgents}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {kpiMandatsUrgents > 0
                    ? 'Expirés ou expirant dans moins de 30 jours'
                    : 'Tous les mandats sont à jour'}
                </p>
              </CardContent>
            </Card>

            {/* KPI 3: Dernière synchronisation */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-300">
                  Dernière synchronisation
                </CardTitle>
                <Clock className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-base font-semibold text-blue-300">
                  {syncedAt ? formatSyncTime(syncedAt) : '—'}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  API DGFiP / jedeclare.com
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou SIREN…"
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
          />
        </div>

        <Select value={mandatFilter} onValueChange={v => setMandatFilter(v as MandatStatusFilter)}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-slate-200">
            <SelectValue placeholder="Statut du mandat" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200">Tous les statuts</SelectItem>
            <SelectItem value="actif" className="text-emerald-400">Actif</SelectItem>
            <SelectItem value="expiré" className="text-red-400">Expiré</SelectItem>
            <SelectItem value="bientot_expiré" className="text-orange-400">Bientôt expiré</SelectItem>
          </SelectContent>
        </Select>

        <Select value={debtFilter} onValueChange={v => setDebtFilter(v as DebtTypeFilter)}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-200">
            <SelectValue placeholder="Type de dette" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200">Tous types</SelectItem>
            <SelectItem value="TVA" className="text-slate-200">TVA</SelectItem>
            <SelectItem value="IS" className="text-slate-200">IS</SelectItem>
            <SelectItem value="CFE" className="text-slate-200">CFE</SelectItem>
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <Button
            onClick={handleBulkRenew}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Renouveler {selected.size} mandat(s)
          </Button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-500 mb-2">
        {filteredDossiers.length} dossier(s) affiché(s)
        {selected.size > 0 && ` · ${selected.size} sélectionné(s)`}
      </p>

      {/* Data Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/60 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <Checkbox
                    checked={
                      filteredDossiers.length > 0 &&
                      selected.size === filteredDossiers.length
                    }
                    onCheckedChange={toggleAll}
                    className="border-slate-600"
                    aria-label="Sélectionner tout"
                  />
                </th>
                <SortableHeader
                  label="Client"
                  field="client"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Dettes Fiscales
                </th>
                <SortableHeader
                  label="Mandat EDI"
                  field="mandatEDI"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Mandat EFI"
                  field="mandatEFI"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Statut global
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : filteredDossiers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    Aucun dossier ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredDossiers.map(dossier => {
                  const isSelected = selected.has(dossier.id);
                  const hasDebt = hasActiveDette(dossier);
                  const hasCritical = hasCriticalMandat(dossier);

                  return (
                    <tr
                      key={dossier.id}
                      className={`border-b border-slate-700/60 transition-colors ${
                        isSelected
                          ? 'bg-blue-900/20'
                          : hasCritical || hasDebt
                          ? 'bg-red-900/5 hover:bg-slate-700/30'
                          : 'hover:bg-slate-700/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(dossier.id)}
                          className="border-slate-600"
                          aria-label={`Sélectionner ${dossier.clientName}`}
                        />
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100 text-sm">{dossier.clientName}</div>
                        <div className="text-xs text-slate-500">SIREN {dossier.siren}</div>
                      </td>

                      {/* Dettes Fiscales */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <DebtBadge label="TVA" amount={dossier.fiscalDebts.TVA} />
                          <DebtBadge label="IS" amount={dossier.fiscalDebts.IS} />
                          <DebtBadge label="CFE" amount={dossier.fiscalDebts.CFE} />
                        </div>
                      </td>

                      {/* Mandat EDI */}
                      <td className="px-4 py-3">
                        <MandatBadge mandat={dossier.mandatEDI} />
                      </td>

                      {/* Mandat EFI */}
                      <td className="px-4 py-3">
                        <MandatBadge mandat={dossier.mandatEFI} />
                      </td>

                      {/* Global status */}
                      <td className="px-4 py-3">
                        {hasCritical || hasDebt ? (
                          <Badge className="bg-red-900/40 text-red-300 border border-red-700 text-xs">
                            Action requise
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-700 text-xs">
                            À jour
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                              aria-label="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-slate-800 border-slate-700 text-slate-200"
                          >
                            <DropdownMenuItem
                              onClick={() => handleRenewMandat(dossier)}
                              className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2"
                            >
                              <RotateCcw className="w-4 h-4 text-blue-400" />
                              Renouveler le mandat
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSendRelance(dossier)}
                              className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2"
                            >
                              <Mail className="w-4 h-4 text-amber-400" />
                              Envoyer relance client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
