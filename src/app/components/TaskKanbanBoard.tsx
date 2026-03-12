import { AlertTriangle, Clock } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DragDropContext, Droppable, Draggable, type DropResult,
} from '@hello-pangea/dnd';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useTaskStore, type TaskRecord, type TaskStatus, type TaskPriority } from '../store/useTaskStore';

// ─── Column configuration ─────────────────────────────────────────────────────

interface ColumnConfig {
  status: TaskStatus;
  label: string;
  color: string;       // header bg
  dotColor: string;    // indicator dot
  cardBorder: string;  // card left border accent
}

const COLUMNS: ColumnConfig[] = [
  {
    status:     'todo',
    label:      'À faire',
    color:      'bg-slate-100',
    dotColor:   'bg-slate-400',
    cardBorder: 'border-l-slate-300',
  },
  {
    status:     'in_progress',
    label:      'En cours',
    color:      'bg-blue-100',
    dotColor:   'bg-blue-500',
    cardBorder: 'border-l-blue-400',
  },
  {
    status:     'review',
    label:      'En révision',
    color:      'bg-amber-100',
    dotColor:   'bg-amber-500',
    cardBorder: 'border-l-amber-400',
  },
  {
    status:     'done',
    label:      'Terminé',
    color:      'bg-emerald-100',
    dotColor:   'bg-emerald-500',
    cardBorder: 'border-l-emerald-400',
  },
];

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:    'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high:   'bg-red-50 text-red-600 border-red-200',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Basse', medium: 'Moyenne', high: 'Haute',
};

// ─── Deadline indicator ───────────────────────────────────────────────────────

function DeadlineChip({ dueDate }: { dueDate: string | null | undefined }) {
  if (!dueDate) return null;

  const date    = new Date(dueDate);
  const days    = differenceInDays(date, new Date());
  const overdue = isPast(date) && days < 0;
  const soon    = !overdue && days < 3;

  if (!overdue && !soon) return null;

  const cls = overdue
    ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-orange-500 bg-orange-50 border-orange-200';

  const Icon = overdue ? AlertTriangle : Clock;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 ${cls}`}>
      <Icon className="w-3 h-3" />
      {overdue
        ? `En retard (${Math.abs(days)}j)`
        : `${days}j`}
    </span>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function KanbanCard({
  task, index, cardBorder, onClick,
}: {
  task: TaskRecord;
  index: number;
  cardBorder: string;
  onClick: () => void;
}) {
  const initials = task.assigneeId
    ? task.assigneeId.slice(0, 2).toUpperCase()
    : '?';

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white rounded-xl border border-l-4 ${cardBorder} border-slate-200 p-3 shadow-sm
            cursor-pointer hover:shadow-md transition-shadow
            ${snapshot.isDragging ? 'shadow-lg rotate-1 opacity-90' : ''}`}
        >
          {/* Priority + deadline */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge className={`text-[10px] border px-1.5 py-0 ${PRIORITY_COLORS[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </Badge>
            <DeadlineChip dueDate={task.dueDate} />
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{task.title}</p>

          {/* Description */}
          {task.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            {task.dueDate && (
              <span className="text-[10px] text-slate-400">
                {format(new Date(task.dueDate), 'dd MMM', { locale: fr })}
              </span>
            )}
            {task.assigneeId && (
              <Avatar className="w-5 h-5 ml-auto">
                <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Main Kanban board ────────────────────────────────────────────────────────

interface TaskKanbanBoardProps {
  tasks: TaskRecord[];
}

export function TaskKanbanBoard({ tasks }: TaskKanbanBoardProps) {
  const { editTask, selectTask } = useTaskStore();

  function handleDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination) return;

    const newStatus = destination.droppableId as TaskStatus;
    const task = tasks.find(t => t.id === draggableId);
    if (!task || task.status === newStatus) return;

    editTask(draggableId, { status: newStatus });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 h-full">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status);
          return (
            <div key={col.status} className="flex flex-col min-h-[400px]">
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${col.color}`}>
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="ml-auto text-xs font-medium text-slate-500 bg-white/60 rounded-full px-2 py-0.5">
                  {colTasks.length}
                </span>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 flex flex-col gap-2 p-2 rounded-b-xl border border-t-0 border-slate-200 transition-colors min-h-[120px]
                      ${snapshot.isDraggingOver ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/40'}`}
                  >
                    {colTasks.map((task, index) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        index={index}
                        cardBorder={col.cardBorder}
                        onClick={() => selectTask(task.id)}
                      />
                    ))}
                    {provided.placeholder}
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-xs text-slate-400 text-center pt-6 italic">Aucune tâche</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
