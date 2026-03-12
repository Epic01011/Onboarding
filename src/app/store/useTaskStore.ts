/**
 * useTaskStore.ts — Gestion d'état Zustand pour le module Task Management.
 *
 * Chaque tâche contient : id, titre, description, dossier_id, assigné,
 * statut, priorité, deadline, commentaires et pièces jointes (virtuels en mémoire,
 * persistés séparément via Supabase).
 */

import { create } from 'zustand';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskComments,
  addTaskComment,
  getTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
  type TaskRecord,
  type TaskStatus,
  type TaskPriority,
  type TaskCommentRecord,
  type TaskAttachmentRecord,
} from '../utils/supabaseSync';

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type { TaskRecord, TaskStatus, TaskPriority, TaskCommentRecord, TaskAttachmentRecord };

// ─── Assignee shape (enriched client-side) ───────────────────────────────────

export interface Assignee {
  id: string;
  name: string;
  avatarUrl?: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface TaskFilters {
  search: string;
  dossierId: string;   // '' = all
  assigneeId: string;  // '' = all
  priority: string;    // '' = all
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface TaskStore {
  // State
  tasks: TaskRecord[];
  loading: boolean;
  error: string | null;

  // Detail panel
  selectedTaskId: string | null;
  comments: Record<string, TaskCommentRecord[]>;
  attachments: Record<string, TaskAttachmentRecord[]>;
  commentsLoading: boolean;
  attachmentsLoading: boolean;

  // Filters
  filters: TaskFilters;

  // Actions — tasks
  fetchTasks: () => Promise<void>;
  addTask: (payload: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TaskRecord | null>;
  editTask: (
    id: string,
    updates: Partial<Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  // Actions — selection
  selectTask: (id: string | null) => void;

  // Actions — comments
  loadComments: (taskId: string) => Promise<void>;
  postComment: (taskId: string, content: string) => Promise<void>;

  // Actions — attachments
  loadAttachments: (taskId: string) => Promise<void>;
  uploadAttachment: (
    taskId: string,
    attachment: Omit<TaskAttachmentRecord, 'id' | 'taskId' | 'createdAt'>
  ) => Promise<void>;
  removeAttachment: (taskId: string, attachmentId: string) => Promise<void>;

  // Actions — filters
  setFilters: (partial: Partial<TaskFilters>) => void;
  resetFilters: () => void;
}

// ─── Default filters ──────────────────────────────────────────────────────────

const DEFAULT_FILTERS: TaskFilters = {
  search:     '',
  dossierId:  '',
  assigneeId: '',
  priority:   '',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks:              [],
  loading:            false,
  error:              null,
  selectedTaskId:     null,
  comments:           {},
  attachments:        {},
  commentsLoading:    false,
  attachmentsLoading: false,
  filters:            { ...DEFAULT_FILTERS },

  // ── Tasks ──────────────────────────────────────────────────────────────────

  fetchTasks: async () => {
    set({ loading: true, error: null });
    const result = await getTasks();
    if (result.success) {
      set({ tasks: result.data, loading: false });
    } else {
      set({ error: result.error, loading: false });
    }
  },

  addTask: async (payload) => {
    const result = await createTask(payload);
    if (result.success) {
      set(s => ({ tasks: [result.data, ...s.tasks] }));
      return result.data;
    }
    set({ error: result.error });
    return null;
  },

  editTask: async (id, updates) => {
    // Optimistic update
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    }));
    const result = await updateTask(id, updates);
    if (!result.success) {
      set({ error: result.error });
      // Re-fetch to restore correct server state
      await get().fetchTasks();
    }
  },

  removeTask: async (id) => {
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
    if (get().selectedTaskId === id) set({ selectedTaskId: null });
    const result = await deleteTask(id);
    if (!result.success) {
      set({ error: result.error });
      await get().fetchTasks();
    }
  },

  // ── Selection ──────────────────────────────────────────────────────────────

  selectTask: (id) => {
    set({ selectedTaskId: id });
    if (id) {
      get().loadComments(id);
      get().loadAttachments(id);
    }
  },

  // ── Comments ───────────────────────────────────────────────────────────────

  loadComments: async (taskId) => {
    set({ commentsLoading: true });
    const result = await getTaskComments(taskId);
    if (result.success) {
      set(s => ({
        comments: { ...s.comments, [taskId]: result.data },
        commentsLoading: false,
      }));
    } else {
      set({ commentsLoading: false });
    }
  },

  postComment: async (taskId, content) => {
    const result = await addTaskComment(taskId, content);
    if (result.success) {
      set(s => ({
        comments: {
          ...s.comments,
          [taskId]: [...(s.comments[taskId] ?? []), result.data],
        },
      }));
    } else {
      set({ error: result.error });
    }
  },

  // ── Attachments ────────────────────────────────────────────────────────────

  loadAttachments: async (taskId) => {
    set({ attachmentsLoading: true });
    const result = await getTaskAttachments(taskId);
    if (result.success) {
      set(s => ({
        attachments: { ...s.attachments, [taskId]: result.data },
        attachmentsLoading: false,
      }));
    } else {
      set({ attachmentsLoading: false });
    }
  },

  uploadAttachment: async (taskId, attachment) => {
    const result = await addTaskAttachment(taskId, attachment);
    if (result.success) {
      set(s => ({
        attachments: {
          ...s.attachments,
          [taskId]: [...(s.attachments[taskId] ?? []), result.data],
        },
      }));
    } else {
      set({ error: result.error });
    }
  },

  removeAttachment: async (taskId, attachmentId) => {
    set(s => ({
      attachments: {
        ...s.attachments,
        [taskId]: (s.attachments[taskId] ?? []).filter(a => a.id !== attachmentId),
      },
    }));
    const result = await deleteTaskAttachment(attachmentId);
    if (!result.success) {
      set({ error: result.error });
      await get().loadAttachments(taskId);
    }
  },

  // ── Filters ────────────────────────────────────────────────────────────────

  setFilters: (partial) => {
    set(s => ({ filters: { ...s.filters, ...partial } }));
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
  },
}));
