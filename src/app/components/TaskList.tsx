import { useState } from 'react';
import { AlertTriangle, Clock, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { useTaskStore, type TaskRecord, type TaskStatus, type TaskPriority } from '../store/useTaskStore';

// ─── Label maps ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'À faire',
  in_progress: 'En cours',
  review:      'En révision',
  done:        'Terminé',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  review:      'bg-amber-100 text-amber-700 border-amber-200',
  done:        'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'Basse',
  medium: 'Moyenne',
  high:   'Haute',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:    'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high:   'bg-red-50 text-red-600 border-red-200',
};

// ─── Deadline badge ───────────────────────────────────────────────────────────

function DeadlineBadge({ dueDate }: { dueDate: string | null | undefined }) {
  if (!dueDate) return <span className="text-slate-400 text-sm">—</span>;

  const date   = new Date(dueDate);
  const days   = differenceInDays(date, new Date());
  const overdue = isPast(date) && days < 0;
  const soon    = !overdue && days < 3;

  const colorClass = overdue
    ? 'text-red-600 font-semibold'
    : soon
    ? 'text-orange-500 font-medium'
    : 'text-slate-600';

  return (
    <span className={`flex items-center gap-1 text-sm whitespace-nowrap ${colorClass}`}>
      {overdue && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
      {soon && !overdue && <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
      {format(date, 'dd MMM yyyy', { locale: fr })}
    </span>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────

type SortKey = 'title' | 'status' | 'priority' | 'dueDate';
type SortDir = 'asc' | 'desc';

function SortableHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors"
    >
      {label}
      <Icon className={`w-3 h-3 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    </button>
  );
}

// ─── Priority sort weight ─────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };

// ─── Main component ───────────────────────────────────────────────────────────

interface TaskListProps {
  tasks: TaskRecord[];
}

export function TaskList({ tasks }: TaskListProps) {
  const { selectTask, removeTask } = useTaskStore();
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'title':
        cmp = a.title.localeCompare(b.title, 'fr');
        break;
      case 'status': {
        const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
        cmp = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        break;
      }
      case 'priority':
        cmp = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        break;
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) cmp = 0;
        else if (!a.dueDate) cmp = 1;
        else if (!b.dueDate) cmp = -1;
        else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <p className="text-lg font-medium">Aucune tâche trouvée</p>
        <p className="text-sm mt-1">Créez votre première tâche ou ajustez les filtres.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead>
              <SortableHeader label="Tâche" sortKey="title" current={sortKey} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label="Statut" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label="Priorité" sortKey="priority" current={sortKey} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead className="hidden md:table-cell">Assigné</TableHead>
            <TableHead>
              <SortableHeader label="Deadline" sortKey="dueDate" current={sortKey} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(task => {
            const initials = task.assigneeId
              ? task.assigneeId.slice(0, 2).toUpperCase()
              : '??';

            return (
              <TableRow
                key={task.id}
                className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                onClick={() => selectTask(task.id)}
              >
                {/* Title + description */}
                <TableCell className="py-3">
                  <p className="font-medium text-slate-900 text-sm leading-tight">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge className={`text-xs border ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </Badge>
                </TableCell>

                {/* Priority */}
                <TableCell>
                  <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </Badge>
                </TableCell>

                {/* Assignee */}
                <TableCell className="hidden md:table-cell">
                  {task.assigneeId ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-slate-600 truncate max-w-[100px]">
                        {task.assigneeId.slice(0, 8)}…
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">—</span>
                  )}
                </TableCell>

                {/* Deadline */}
                <TableCell>
                  <DeadlineBadge dueDate={task.dueDate} />
                </TableCell>

                {/* Actions */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    onClick={() => removeTask(task.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
