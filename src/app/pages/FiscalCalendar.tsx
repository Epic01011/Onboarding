import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { FiscalTask, FiscalTaskStatus } from '../types/dashboard';

// ─── Column config ────────────────────────────────────────────────────────────

interface KanbanColumn {
  id: FiscalTaskStatus;
  label: string;
  emptyLabel: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'preparation',  label: 'À préparer',              emptyLabel: 'Aucune tâche à préparer' },
  { id: 'waiting_docs', label: 'En attente de documents', emptyLabel: 'Aucune tâche en attente' },
  { id: 'ready',        label: 'Prêt pour envoi',         emptyLabel: 'Aucune tâche prête' },
  { id: 'declared',     label: 'Déclaré',                  emptyLabel: 'Aucune tâche déclarée' },
];

const URGENCY_BORDER: Record<FiscalTask['urgency_semantic'], string> = {
  green:  'border-l-4 border-green-500',
  orange: 'border-l-4 border-orange-500',
  red:    'border-l-4 border-red-500',
};

const URGENCY_DOT: Record<FiscalTask['urgency_semantic'], string> = {
  green:  'bg-green-400',
  orange: 'bg-orange-400',
  red:    'bg-red-400',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  TVA_CA3:       'TVA CA3',
  TVA_CA12:      'TVA CA12',
  IS_Solde:      'IS Solde',
  IS_Acompte:    'IS Acompte',
  CVAE:          'CVAE',
  CFE:           'CFE',
  DSN:           'DSN',
  LIASSE_FISCALE:'Liasse fiscale',
  BILAN:         'Bilan',
  DAS2:          'DAS2',
  PAIE:          'Paie',
  OTHER:         'Autre',
};

// ─── Demo data (shown when store is empty / n8n not configured) ───────────────

function buildDemoTasks(): FiscalTask[] {
  const now = new Date();
  const d = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString();

  return [
    { id: 'd1', client_id: 'c1', client_name: 'SARL Dupont & Fils',  task_type: 'TVA_CA3',        due_date: d(5),   status: 'preparation',  urgency_semantic: 'red',    updated_at: now.toISOString() },
    { id: 'd2', client_id: 'c2', client_name: 'SAS Technova',         task_type: 'IS_Acompte',    due_date: d(14),  status: 'waiting_docs', urgency_semantic: 'orange', updated_at: now.toISOString() },
    { id: 'd3', client_id: 'c3', client_name: 'EURL Martin Conseil',  task_type: 'DSN',            due_date: d(14),  status: 'waiting_docs', urgency_semantic: 'orange', updated_at: now.toISOString() },
    { id: 'd4', client_id: 'c4', client_name: 'SA Bâtiment Pro',      task_type: 'LIASSE_FISCALE', due_date: d(30),  status: 'ready',        urgency_semantic: 'green',  updated_at: now.toISOString() },
    { id: 'd5', client_id: 'c5', client_name: 'SASU WebAgency',       task_type: 'TVA_CA3',        due_date: d(60),  status: 'declared',     urgency_semantic: 'green',  updated_at: now.toISOString() },
    { id: 'd6', client_id: 'c1', client_name: 'SARL Dupont & Fils',  task_type: 'CFE',             due_date: d(5),   status: 'preparation',  urgency_semantic: 'red',    updated_at: now.toISOString() },
    { id: 'd7', client_id: 'c6', client_name: 'SC Immobilière Sud',   task_type: 'BILAN',          due_date: d(25),  status: 'ready',        urgency_semantic: 'green',  updated_at: now.toISOString() },
  ];
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onMove,
}: {
  task: FiscalTask;
  onMove: (taskId: string, newStatus: FiscalTaskStatus) => void;
}) {
  const daysLeft = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86_400_000);

  const nextStatus: FiscalTaskStatus | null =
    task.status === 'preparation'  ? 'waiting_docs' :
    task.status === 'waiting_docs' ? 'ready' :
    task.status === 'ready'        ? 'declared' :
    null;

  return (
    <div className={`bg-white rounded-lg shadow-sm p-3 mb-2 ${URGENCY_BORDER[task.urgency_semantic]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate">{task.client_name}</p>
          <p className="text-xs text-gray-600 mt-0.5">{TASK_TYPE_LABELS[task.task_type] ?? task.task_type}</p>
        </div>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${URGENCY_DOT[task.urgency_semantic]}`} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 text-gray-500">
          <Calendar className="w-3 h-3" />
          <span style={{ fontSize: '11px' }}>
            {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            {' · '}
            {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? 'Aujourd\'hui' : `J+${Math.abs(daysLeft)}`}
          </span>
        </div>
        {nextStatus && (
          <button
            onClick={() => onMove(task.id, nextStatus)}
            className="text-blue-600 hover:text-blue-800 transition-colors"
            style={{ fontSize: '10px' }}
            title="Passer à l'étape suivante"
          >
            Avancer →
          </button>
        )}
      </div>

      {task.note && (
        <p className="mt-1.5 text-gray-500 italic truncate" style={{ fontSize: '10px' }}>{task.note}</p>
      )}
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  onMove,
}: {
  column: KanbanColumn;
  tasks: FiscalTask[];
  onMove: (taskId: string, newStatus: FiscalTaskStatus) => void;
}) {
  const urgentCount = tasks.filter(t => t.urgency_semantic === 'red').length;

  return (
    <div className="flex flex-col flex-1 min-w-52 bg-gray-50 rounded-xl border border-gray-200">
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{column.label}</h3>
        <div className="flex items-center gap-1.5">
          {urgentCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-500" style={{ fontSize: '11px' }}>
              <AlertCircle className="w-3 h-3" />{urgentCount}
            </span>
          )}
          <span className="bg-gray-200 text-gray-600 text-xs font-medium px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-y-auto" style={{ minHeight: '160px', maxHeight: '60vh' }}>
        {tasks.length === 0 ? (
          <p className="text-center text-gray-400 text-xs mt-6">{column.emptyLabel}</p>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function FiscalCalendar() {
  const navigate = useNavigate();
  const {
    fiscalTasks,
    loadingFiscalTasks,
    fetchFiscalTasks,
    updateFiscalTaskStatus,
    refreshUrgencies,
  } = useDashboardStore();

  const displayTasks = fiscalTasks.length > 0 ? fiscalTasks : buildDemoTasks();

  useEffect(() => {
    fetchFiscalTasks().catch(() => {/* API not configured — demo mode */});
  }, [fetchFiscalTasks]);

  // Refresh urgency indicators every minute, but only when the tab is visible
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refreshUrgencies();
    };
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [refreshUrgencies]);

  const tasksByStatus = (status: FiscalTaskStatus) =>
    displayTasks.filter(t => t.status === status);

  return (
    <div className="p-6">
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendrier fiscal 2026</h1>
          <p className="text-sm text-gray-500 mt-1">
            Suivi des obligations fiscales et sociales par client
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Urgency legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            {(['green', 'orange', 'red'] as const).map(u => (
              <div key={u} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full ${URGENCY_DOT[u]}`} />
                <span>{u === 'green' ? '> 21 j' : u === 'orange' ? '7–21 j' : '< 7 j'}</span>
              </div>
            ))}
          </div>
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

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus(col.id)}
            onMove={updateFiscalTaskStatus}
          />
        ))}
      </div>

      {fiscalTasks.length === 0 && (
        <p className="text-xs text-center text-gray-400 mt-4">
          Mode démonstration — configurez le webhook n8n pour charger vos données réelles.
        </p>
      )}
    </div>
  );
}
