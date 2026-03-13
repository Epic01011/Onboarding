/**
 * useSyncTasks.ts — Hook de synchronisation bidirectionnelle entre le Task Manager
 * local (Zustand + Supabase) et Microsoft To Do (via l'API Microsoft Graph).
 *
 * Ce hook enveloppe les actions du store useTaskStore en ajoutant des appels
 * synchrones vers Microsoft To Do lorsqu'un token Graph est disponible.
 *
 * Usage :
 *   const { addTask, editTask, removeTask } = useSyncTasks();
 *
 * Prérequis :
 *   - L'utilisateur doit être connecté avec son compte Microsoft (MicrosoftAuthContext)
 *   - Le champ microsoft_list_id doit être défini sur la tâche pour la synchroniser
 */

import { useCallback } from 'react';
import { useMicrosoftAuth } from '../context/MicrosoftAuthContext';
import { useTaskStore } from '../store/useTaskStore';
import type { TaskRecord } from '../store/useTaskStore';
import {
  createTodoTask,
  updateTodoTask,
  deleteTodoTask,
} from '../utils/microsoftGraph';
import type { TodoTaskInput } from '../utils/microsoftGraph';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit le statut local en statut Microsoft To Do. */
function toMsStatus(status: TaskRecord['status']): TodoTaskInput['status'] {
  switch (status) {
    case 'done':        return 'completed';
    case 'in_progress': return 'inProgress';
    case 'review':      return 'waitingOnOthers';
    case 'todo':
    default:            return 'notStarted';
  }
}

/** Convertit la priorité locale en importance Microsoft To Do. */
function toMsImportance(priority: TaskRecord['priority']): TodoTaskInput['importance'] {
  switch (priority) {
    case 'high':   return 'high';
    case 'low':    return 'low';
    case 'medium':
    default:       return 'normal';
  }
}

/** Construit le payload TodoTaskInput à partir d'un TaskRecord partiel. */
function buildTodoInput(
  task: Partial<Pick<TaskRecord, 'title' | 'status' | 'priority' | 'dueDate' | 'description'>>
): TodoTaskInput {
  const input: TodoTaskInput = {};
  if (task.title    !== undefined) input.title      = task.title;
  if (task.status   !== undefined) input.status     = toMsStatus(task.status);
  if (task.priority !== undefined) input.importance = toMsImportance(task.priority);
  if (task.dueDate  !== undefined) {
    input.dueDateTime = task.dueDate
      ? { dateTime: task.dueDate, timeZone: 'UTC' }
      : null;
  }
  if (task.description !== undefined) {
    input.body = { content: task.description ?? '', contentType: 'text' };
  }
  return input;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncTasks() {
  const { graphToken, isConnected } = useMicrosoftAuth();
  const store = useTaskStore();

  /**
   * Crée une tâche localement (Supabase) puis, si Microsoft est connecté et qu'une
   * liste est ciblée (microsoftListId), la crée dans To Do et sauvegarde l'ID retourné.
   */
  const addTask = useCallback(
    async (
      payload: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<TaskRecord | null> => {
      // 1. Création locale (Supabase via le store)
      const created = await store.addTask(payload);
      if (!created) return null;

      // 2. Synchronisation vers Microsoft To Do (si token et liste disponibles)
      if (isConnected && graphToken && payload.microsoftListId) {
        try {
          const msTask = await createTodoTask(
            graphToken,
            payload.microsoftListId,
            buildTodoInput(payload),
          );
          // 3. Mise à jour de l'identifiant Microsoft dans Supabase
          await store.editTask(created.id, {
            microsoftTaskId: msTask.id,
            microsoftListId: payload.microsoftListId,
          });
          return { ...created, microsoftTaskId: msTask.id, microsoftListId: payload.microsoftListId };
        } catch (err) {
          // La tâche locale est créée — on logue l'erreur sans bloquer l'UX
          console.warn('[useSyncTasks] createTodoTask failed:', err);
        }
      }

      return created;
    },
    [graphToken, isConnected, store],
  );

  /**
   * Met à jour une tâche localement (Supabase) puis la met à jour dans Microsoft
   * To Do si les identifiants de synchronisation sont disponibles.
   */
  const editTask = useCallback(
    async (
      id: string,
      updates: Partial<Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
    ): Promise<void> => {
      // Récupération des identifiants Microsoft avant la mise à jour optimiste
      // (le store peut être modifié avant que l'on puisse lire les valeurs actuelles)
      const task = store.tasks.find(t => t.id === id);
      const listId = updates.microsoftListId ?? task?.microsoftListId;
      const taskId = updates.microsoftTaskId ?? task?.microsoftTaskId;

      // 1. Mise à jour locale (optimiste via le store)
      await store.editTask(id, updates);

      // 2. Synchronisation vers Microsoft To Do
      if (isConnected && graphToken && listId && taskId) {
        try {
          await updateTodoTask(graphToken, listId, taskId, buildTodoInput(updates));
        } catch (err) {
          console.warn('[useSyncTasks] updateTodoTask failed:', err);
        }
      }
    },
    [graphToken, isConnected, store],
  );

  /**
   * Supprime une tâche localement (Supabase) puis la supprime dans Microsoft
   * To Do si les identifiants de synchronisation sont disponibles.
   */
  const removeTask = useCallback(
    async (id: string): Promise<void> => {
      // Récupération des identifiants Microsoft avant suppression locale
      const task = store.tasks.find(t => t.id === id);
      const listId = task?.microsoftListId;
      const taskId = task?.microsoftTaskId;

      // 1. Suppression locale
      await store.removeTask(id);

      // 2. Suppression dans Microsoft To Do
      if (isConnected && graphToken && listId && taskId) {
        try {
          await deleteTodoTask(graphToken, listId, taskId);
        } catch (err) {
          console.warn('[useSyncTasks] deleteTodoTask failed:', err);
        }
      }
    },
    [graphToken, isConnected, store],
  );

  return {
    // Actions synchronisées
    addTask,
    editTask,
    removeTask,
    // Reste du store exposé tel quel
    fetchTasks:        store.fetchTasks,
    selectTask:        store.selectTask,
    loadComments:      store.loadComments,
    postComment:       store.postComment,
    loadAttachments:   store.loadAttachments,
    uploadAttachment:  store.uploadAttachment,
    removeAttachment:  store.removeAttachment,
    setFilters:        store.setFilters,
    resetFilters:      store.resetFilters,
    // État
    tasks:             store.tasks,
    loading:           store.loading,
    error:             store.error,
    selectedTaskId:    store.selectedTaskId,
    comments:          store.comments,
    attachments:       store.attachments,
    commentsLoading:   store.commentsLoading,
    attachmentsLoading: store.attachmentsLoading,
    filters:           store.filters,
  };
}
