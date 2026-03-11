import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  RefreshCcw,
  CloudOff,
  CloudLightning,
  Cloud,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { FiscalTask, FiscalTaskStatus, FiscalTaskType, SyncStatus } from '../types/dashboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { useFiscalAlerts } from '../hooks/useFiscalAlerts';
import { requestTaxCertificate } from '../services/dgfipApi';
import { toast } from 'sonner';

// ─── Task-type columns ────────────────────────────────────────────────────────

const TASK_TYPES: FiscalTaskType[] = [
  'TVA_CA3',
  'TVA_CA12',
  'IS_Solde',
  'IS_Acompte',
  'CVAE',
  'CFE',
  'DSN',
  'LIASSE_FISCALE',
  'BILAN',
  'DAS2',
  'PAIE',
];

const TASK_TYPE_LABELS: Record<FiscalTaskType, string> = {
  TVA_CA3:        'TVA CA3',
  TVA_CA12:       'TVA CA12',
  IS_Solde:       'IS Solde',
  IS_Acompte:     'IS Acompte',
  CVAE:           'CVAE',
  CFE:            'CFE',
  DSN:            'DSN',
  LIASSE_FISCALE: 'Liasse',
  BILAN:          'Bilan',
  DAS2:           'DAS2',
  PAIE:           'Paie',
  OTHER:          'Autre',
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FiscalTaskStatus, { label: string; short: string }> = {
  preparation:  { label: 'À préparer',   short: 'Prép.' },
  waiting_docs: { label: 'Attente docs', short: 'Docs'  },
  ready:        { label: 'Prêt',         short: 'Prêt'  },
  declared:     { label: 'Déclaré',      short: '✓'     },
};

const STATUS_NEXT: Partial<Record<FiscalTaskStatus, FiscalTaskStatus>> = {
  preparation:  'waiting_docs',
  waiting_docs: 'ready',
  ready:        'declared',
};

// ─── Urgency helpers ──────────────────────────────────────────────────────────

function daysLeft(dueDateIso: string): number {
  return Math.ceil((new Date(dueDateIso).getTime() - Date.now()) / 86_400_000);
}

/** Consistent countdown label used in both the alert banner and matrix cells. */
function formatDaysLeft(dl: number): string {
  if (dl > 0)  return `J-${dl}`;
  if (dl === 0) return 'Auj.';
  return `J+${Math.abs(dl)}`;
}

function cellBg(task: FiscalTask): string {
  if (task.status === 'declared') return 'bg-gray-50';
  const d = daysLeft(task.due_date);
  if (d <= 7)  return 'bg-red-50';
  if (d <= 21) return 'bg-amber-50';
  return 'bg-emerald-50';
}

function badgeClasses(task: FiscalTask): string {
  if (task.status === 'declared')
    return 'border border-gray-200 bg-white text-gray-500';
  const d = daysLeft(task.due_date);
  if (d <= 7)  return 'border border-red-200 bg-red-100 text-red-800';
  if (d <= 21) return 'border border-amber-200 bg-amber-100 text-amber-800';
  return 'border border-emerald-200 bg-emerald-100 text-emerald-800';
}

// ─── Sync icon ────────────────────────────────────────────────────────────────

const SYNC_ICONS: Record<SyncStatus, React.ReactNode> = {
  synced:       <Cloud         className="w-2.5 h-2.5 text-blue-400"  aria-label="Synchronisé" />,
  pending_push: <CloudLightning className="w-2.5 h-2.5 text-amber-400" aria-label="En attente d'envoi" />,
  pending_pull: <RefreshCcw   className="w-2.5 h-2.5 text-amber-400"  aria-label="En attente de réception" />,
  conflict:     <CloudOff     className="w-2.5 h-2.5 text-red-500"    aria-label="Conflit de synchronisation" />,
  error:        <CloudOff     className="w-2.5 h-2.5 text-red-500"    aria-label="Erreur de synchronisation" />,
};

// ─── Demo data ────────────────────────────────────────────────────────────────

function buildDemoTasks(): FiscalTask[] {
  const now = new Date();
  const d = (offset: number) =>
    new Date(now.getTime() + offset * 86_400_000).toISOString();
  const iso = now.toISOString();

  return [
    // SARL Dupont & Fils
    { id: 'd01', client_id: 'c1', client_name: 'SARL Dupont & Fils',   task_type: 'TVA_CA3',        due_date: d(5),  status: 'preparation',  urgency_semantic: 'red',    updated_at: iso, sync: { source: 'impots_gouv', sync_status: 'synced',        last_synced_at: iso }, is_dgfip_certified: true,  mismatch_alert: false },
    { id: 'd02', client_id: 'c1', client_name: 'SARL Dupont & Fils',   task_type: 'CFE',            due_date: d(5),  status: 'waiting_docs', urgency_semantic: 'red',    updated_at: iso, sync: { source: 'pennylane',   sync_status: 'pending_push',  last_synced_at: iso }, is_dgfip_certified: false, mismatch_alert: true,  tax_compliance_certificate_url: '#demo-attestation-c1' },
    { id: 'd03', client_id: 'c1', client_name: 'SARL Dupont & Fils',   task_type: 'DSN',            due_date: d(3),  status: 'preparation',  urgency_semantic: 'red',    updated_at: iso },
    // SAS Technova
    { id: 'd04', client_id: 'c2', client_name: 'SAS Technova',         task_type: 'IS_Acompte',     due_date: d(14), status: 'waiting_docs', urgency_semantic: 'orange', updated_at: iso, sync: { source: 'pennylane',   sync_status: 'synced',        last_synced_at: iso }, is_dgfip_certified: true,  mismatch_alert: false },
    { id: 'd05', client_id: 'c2', client_name: 'SAS Technova',         task_type: 'TVA_CA3',        due_date: d(14), status: 'ready',        urgency_semantic: 'orange', updated_at: iso },
    { id: 'd06', client_id: 'c2', client_name: 'SAS Technova',         task_type: 'PAIE',           due_date: d(6),  status: 'declared',     urgency_semantic: 'red',    updated_at: iso, sync: { source: 'pennylane',   sync_status: 'synced',        last_synced_at: iso }, is_dgfip_certified: true },
    // EURL Martin Conseil
    { id: 'd07', client_id: 'c3', client_name: 'EURL Martin Conseil',  task_type: 'DSN',            due_date: d(14), status: 'waiting_docs', urgency_semantic: 'orange', updated_at: iso },
    { id: 'd08', client_id: 'c3', client_name: 'EURL Martin Conseil',  task_type: 'TVA_CA12',       due_date: d(45), status: 'preparation',  urgency_semantic: 'green',  updated_at: iso },
    // SA Bâtiment Pro
    { id: 'd09', client_id: 'c4', client_name: 'SA Bâtiment Pro',      task_type: 'LIASSE_FISCALE', due_date: d(30), status: 'ready',        urgency_semantic: 'green',  updated_at: iso, sync: { source: 'impots_gouv', sync_status: 'conflict',      last_synced_at: iso }, mismatch_alert: true },
    { id: 'd10', client_id: 'c4', client_name: 'SA Bâtiment Pro',      task_type: 'IS_Solde',       due_date: d(30), status: 'preparation',  urgency_semantic: 'green',  updated_at: iso },
    { id: 'd11', client_id: 'c4', client_name: 'SA Bâtiment Pro',      task_type: 'BILAN',          due_date: d(35), status: 'preparation',  urgency_semantic: 'green',  updated_at: iso },
    // SASU WebAgency
    { id: 'd12', client_id: 'c5', client_name: 'SASU WebAgency',       task_type: 'TVA_CA3',        due_date: d(60), status: 'declared',     urgency_semantic: 'green',  updated_at: iso, is_dgfip_certified: true, tax_compliance_certificate_url: '#demo-attestation-c5' },
    { id: 'd13', client_id: 'c5', client_name: 'SASU WebAgency',       task_type: 'PAIE',           due_date: d(7),  status: 'ready',        urgency_semantic: 'red',    updated_at: iso },
    { id: 'd14', client_id: 'c5', client_name: 'SASU WebAgency',       task_type: 'DAS2',           due_date: d(20), status: 'waiting_docs', urgency_semantic: 'orange', updated_at: iso },
    // SC Immobilière Sud
    { id: 'd15', client_id: 'c6', client_name: 'SC Immobilière Sud',   task_type: 'BILAN',          due_date: d(25), status: 'ready',        urgency_semantic: 'green',  updated_at: iso },
    { id: 'd16', client_id: 'c6', client_name: 'SC Immobilière Sud',   task_type: 'CFE',            due_date: d(4),  status: 'preparation',  urgency_semantic: 'red',    updated_at: iso },
    // SCI Les Oliviers
    { id: 'd17', client_id: 'c7', client_name: 'SCI Les Oliviers',     task_type: 'LIASSE_FISCALE', due_date: d(15), status: 'waiting_docs', urgency_semantic: 'orange', updated_at: iso },
    { id: 'd18', client_id: 'c7', client_name: 'SCI Les Oliviers',     task_type: 'IS_Acompte',     due_date: d(20), status: 'preparation',  urgency_semantic: 'orange', updated_at: iso },
    // AE Moreau Consulting
    { id: 'd19', client_id: 'c8', client_name: 'AE Moreau Consulting', task_type: 'TVA_CA3',        due_date: d(7),  status: 'ready',        urgency_semantic: 'red',    updated_at: iso, sync: { source: 'pennylane',   sync_status: 'pending_pull',  last_synced_at: iso }, is_dgfip_certified: true,  mismatch_alert: false },
    { id: 'd20', client_id: 'c8', client_name: 'AE Moreau Consulting', task_type: 'CVAE',           due_date: d(7),  status: 'preparation',  urgency_semantic: 'red',    updated_at: iso },
  ];
}

// ─── J-7 Alert banner ────────────────────────────────────────────────────────

function AlertBanner({
  tasks,
  onMove,
}: {
  tasks: FiscalTask[];
  onMove: (taskId: string, newStatus: FiscalTaskStatus) => void;
}) {
  const alerts = useFiscalAlerts(tasks, 7);
  const [dismissed, setDismissed] = useState(false);

  if (alerts.length === 0 || dismissed) return null;

  return (
    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {alerts.length} échéance{alerts.length > 1 ? 's' : ''} à J-7 ou moins
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          aria-label="Masquer les alertes"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {alerts.map(({ task, daysLeft: dl }) => {
          const next = STATUS_NEXT[task.status];
          return (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white border border-red-100 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {dl <= 0
                  ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  : <Clock         className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                }
                <span className="text-xs font-medium text-gray-800 truncate">
                  {task.client_name}
                </span>
                <Badge className="bg-red-100 text-red-700 border-red-200 border text-[10px] px-1.5 py-0 h-4">
                  {TASK_TYPE_LABELS[task.task_type]}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] font-mono font-bold text-red-600">
                  {formatDaysLeft(dl)}
                </span>
                {next && (
                  <button
                    onClick={() => onMove(task.id, next)}
                    className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800 transition-colors font-medium"
                  >
                    {STATUS_CONFIG[next].label}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                {!next && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Matrix cell ──────────────────────────────────────────────────────────────

function MatrixCell({
  task,
  onMove,
}: {
  task: FiscalTask | undefined;
  onMove: (taskId: string, newStatus: FiscalTaskStatus) => void;
}) {
  if (!task) {
    return (
      <TableCell className="text-center p-1.5 border border-gray-100">
        <span className="text-gray-200 text-xs select-none">—</span>
      </TableCell>
    );
  }

  const dl = daysLeft(task.due_date);
  const next = STATUS_NEXT[task.status];

  // Mismatch alert: pulsing red border overrides normal background
  const cellClass = task.mismatch_alert
    ? `text-center p-1.5 border-2 border-red-500 animate-pulse ${cellBg(task)}`
    : `text-center p-1.5 border border-gray-100 ${cellBg(task)}`;

  return (
    <TableCell className={cellClass}>
      <div className="flex flex-col items-center gap-0.5">
        {/* DGFIP certification badge */}
        {task.is_dgfip_certified && (
          <span title="Donnée certifiée DGFIP">
            <ShieldCheck className="w-3 h-3 text-blue-500" aria-label="Donnée certifiée DGFIP" />
          </span>
        )}

        {/* Mismatch alert tooltip indicator */}
        {task.mismatch_alert && (
          <span
            title="Discordance détectée — données comptables ≠ DGFIP"
            className="text-[9px] font-bold text-red-600 leading-none"
          >
            ⚠
          </span>
        )}

        {/* Status badge */}
        <span
          className={`inline-block text-[10px] font-semibold rounded px-1.5 py-0.5 leading-tight ${badgeClasses(task)}`}
        >
          {STATUS_CONFIG[task.status].short}
        </span>

        {/* Days countdown */}
        {task.status !== 'declared' && (
          <span className="text-[9px] font-mono leading-none opacity-70 text-gray-600">
            {formatDaysLeft(dl)}
          </span>
        )}

        {/* Advance button */}
        {next && (
          <button
            onClick={() => onMove(task.id, next)}
            className="text-[9px] text-blue-500 hover:text-blue-700 transition-colors leading-none mt-0.5"
            title={`→ ${STATUS_CONFIG[next].label}`}
            aria-label={`Avancer vers ${STATUS_CONFIG[next].label}`}
          >
            →
          </button>
        )}

        {/* Sync indicator */}
        {task.sync && (
          <span title={`Sync ${task.sync.source} · ${task.sync.sync_status}`}>
            {SYNC_ICONS[task.sync.sync_status]}
          </span>
        )}
      </div>
    </TableCell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Simple CSV/Excel export — downloads tasks as a .csv file */
function exportToExcel(tasks: FiscalTask[]): void {
  const header = ['Client', 'Type', 'Échéance', 'Statut', 'Urgence', 'DGFIP certifié', 'Discordance'];
  const rows = tasks.map(t => [
    t.client_name,
    t.task_type,
    t.due_date.slice(0, 10),
    t.status,
    t.urgency_semantic,
    t.is_dgfip_certified ? 'Oui' : 'Non',
    t.mismatch_alert ? 'Oui' : 'Non',
  ]);
  const csv = [header, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `echeancier-fiscal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Simple PDF export — opens a print-ready page with the fiscal schedule */
function exportToPdf(tasks: FiscalTask[]): void {
  const rows = tasks
    .map(t =>
      `<tr>
        <td>${t.client_name}</td>
        <td>${t.task_type}</td>
        <td>${t.due_date.slice(0, 10)}</td>
        <td>${t.status}</td>
        <td>${t.is_dgfip_certified ? '✓' : '—'}</td>
        <td>${t.mismatch_alert ? '⚠' : '—'}</td>
      </tr>`,
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Échéancier fiscal</title>
    <style>body{font-family:sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f3f4f6}</style></head>
    <body><h2>Échéancier fiscal DGFIP — ${new Date().toLocaleDateString('fr-FR')}</h2>
    <table><thead><tr><th>Client</th><th>Type</th><th>Échéance</th><th>Statut</th>
    <th>Certifié DGFIP</th><th>Discordance</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export function FiscalCalendar() {
  const navigate = useNavigate();
  const {
    fiscalTasks,
    loadingFiscalTasks,
    fetchFiscalTasks,
    updateFiscalTaskStatus,
    refreshUrgencies,
  } = useDashboardStore();

  const [downloadingCert, setDownloadingCert] = useState<string | null>(null);

  const displayTasks: FiscalTask[] =
    fiscalTasks.length > 0 ? fiscalTasks : buildDemoTasks();

  // Fetch on mount
  useEffect(() => {
    fetchFiscalTasks().catch(() => {/* demo mode */});
  }, [fetchFiscalTasks]);

  // Refresh urgency indicators every minute (tab-visible only)
  useEffect(() => {
    const tick = () => { if (!document.hidden) refreshUrgencies(); };
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [refreshUrgencies]);

  /** Download attestation for a given client — calls DGFIP service */
  const handleDownloadAttestation = useCallback(async (clientId: string, clientName: string) => {
    setDownloadingCert(clientId);
    try {
      const result = await requestTaxCertificate(clientId);
      if (result.certificate_url.startsWith('#demo')) {
        toast.info(`Attestation ${clientName} : mode démonstration (URL factice).`);
      } else {
        window.open(result.certificate_url, '_blank');
        toast.success(`Attestation de régularité fiscale téléchargée pour ${clientName}`);
      }
    } catch {
      toast.error(`Impossible de télécharger l'attestation pour ${clientName}`);
    } finally {
      setDownloadingCert(null);
    }
  }, []);

  // Build matrix: clientId → { taskType → task }
  const clientOrder: string[] = [];
  const clientNames: Record<string, string> = {};
  const matrix: Record<string, Partial<Record<FiscalTaskType, FiscalTask>>> = {};

  for (const task of displayTasks) {
    const key = task.client_id;
    if (!matrix[key]) {
      clientOrder.push(key);
      clientNames[key] = task.client_name;
      matrix[key] = {};
    }
    // Keep the most urgent (nearest) task if duplicates exist for same type
    const existing = matrix[key][task.task_type];
    if (!existing || daysLeft(task.due_date) < daysLeft(existing.due_date)) {
      matrix[key][task.task_type] = task;
    }
  }

  // Flag columns that contain at least one J-7 alert
  const columnHasAlert: Partial<Record<FiscalTaskType, boolean>> = {};
  for (const type of TASK_TYPES) {
    columnHasAlert[type] = clientOrder.some(cid => {
      const t = matrix[cid]?.[type];
      return t && t.status !== 'declared' && daysLeft(t.due_date) <= 7;
    });
  }

  /** Whether a client has at least one task with a compliance certificate */
  const clientHasCert = (clientId: string): boolean =>
    Object.values(matrix[clientId] ?? {}).some(
      t => t?.tax_compliance_certificate_url || t?.is_dgfip_certified,
    );

  return (
    <div className="p-6 min-h-screen bg-gray-50/40">
      {/* Back navigation */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Module Suivi des échéances fiscales — Intégration DGFIP
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vue matricielle — obligations par client × échéance déclarative
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* DGFIP legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-500" />
              <span>Certifié DGFIP</span>
            </div>
            <div className="flex items-center gap-1 text-red-600 font-semibold">
              <span>⚠</span>
              <span>Discordance</span>
            </div>
          </div>

          {/* Urgency legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              {'> 21 j'}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              {'7–21 j'}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              {'≤ 7 j'}
            </div>
          </div>

          {/* Sync legend */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Cloud className="w-3 h-3 text-blue-400" /><span>Sync OK</span>
            <CloudLightning className="w-3 h-3 text-amber-400" /><span>En attente</span>
            <CloudOff className="w-3 h-3 text-red-400" /><span>Conflit</span>
          </div>

          {/* Export buttons */}
          <button
            onClick={() => exportToExcel(displayTasks)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
            title="Exporter l'échéancier en Excel (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>

          <button
            onClick={() => exportToPdf(displayTasks)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            title="Exporter l'échéancier en PDF"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>

          <button
            onClick={() => fetchFiscalTasks()}
            disabled={loadingFiscalTasks}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loadingFiscalTasks ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* J-7 alert banner */}
      <AlertBanner tasks={displayTasks} onMove={updateFiscalTaskStatus} />

      {/* Matrix table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="border-collapse text-xs">
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                {/* Sticky client-name header */}
                <TableHead className="sticky left-0 z-20 bg-gray-50 border border-gray-200 min-w-52 max-w-64 font-semibold text-gray-700 text-xs">
                  Client
                </TableHead>

                {/* Task-type headers */}
                {TASK_TYPES.map(type => (
                  <TableHead
                    key={type}
                    className={`border border-gray-200 text-center font-semibold text-[11px] px-2 min-w-16
                      ${columnHasAlert[type] ? 'text-red-600' : 'text-gray-600'}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      {columnHasAlert[type] && (
                        <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                      )}
                      {TASK_TYPE_LABELS[type]}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {clientOrder.map((clientId, rowIdx) => (
                <TableRow
                  key={clientId}
                  className={
                    rowIdx % 2 === 0
                      ? 'bg-white hover:bg-gray-50/60'
                      : 'bg-gray-50/30 hover:bg-gray-50/60'
                  }
                >
                  {/* Sticky client name + attestation button */}
                  <TableCell
                    className="sticky left-0 z-10 border border-gray-200 text-xs px-3 py-2 min-w-52 max-w-64"
                    style={{ background: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb' }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-gray-800 truncate" title={clientNames[clientId]}>
                        {clientNames[clientId]}
                      </span>
                      {/* Attestation download button — shown when client has DGFIP data */}
                      {clientHasCert(clientId) && (
                        <button
                          onClick={() => handleDownloadAttestation(clientId, clientNames[clientId])}
                          disabled={downloadingCert === clientId}
                          title="Télécharger l'attestation de régularité fiscale"
                          className="flex-shrink-0 flex items-center gap-0.5 text-[9px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-1 py-0.5 transition-colors disabled:opacity-60"
                          aria-label="Télécharger Attestation de Régularité"
                        >
                          <Download className="w-2.5 h-2.5" />
                          Attestation
                        </button>
                      )}
                    </div>
                  </TableCell>

                  {/* One cell per task type */}
                  {TASK_TYPES.map(type => (
                    <MatrixCell
                      key={type}
                      task={matrix[clientId]?.[type]}
                      onMove={updateFiscalTaskStatus}
                    />
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Status summary */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {(
          [
            ['preparation',  'Prép.',  'bg-gray-300'],
            ['waiting_docs', 'Docs',   'bg-blue-300'],
            ['ready',        'Prêt',   'bg-emerald-300'],
            ['declared',     'Déclaré','bg-emerald-500'],
          ] as const
        ).map(([status, label, color]) => {
          const count = displayTasks.filter(t => t.status === status).length;
          return (
            <div
              key={status}
              className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-1"
            >
              <span className={`w-2 h-2 rounded-sm ${color}`} />
              <span className="font-medium">{label}</span>
              <span className="text-gray-400">{count}</span>
            </div>
          );
        })}
      </div>

      {fiscalTasks.length === 0 && (
        <p className="text-xs text-center text-gray-400 mt-4">
          Mode démonstration — configurez le webhook n8n pour charger vos données réelles.
        </p>
      )}
    </div>
  );
}
