import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateLegacy,
  importBackup,
  exportBackup,
  coerceData,
  loadData,
  LEGACY_KEY,
  DATA_KEY,
} from '../src/lib/storage.ts';
import { CURRENT_SCHEMA_VERSION } from '../src/lib/types.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('legacy migration', () => {
  it('converts old vanilla tasks without losing data', () => {
    const legacy = [
      {
        id: 'a1',
        title: 'کار قدیمی',
        completed: true,
        createdAt: 1700000000000,
        completedAt: 1700000500000,
        dueDate: '2024-01-01',
        color: '#ff0000',
      },
      { id: 'a2', title: 'کار دوم', completed: false, createdAt: 1700001000000 },
    ];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));

    const data = migrateLegacy();
    expect(data).not.toBeNull();
    expect(data!.tasks).toHaveLength(2);

    const [t1, t2] = data!.tasks;
    expect(t1!.title).toBe('کار قدیمی');
    expect(t1!.completed).toBe(true);
    expect(t1!.priority).toBe('medium'); // sensible default added
    expect(t1!.color).toBe('#ff0000');
    expect(t1!.dueDate).toBe('2024-01-01');
    expect(typeof t1!.createdAt).toBe('string'); // ms → ISO
    expect(t1!.subtasks).toEqual([]);
    expect(t2!.completed).toBe(false);
  });

  it('loadData auto-migrates when only the legacy key exists', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([{ id: 'x', title: 'X', completed: false, createdAt: 1700000000000 }]),
    );
    const data = loadData();
    expect(data.tasks).toHaveLength(1);
    // migration persisted under the new key
    expect(localStorage.getItem(DATA_KEY)).not.toBeNull();
  });
});

describe('import / export', () => {
  it('round-trips a backup', () => {
    const original = coerceData({
      tasks: [{ title: 'یک', priority: 'high', color: '#123456' }],
      categories: [{ id: 'c1', name: 'کار', color: '#6366f1' }],
      settings: { theme: 'dark', sortBy: 'priority', notificationsEnabled: true },
    });
    const json = exportBackup(original);
    const restored = importBackup(json);
    expect(restored.tasks[0]!.title).toBe('یک');
    expect(restored.tasks[0]!.priority).toBe('high');
    expect(restored.settings.theme).toBe('dark');
    expect(restored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('throws on invalid JSON', () => {
    expect(() => importBackup('{ not json')).toThrow();
  });

  it('defensively coerces malformed task data', () => {
    const data = coerceData({ tasks: [{}, { title: 42 }, 'garbage'] });
    expect(data.tasks).toHaveLength(3);
    // invalid values fall back to safe defaults
    expect(data.tasks.every((t) => typeof t.title === 'string')).toBe(true);
    expect(data.tasks.every((t) => /^#/.test(t.color))).toBe(true);
    expect(data.tasks.every((t) => t.priority === 'medium')).toBe(true);
  });
});
