import { useState, useRef } from 'react';
import {
  AlertTriangle, Clock, Send, Paperclip, Trash2, FileText, Loader2,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { useTaskStore, type TaskStatus, type TaskPriority } from '../store/useTaskStore';

// ─── Label / color maps ───────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo',        label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'review',      label: 'En révision' },
  { value: 'done',        label: 'Terminé' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; dot: string }> = [
  { value: 'low',    label: 'Basse',   dot: 'bg-slate-400' },
  { value: 'medium', label: 'Moyenne', dot: 'bg-amber-400' },
  { value: 'high',   label: 'Haute',   dot: 'bg-red-500'   },
];

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low:    'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high:   'bg-red-50 text-red-600 border-red-200',
};

// ─── Deadline display ─────────────────────────────────────────────────────────

function DeadlineDisplay({ dueDate }: { dueDate: string | null | undefined }) {
  if (!dueDate) return <span className="text-slate-400 text-sm">Non définie</span>;

  const date    = new Date(dueDate);
  const days    = differenceInDays(date, new Date());
  const overdue = isPast(date) && days < 0;
  const soon    = !overdue && days < 3;

  const cls = overdue
    ? 'text-red-600 font-semibold'
    : soon
    ? 'text-orange-500 font-medium'
    : 'text-slate-700';

  const Icon = overdue ? AlertTriangle : soon ? Clock : null;

  return (
    <span className={`flex items-center gap-1.5 text-sm ${cls}`}>
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      {format(date, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
      {overdue && (
        <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
          En retard de {Math.abs(days)}j
        </span>
      )}
      {soon && !overdue && (
        <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
          Dans {days}j
        </span>
      )}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TaskDetailSheet() {
  const {
    tasks, selectedTaskId, selectTask, editTask,
    comments, attachments, postComment, uploadAttachment, removeAttachment,
    commentsLoading, attachmentsLoading,
  } = useTaskStore();

  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const task = tasks.find(t => t.id === selectedTaskId) ?? null;
  const taskComments    = task ? (comments[task.id]    ?? []) : [];
  const taskAttachments = task ? (attachments[task.id] ?? []) : [];

  async function handleSendComment() {
    if (!task || !commentInput.trim()) return;
    setSendingComment(true);
    await postComment(task.id, commentInput.trim());
    setCommentInput('');
    setSendingComment(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!task) return;
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const simulatedPath = `tasks/${task.id}/${file.name}`;
      uploadAttachment(task.id, {
        fileName:    file.name,
        filePath:    simulatedPath,
        fileSize:    file.size,
        contentType: file.type || 'application/octet-stream',
      }).then(() => toast.success(`${file.name} ajouté`));
    });
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleFieldUpdate(
    updates: Partial<Omit<import('../store/useTaskStore').TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ) {
    if (!task) return;
    editTask(task.id, updates);
  }

  if (!task) return null;

  const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === task.priority) ?? PRIORITY_OPTIONS[1];

  return (
    <Sheet open={!!selectedTaskId} onOpenChange={open => { if (!open) selectTask(null); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityInfo.dot}`} />
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-slate-900 leading-snug">
                {task.title}
              </SheetTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Créée le {format(new Date(task.createdAt), 'dd MMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-6">

            {/* ── Details ──────────────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Détails</h3>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Description</label>
                <Textarea
                  value={task.description ?? ''}
                  onChange={e => handleFieldUpdate({ description: e.target.value })}
                  placeholder="Ajouter une description…"
                  className="text-sm resize-none min-h-[72px]"
                  onBlur={e => editTask(task.id, { description: e.target.value || undefined })}
                />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Statut</label>
                  <Select value={task.status} onValueChange={v => handleFieldUpdate({ status: v as TaskStatus })}>
                    <SelectTrigger size="sm" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Priorité</label>
                  <Select value={task.priority} onValueChange={v => handleFieldUpdate({ priority: v as TaskPriority })}>
                    <SelectTrigger size="sm" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${o.dot}`} />
                            {o.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Priority badge visual */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Priorité actuelle :</span>
                <Badge className={`text-xs border ${PRIORITY_BADGE[task.priority]}`}>
                  {priorityInfo.label}
                </Badge>
              </div>

              {/* Deadline */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Deadline</label>
                <Input
                  type="datetime-local"
                  value={task.dueDate ? task.dueDate.slice(0, 16) : ''}
                  onChange={e => handleFieldUpdate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="text-sm h-8"
                />
                <div className="mt-1">
                  <DeadlineDisplay dueDate={task.dueDate} />
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Assigné</label>
                {task.assigneeId ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {task.assigneeId.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-slate-700 font-medium truncate">
                      {task.assigneeId}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => handleFieldUpdate({ assigneeId: null })}
                    >
                      Retirer
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Non assignée</p>
                )}
              </div>
            </section>

            {/* ── Attachments ───────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Pièces jointes ({taskAttachments.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-3 h-3" />
                  Ajouter
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {attachmentsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement…
                </div>
              ) : taskAttachments.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucune pièce jointe.</p>
              ) : (
                <ul className="space-y-2">
                  {taskAttachments.map(att => (
                    <li
                      key={att.id}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{att.fileName}</p>
                        {att.fileSize && (
                          <p className="text-[10px] text-slate-400">
                            {(att.fileSize / 1024).toFixed(1)} Ko
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                        onClick={() => removeAttachment(task.id, att.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Comments ──────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Commentaires ({taskComments.length})
              </h3>

              {commentsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement…
                </div>
              ) : taskComments.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucun commentaire pour l'instant.</p>
              ) : (
                <ul className="space-y-3">
                  {taskComments.map(c => (
                    <li key={c.id} className="flex gap-2">
                      <Avatar className="w-7 h-7 flex-shrink-0">
                        <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700">
                          {c.userId ? c.userId.slice(0, 2).toUpperCase() : 'ME'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-none px-3 py-2">
                          <p className="text-sm text-slate-800 leading-relaxed">{c.content}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">
                          {format(new Date(c.createdAt), "dd MMM 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Comment input */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Ajouter un commentaire…"
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  className="text-sm"
                  disabled={sendingComment}
                />
                <Button
                  size="icon"
                  onClick={handleSendComment}
                  disabled={!commentInput.trim() || sendingComment}
                  className="h-9 w-9 flex-shrink-0"
                >
                  {sendingComment
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </section>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
