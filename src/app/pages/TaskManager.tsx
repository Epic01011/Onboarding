import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, CheckCircle2, ClipboardList, ArrowLeft, Loader2, Plus, X,
} from 'lucide-react';
import { isThisWeek, isPast } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { useTaskStore, type TaskStatus, type TaskPriority } from '../store/useTaskStore';
import { TaskToolbar } from '../components/TaskToolbar';
import { TaskList } from '../components/TaskList';
import { TaskKanbanBoard } from '../components/TaskKanbanBoard';
import { TaskDetailSheet } from '../components/TaskDetailSheet';

// ─── New-task modal ───────────────────────────────────────────────────────────

interface NewTaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
}

const INITIAL_FORM: NewTaskFormState = {
  title:       '',
  description: '',
  status:      'todo',
  priority:    'medium',
  dueDate:     '',
  assigneeId:  '',
};

function NewTaskModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addTask } = useTaskStore();
  const [form, setForm] = useState<NewTaskFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof NewTaskFormState>(key: K, value: NewTaskFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const result = await addTask({
      title:       form.title.trim(),
      description: form.description.trim() || undefined,
      status:      form.status,
      priority:    form.priority,
      dueDate:     form.dueDate ? new Date(form.dueDate).toISOString() : null,
      assigneeId:  form.assigneeId.trim() || null,
      dossierId:   null,
    });
    setSaving(false);
    if (result) {
      toast.success('Tâche créée avec succès');
      setForm(INITIAL_FORM);
      onClose();
    } else {
      toast.error('Erreur lors de la création de la tâche');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Nouvelle tâche
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-medium">Titre *</label>
            <Input
              placeholder="Ex : Préparer la déclaration TVA…"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
              autoFocus
              className="text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-medium">Description</label>
            <Textarea
              placeholder="Détails supplémentaires…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="text-sm resize-none min-h-[60px]"
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Statut</label>
              <Select value={form.status} onValueChange={v => set('status', v as TaskStatus)}>
                <SelectTrigger size="sm" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="review">En révision</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Priorité</label>
              <Select value={form.priority} onValueChange={v => set('priority', v as TaskPriority)}>
                <SelectTrigger size="sm" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-medium">Deadline</label>
            <Input
              type="datetime-local"
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
              className="text-sm h-8"
            />
          </div>

          {/* Assignee (free-text UUID for now; extend with user list later) */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-medium">Assigné (ID)</label>
            <Input
              placeholder="ID du collaborateur…"
              value={form.assigneeId}
              onChange={e => set('assigneeId', e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Créer la tâche
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, colorClass,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${colorClass}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium opacity-80">{label}</p>
        <div className="w-9 h-9 bg-white/30 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-70">{sub}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaskManager() {
  const navigate = useNavigate();
  const {
    tasks, loading, error, filters, fetchTasks,
  } = useTaskStore();

  const [showNewTask, setShowNewTask] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const overdue = tasks.filter(
      t => t.status !== 'done' && t.dueDate && isPast(new Date(t.dueDate))
    ).length;
    const completedThisWeek = tasks.filter(
      t => t.status === 'done' && isThisWeek(new Date(t.updatedAt), { weekStartsOn: 1 })
    ).length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const total      = tasks.length;
    return { overdue, completedThisWeek, inProgress, total };
  }, [tasks]);

  // ── Filtered tasks ───────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.dossierId  && t.dossierId  !== filters.dossierId)  return false;
      if (filters.assigneeId && t.assigneeId !== filters.assigneeId) return false;
      if (filters.priority   && t.priority   !== filters.priority)   return false;
      return true;
    });
  }, [tasks, filters]);

  // ── Dropdown options derived from tasks ──────────────────────────────────────

  const dossierOptions = useMemo(() => {
    const seen = new Set<string>();
    return tasks
      .filter(t => t.dossierId)
      .filter(t => { if (seen.has(t.dossierId!)) return false; seen.add(t.dossierId!); return true; })
      .map(t => ({ id: t.dossierId!, label: t.dossierId! }));
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    const seen = new Set<string>();
    return tasks
      .filter(t => t.assigneeId)
      .filter(t => { if (seen.has(t.assigneeId!)) return false; seen.add(t.assigneeId!); return true; })
      .map(t => ({ id: t.assigneeId!, label: t.assigneeId! }));
  }, [tasks]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-slate-500 hover:text-slate-700 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Accueil
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Gestionnaire de tâches
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Organisation &amp; productivité de l'équipe du cabinet
              </p>
            </div>
            <Button onClick={() => setShowNewTask(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nouvelle tâche
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Tâches en retard"
            value={kpis.overdue}
            sub="deadline dépassée"
            icon={AlertTriangle}
            colorClass={
              kpis.overdue > 0
                ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-800'
                : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 text-slate-700'
            }
          />
          <KpiCard
            label="Complétées cette semaine"
            value={kpis.completedThisWeek}
            sub="tâches terminées"
            icon={CheckCircle2}
            colorClass="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800"
          />
          <KpiCard
            label="En cours"
            value={kpis.inProgress}
            sub="tâches actives"
            icon={ClipboardList}
            colorClass="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-800"
          />
          <KpiCard
            label="Total"
            value={kpis.total}
            sub={`${filteredTasks.length} après filtre`}
            icon={ClipboardList}
            colorClass="bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200 text-violet-800"
          />
        </div>

        {/* ── Error banner ───────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
            <Badge
              className="ml-auto cursor-pointer text-xs bg-red-100 text-red-600 border-red-200"
              onClick={fetchTasks}
            >
              Réessayer
            </Badge>
          </div>
        )}

        {/* ── Tabs: Liste | Kanban ──────────────────────────────────────────── */}
        <Tabs defaultValue="list">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="list">
                Vue Liste
              </TabsTrigger>
              <TabsTrigger value="kanban">
                Vue Kanban
              </TabsTrigger>
            </TabsList>

            {/* Filtered count */}
            {filteredTasks.length !== tasks.length && (
              <p className="text-xs text-slate-500">
                {filteredTasks.length} / {tasks.length} tâches affichées
              </p>
            )}
          </div>

          {/* Toolbar (shared between tabs) */}
          <TaskToolbar
            dossiers={dossierOptions}
            assignees={assigneeOptions}
            onNewTask={() => setShowNewTask(true)}
          />

          {/* ── Loading state ─────────────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Chargement des tâches…
            </div>
          )}

          {!loading && (
            <>
              <TabsContent value="list" className="mt-4">
                <TaskList tasks={filteredTasks} />
              </TabsContent>

              <TabsContent value="kanban" className="mt-4">
                <TaskKanbanBoard tasks={filteredTasks} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* ── Detail sheet (right panel) ─────────────────────────────────────── */}
      <TaskDetailSheet />

      {/* ── New task modal ─────────────────────────────────────────────────── */}
      <NewTaskModal open={showNewTask} onClose={() => setShowNewTask(false)} />
    </div>
  );
}
