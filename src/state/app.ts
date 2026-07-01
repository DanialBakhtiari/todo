import {
  type AppData,
  type Category,
  type Priority,
  type SortBy,
  type StatusFilter,
  type Task,
  type ThemePref,
} from '../lib/types.ts';
import { createStore, type Store } from '../lib/store.ts';
import { loadData, saveData, StorageQuotaError } from '../lib/storage.ts';
import { uid } from '../lib/id.ts';
import { nowISO, toISODate, parseISO } from '../lib/dates.ts';

export interface UIState {
  search: string;
  status: StatusFilter;
  priority: Priority | 'all';
  categoryId: string | 'all';
}

export interface AppState {
  data: AppData;
  ui: UIState;
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  dueDate?: string;
  priority: Priority;
  color: string;
  categoryId?: string;
  reminderAt?: string;
  recurring?: Task['recurring'];
}

interface UndoState {
  tasks: Task[];
  label: string;
}

/* -------------------------------------------------------------------------- */
/* Store + persistence                                                         */
/* -------------------------------------------------------------------------- */

const initialUI: UIState = {
  search: '',
  status: 'all',
  priority: 'all',
  categoryId: 'all',
};

export const store: Store<AppState> = createStore<AppState>({
  data: loadData(),
  ui: initialUI,
});

let pendingUndo: UndoState | null = null;
type ErrorHandler = (message: string) => void;
let errorHandler: ErrorHandler = () => {};
export function onStateError(fn: ErrorHandler): void {
  errorHandler = fn;
}

