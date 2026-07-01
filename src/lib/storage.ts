import {
  CURRENT_SCHEMA_VERSION,
  type AppData,
  type AppSettings,
  type Category,
  type Priority,
  type Task,
} from './types.ts';
import { uid } from './id.ts';
import { nowISO } from './dates.ts';

/** New unified storage key (single serialisable blob). */
const DATA_KEY = 'mytasks:data:v2';
/** Legacy key written by the original vanilla app. */
const LEGACY_KEY = 'todo-vanilla-tasks-v2';

export class StorageQuotaError extends Error {
  constructor() {
    super('حافظه‌ی مرورگر پر شده است.');
    this.name = 'StorageQuotaError';
  }
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function defaultSettings(): AppSettings {
  return {
    theme: 'system',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sortBy: 'manual',
    notificationsEnabled: false,
  };
}

function seedCategories(): Category[] {
  return [
    { id: uid(), name: 'کار', color: '#6366f1' },
    { id: uid(), name: 'شخصی', color: '#a855f7' },
    { id: uid(), name: 'خرید', color: '#22c55e' },
  ];
}

function defaultData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [],
    categories: seedCategories(),
    settings: defaultSettings(),
  };
}

/* -------------------------------------------------------------------------- */
/* Defensive coercion (used by both import and migration)                      */
/* -------------------------------------------------------------------------- */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;

const bool = (v: unknown): boolean => v === true;

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const priority = (v: unknown): Priority =>
  PRIORITIES.includes(v as Priority) ? (v as Priority) : 'medium';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const color = (v: unknown): string => (typeof v === 'string' && HEX.test(v) ? v : '#6366f1');

/** Milliseconds-or-ISO → ISO string. */
function toISOMaybe(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof v === 'string' && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function coerceTask(raw: unknown, index: number): Task {
  const r = isRecord(raw) ? raw : {};
  const created = toISOMaybe(r['createdAt']) ?? nowISO();
  const subtasks = Array.isArray(r['subtasks'])
    ? r['subtasks'].filter(isRecord).map((s) => ({
        id: str(s['id']) || uid(),
        title: str(s['title']),
        done: bool(s['done']),
      }))
    : [];

  const task: Task = {
    id: str(r['id']) || uid(),
    title: str(r['title']),
    priority: priority(r['priority']),
    color: color(r['color']),
    subtasks,
    completed: bool(r['completed']),
    createdAt: created,
    updatedAt: toISOMaybe(r['updatedAt']) ?? created,
    order: typeof r['order'] === 'number' ? r['order'] : index,
  };

  const notes = str(r['notes']);
  if (notes) task.notes = notes;
  const due = str(r['dueDate']);
  if (due) task.dueDate = due;
  const catId = str(r['categoryId']);
  if (catId) task.categoryId = catId;
  const completedAt = toISOMaybe(r['completedAt']);
  if (task.completed && completedAt) task.completedAt = completedAt;
  const reminderAt = toISOMaybe(r['reminderAt']);
  if (reminderAt) task.reminderAt = reminderAt;
  if (isRecord(r['recurring'])) {
    const rec = r['recurring'];
    const freq = rec['freq'];
    if (freq === 'daily' || freq === 'weekly' || freq === 'monthly') {
      const interval = typeof rec['interval'] === 'number' ? rec['interval'] : 1;
      task.recurring = { freq, interval: Math.max(1, Math.floor(interval)) };
    }
  }
  return task;
}

function coerceCategory(raw: unknown): Category | null {
  if (!isRecord(raw)) return null;
  const name = str(raw['name']).trim();
  if (!name) return null;
  return { id: str(raw['id']) || uid(), name, color: color(raw['color']) };
}

function coerceSettings(raw: unknown): AppSettings {
  const base = defaultSettings();
  if (!isRecord(raw)) return base;
  const theme = raw['theme'];
  if (theme === 'light' || theme === 'dark' || theme === 'system') base.theme = theme;
  const sortBy = raw['sortBy'];
  if (
    sortBy === 'manual' ||
    sortBy === 'dueDate' ||
    sortBy === 'priority' ||
    sortBy === 'createdAt'
  ) {
    base.sortBy = sortBy;
  }
  base.notificationsEnabled = bool(raw['notificationsEnabled']);
  return base;
}

/** Build a valid AppData from arbitrary parsed JSON (import / new-format read). */
export function coerceData(raw: unknown): AppData {
  const r = isRecord(raw) ? raw : {};
  const tasks = Array.isArray(r['tasks'])
    ? r['tasks'].map((t, i) => coerceTask(t, i))
    : [];
  const categories = Array.isArray(r['categories'])
    ? r['categories'].map(coerceCategory).filter((c): c is Category => c !== null)
    : seedCategories();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks,
    categories,
    settings: coerceSettings(r['settings']),
  };
}

/* -------------------------------------------------------------------------- */
/* Migration from the legacy vanilla app                                  */
/* -------------------------------------------------------------------------- */

export function migrateLegacy(): AppData | null {
  const raw = safeGet(LEGACY_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tasks = parsed.map((t, i) => coerceTask(t, i));
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks,
      categories: seedCategories(),
      settings: defaultSettings(),
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                             */
/* -------------------------------------------------------------------------- */

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadData(): AppData {
  const raw = safeGet(DATA_KEY);
  if (raw) {
    try {
      return coerceData(JSON.parse(raw));
    } catch {
      // fall through to migration / defaults on corrupt JSON
    }
  }
  const migrated = migrateLegacy();
  if (migrated) {
    saveData(migrated); // persist migrated data under the new key
    return migrated;
  }
  return defaultData();
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

/** Serialise current data for a JSON backup file. */
export function exportBackup(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/** Parse + validate an imported backup file. Throws on invalid JSON. */
export function importBackup(json: string): AppData {
  const parsed: unknown = JSON.parse(json);
  return coerceData(parsed);
}

export { DATA_KEY, LEGACY_KEY };
