import { describe, it, expect, beforeEach } from 'vitest';
import {
  store,
  replaceData,
  addTask,
  toggleComplete,
  deleteTask,
  undoLast,
  reorderTasks,
  selectLists,
  setSearch,
  setPriorityFilter,
  setStatusFilter,
  setCategoryFilter,
  setSortBy,
} from '../src/state/app.ts';
import type { AppData } from '../src/lib/types.ts';

function emptyData(): AppData {
  return {
    schemaVersion: 2,
    tasks: [],
    categories: [],
    settings: {
      theme: 'system',
      schemaVersion: 2,
      sortBy: 'manual',
      notificationsEnabled: false,
    },
  };
}

beforeEach(() => {
  replaceData(emptyData());
  setSearch('');
  setPriorityFilter('all');
  setCategoryFilter('all');
  setStatusFilter('all');
  setSortBy('manual');
});

const tasks = () => store.get().data.tasks;

describe('task CRUD + undo', () => {
  it('adds a task to the top', () => {
    addTask({ title: 'اول', priority: 'medium', color: '#6366f1' });
    addTask({ title: 'دوم', priority: 'medium', color: '#6366f1' });
    expect(tasks()).toHaveLength(2);
    expect(tasks()[0]!.title).toBe('دوم');
  });

  it('ignores blank titles', () => {
    addTask({ title: '   ', priority: 'low', color: '#6366f1' });
    expect(tasks()).toHaveLength(0);
  });

  it('undoes a delete', () => {
    addTask({ title: 'ماندگار', priority: 'low', color: '#6366f1' });
    addTask({ title: 'حذفی', priority: 'low', color: '#6366f1' });
    const victim = tasks().find((t) => t.title === 'حذفی')!;
    deleteTask(victim.id);
    expect(tasks()).toHaveLength(1);
    expect(undoLast()).toBe(true);
    expect(tasks()).toHaveLength(2);
    expect(tasks().some((t) => t.title === 'حذفی')).toBe(true);
  });
});

describe('recurring tasks', () => {
  it('spawns the next occurrence on completion', () => {
    addTask({
      title: 'ورزش',
      priority: 'medium',
      color: '#6366f1',
      dueDate: '2026-07-01',
      recurring: { freq: 'daily', interval: 2 },
    });
    const original = tasks()[0]!;
    toggleComplete(original.id);

    const all = tasks();
    expect(all).toHaveLength(2);
    const done = all.find((t) => t.id === original.id)!;
    const clone = all.find((t) => t.id !== original.id)!;
    expect(done.completed).toBe(true);
    expect(clone.completed).toBe(false);
    expect(clone.dueDate).toBe('2026-07-03'); // +2 days
    expect(clone.recurring).toEqual({ freq: 'daily', interval: 2 });
  });
});

describe('sorting + filtering', () => {
  it('manual reorder sets order', () => {
    addTask({ title: 'A', priority: 'low', color: '#6366f1' });
    addTask({ title: 'B', priority: 'low', color: '#6366f1' });
    addTask({ title: 'C', priority: 'low', color: '#6366f1' });
    const byTitle = (t: string) => tasks().find((x) => x.title === t)!.id;
    reorderTasks([byTitle('A'), byTitle('B'), byTitle('C')]);
    const { active } = selectLists(store.get());
    expect(active.map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });

  it('filters by priority and search', () => {
    addTask({ title: 'مهم', priority: 'high', color: '#6366f1' });
    addTask({ title: 'عادی', priority: 'low', color: '#6366f1' });
    setPriorityFilter('high');
    let lists = selectLists(store.get());
    expect(lists.active.map((t) => t.title)).toEqual(['مهم']);
    // counts reflect ALL tasks, not the filtered view
    expect(lists.counts.total).toBe(2);

    setPriorityFilter('all');
    setSearch('عادی');
    lists = selectLists(store.get());
    expect(lists.active.map((t) => t.title)).toEqual(['عادی']);
  });

  it('separates completed tasks', () => {
    addTask({ title: 'یکی', priority: 'low', color: '#6366f1' });
    toggleComplete(tasks()[0]!.id);
    const { active, completed, counts } = selectLists(store.get());
    expect(active).toHaveLength(0);
    expect(completed).toHaveLength(1);
    expect(counts.completed).toBe(1);
  });
});
