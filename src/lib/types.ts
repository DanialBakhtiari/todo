/** Data model. */

export type Priority = 'low' | 'medium' | 'high';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string; // ISO date (YYYY-MM-DD); Jalali shown is derived
  priority: Priority;
  color: string; // hex
  categoryId?: string;
  subtasks: Subtask[];
  recurring?: Recurrence;
  reminderAt?: string; // ISO datetime for the Notification API
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  order: number; // for drag & drop
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export type ThemePref = 'light' | 'dark' | 'system';

export type SortBy = 'manual' | 'dueDate' | 'priority' | 'createdAt';

export type StatusFilter = 'all' | 'active' | 'completed';

export interface AppSettings {
  theme: ThemePref;
  schemaVersion: number;
  sortBy: SortBy;
  notificationsEnabled: boolean;
}

/** The single serialisable blob persisted to localStorage / exported as backup. */
export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  categories: Category[];
  settings: AppSettings;
}

export const CURRENT_SCHEMA_VERSION = 2;
