import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { useTaskStore, type TaskFilters } from '../store/useTaskStore';

// ─── Static filter options ────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high',   label: 'Haute' },
];

interface TaskToolbarProps {
  /** Unique client/dossier list derived from task data. */
  dossiers: Array<{ id: string; label: string }>;
  /** Unique assignee list derived from task data. */
  assignees: Array<{ id: string; label: string }>;
  /** Called when the user clicks "Nouvelle tâche". */
  onNewTask: () => void;
}

export function TaskToolbar({ dossiers, assignees, onNewTask }: TaskToolbarProps) {
  const { filters, setFilters, resetFilters } = useTaskStore();

  const hasActiveFilters =
    filters.search !== '' ||
    filters.dossierId !== '' ||
    filters.assigneeId !== '' ||
    filters.priority !== '';

  function handleFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    setFilters({ [key]: value } as Partial<TaskFilters>);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Rechercher une tâche…"
          value={filters.search}
          onChange={e => handleFilter('search', e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {filters.search && (
          <button
            onClick={() => handleFilter('search', '')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Client / Dossier filter */}
      <Select
        value={filters.dossierId || '__all__'}
        onValueChange={v => handleFilter('dossierId', v === '__all__' ? '' : v)}
      >
        <SelectTrigger size="sm" className="h-9 w-44 text-sm">
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tous les clients</SelectItem>
          {dossiers.map(d => (
            <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      <Select
        value={filters.assigneeId || '__all__'}
        onValueChange={v => handleFilter('assigneeId', v === '__all__' ? '' : v)}
      >
        <SelectTrigger size="sm" className="h-9 w-44 text-sm">
          <SelectValue placeholder="Collaborateur" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tous les collaborateurs</SelectItem>
          {assignees.map(a => (
            <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={filters.priority || '__all__'}
        onValueChange={v => handleFilter('priority', v === '__all__' ? '' : v)}
      >
        <SelectTrigger size="sm" className="h-9 w-36 text-sm">
          <SelectValue placeholder="Priorité" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Toutes priorités</SelectItem>
          {PRIORITY_OPTIONS.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-slate-500">
          <X className="w-3.5 h-3.5 mr-1" />
          Effacer
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* New task */}
      <Button size="sm" onClick={onNewTask} className="h-9 gap-1.5">
        + Nouvelle tâche
      </Button>
    </div>
  );
}