// Persist whenever the data slice changes (not on pure UI changes).
store.subscribe((state, prev) => {
  if (state.data === prev.data) return;
  try {
    saveData(state.data);
  } catch (err) {
    if (err instanceof StorageQuotaError) {
      errorHandler(
        'حافظه‌ی مرورگر پر شده است. لطفاً یک نسخه‌ی پشتیبان بگیرید و چند کار قدیمی را حذف کنید.',
      );
    } else {
      errorHandler('ذخیره‌سازی ناموفق بود.');
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function setData(mutator: (data: AppData) => AppData): void {
  store.set((s) => ({ ...s, data: mutator(s.data) }));
}

function setTasks(tasks: Task[]): void {
  setData((data) => ({ ...data, tasks }));
}

function touch(task: Task, patch: Partial<Task>): Task {
  return { ...task, ...patch, updatedAt: nowISO() };
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/* -------------------------------------------------------------------------- */
/* Task actions                                                                */
/* -------------------------------------------------------------------------- */

export function addTask(input: NewTaskInput): void {
  const title = input.title.trim();
  if (!title) return;
  setData((data) => {
    const minOrder = data.tasks.reduce((m, t) => Math.min(m, t.order), 0);
    const task: Task = {
      id: uid(),
      title,
      priority: input.priority,
      color: input.color,
      subtasks: [],
      completed: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      order: minOrder - 1, // newest floats to the top in manual sort
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.reminderAt ? { reminderAt: input.reminderAt } : {}),
      ...(input.recurring ? { recurring: input.recurring } : {}),
    };
    return { ...data, tasks: [task, ...data.tasks] };
  });
}

export function updateTask(id: string, patch: Partial<Task>): void {
  setTasks(store.get().data.tasks.map((t) => (t.id === id ? touch(t, patch) : t)));
}

export function deleteTask(id: string): void {
  const tasks = store.get().data.tasks;
  const target = tasks.find((t) => t.id === id);
  if (!target) return;
  pendingUndo = { tasks, label: `«${target.title}» حذف شد` };
  setTasks(tasks.filter((t) => t.id !== id));
}

/** Advance an ISO date by the recurrence interval, for the next occurrence. */
function nextOccurrence(dueDate: string, recurring: NonNullable<Task['recurring']>): string {
  const base = parseISO(dueDate) ?? new Date();
  const d = new Date(base);
  const n = recurring.interval;
  if (recurring.freq === 'daily') d.setDate(d.getDate() + n);
  else if (recurring.freq === 'weekly') d.setDate(d.getDate() + 7 * n);
  else d.setMonth(d.getMonth() + n);
  return toISODate(d);
}

export function toggleComplete(id: string): void {
  const tasks = store.get().data.tasks;
  const target = tasks.find((t) => t.id === id);
  if (!target) return;

  const completing = !target.completed;
  pendingUndo = {
    tasks,
    label: completing ? `«${target.title}» انجام شد` : `«${target.title}» بازگردانده شد`,
  };

  let next = tasks.map((t) =>
    t.id === id
      ? touch(t, {
          completed: completing,
          ...(completing ? { completedAt: nowISO() } : { completedAt: undefined }),
        })
      : t,
  );

  // Recurring tasks: completing one spawns the next occurrence.
  if (completing && target.recurring && target.dueDate) {
    const minOrder = next.reduce((m, t) => Math.min(m, t.order), 0);
    const clone: Task = {
      ...target,
      id: uid(),
      completed: false,
      completedAt: undefined,
      dueDate: nextOccurrence(target.dueDate, target.recurring),
      subtasks: target.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      order: minOrder - 1,
    };
    next = [clone, ...next];
  }
  setTasks(next);
}

export function reorderTasks(orderedIds: string[]): void {
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  setTasks(
    store.get().data.tasks.map((t) =>
      rank.has(t.id) ? { ...t, order: rank.get(t.id)! } : t,
    ),
  );
}

export function undoLast(): boolean {
  if (!pendingUndo) return false;
  setTasks(pendingUndo.tasks);
  pendingUndo = null;
  return true;
}

export function takePendingUndoLabel(): string | null {
  return pendingUndo?.label ?? null;
}

/* -------------------------------------------------------------------------- */
/* Subtasks                                                           */
/* -------------------------------------------------------------------------- */

export function addSubtask(taskId: string, title: string): void {
  const t = title.trim();
  if (!t) return;
  updateTask(taskId, {
    subtasks: [
      ...(store.get().data.tasks.find((x) => x.id === taskId)?.subtasks ?? []),
      { id: uid(), title: t, done: false },
    ],
  });
}

export function toggleSubtask(taskId: string, subId: string): void {
  const task = store.get().data.tasks.find((x) => x.id === taskId);
  if (!task) return;
  updateTask(taskId, {
    subtasks: task.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)),
  });
}

export function deleteSubtask(taskId: string, subId: string): void {
  const task = store.get().data.tasks.find((x) => x.id === taskId);
  if (!task) return;
  updateTask(taskId, { subtasks: task.subtasks.filter((s) => s.id !== subId) });
}

/* -------------------------------------------------------------------------- */
/* Categories                                                         */
/* -------------------------------------------------------------------------- */

export function addCategory(name: string, color: string): void {
  const n = name.trim();
  if (!n) return;
  setData((data) => ({
    ...data,
    categories: [...data.categories, { id: uid(), name: n, color }],
  }));
}

export function deleteCategory(id: string): void {
  setData((data) => ({
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    tasks: data.tasks.map((t) =>
      t.categoryId === id ? { ...t, categoryId: undefined } : t,
    ),
  }));
}

/* -------------------------------------------------------------------------- */
/* Settings + UI                                                               */
/* -------------------------------------------------------------------------- */

export function setTheme(theme: ThemePref): void {
  setData((data) => ({ ...data, settings: { ...data.settings, theme } }));
}

export function setSortBy(sortBy: SortBy): void {
  setData((data) => ({ ...data, settings: { ...data.settings, sortBy } }));
}

export function setNotificationsEnabled(enabled: boolean): void {
  setData((data) => ({
    ...data,
    settings: { ...data.settings, notificationsEnabled: enabled },
  }));
}

function setUI(patch: Partial<UIState>): void {
  store.set((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
}
export const setSearch = (search: string): void => setUI({ search });
export const setStatusFilter = (status: StatusFilter): void => setUI({ status });
export const setPriorityFilter = (priority: Priority | 'all'): void =>
  setUI({ priority });
export const setCategoryFilter = (categoryId: string | 'all'): void =>
  setUI({ categoryId });

export function replaceData(data: AppData): void {
  store.set((s) => ({ ...s, data }));
}

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export interface DerivedLists {
  active: Task[];
  completed: Task[];
  counts: { active: number; completed: number; total: number };
}

function matchesFilters(task: Task, ui: UIState): boolean {
  if (ui.priority !== 'all' && task.priority !== ui.priority) return false;
  if (ui.categoryId !== 'all' && task.categoryId !== ui.categoryId) return false;
  if (ui.search) {
    const q = ui.search.trim().toLowerCase();
    const hay = `${task.title} ${task.notes ?? ''} ${task.subtasks
      .map((s) => s.title)
      .join(' ')}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const copy = [...tasks];
  switch (sortBy) {
    case 'manual':
      return copy.sort((a, b) => a.order - b.order);
    case 'dueDate':
      return copy.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case 'priority':
      return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    case 'createdAt':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function selectLists(state: AppState): DerivedLists {
  const { data, ui } = state;
  const counts = {
    active: data.tasks.filter((t) => !t.completed).length,
    completed: data.tasks.filter((t) => t.completed).length,
    total: data.tasks.length,
  };
  const filtered = data.tasks.filter((t) => matchesFilters(t, ui));
  const active = sortTasks(
    filtered.filter((t) => !t.completed),
    data.settings.sortBy,
  );
  const completed = sortTasks(
    filtered.filter((t) => t.completed),
    'createdAt',
  );
  return { active, completed, counts };
}

export function categoryById(state: AppState, id: string | undefined): Category | undefined {
  if (!id) return undefined;
  return state.data.categories.find((c) => c.id === id);
}
