import type { Category, Priority, Task } from '../lib/types.ts';
import { esc } from './dom.ts';
import { icon } from './icons.ts';
import { dueMeta, parseISO } from '../lib/dates.ts';
import { formatJalaliShort, toPersianDigits } from '../lib/jalali.ts';

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  high: { label: 'زیاد', color: 'var(--brand-danger)' },
  medium: { label: 'متوسط', color: 'var(--brand-warning)' },
  low: { label: 'کم', color: 'var(--brand-success)' },
};

const DUE_TONE_COLOR: Record<string, string> = {
  overdue: 'var(--brand-danger)',
  today: 'var(--brand-primary)',
  soon: 'var(--brand-warning)',
  normal: 'var(--text-secondary)',
};

function chip(label: string, color: string): string {
  return `<span class="chip" style="color:${color};background:color-mix(in srgb, ${color} 14%, transparent)">${label}</span>`;
}

/** Render one task as an accessible list item. All user text is escaped. */
export function renderTaskCard(task: Task, category: Category | undefined, draggable: boolean): string {
  const done = task.completed;
  const meta: string[] = [];

  if (task.dueDate) {
    const dm = dueMeta(task.dueDate);
    const due = parseISO(task.dueDate);
    if (due && dm) {
      const color = DUE_TONE_COLOR[dm.tone]!;
      meta.push(
        chip(
          `${icon('calendar', { size: 14 })}<span>${esc(formatJalaliShort(due))} · ${esc(dm.label)}</span>`,
          color,
        ),
      );
    }
  }

  const pm = PRIORITY_META[task.priority];
  meta.push(chip(`${icon('flag', { size: 14 })}${esc(pm.label)}`, pm.color));

  if (category) {
    meta.push(chip(`${icon('folder', { size: 14 })}${esc(category.name)}`, category.color));
  }

  if (task.subtasks.length > 0) {
    const doneCount = task.subtasks.filter((s) => s.done).length;
    meta.push(
      chip(
        `${icon('check', { size: 14 })}${toPersianDigits(doneCount)}/${toPersianDigits(task.subtasks.length)}`,
        'var(--text-secondary)',
      ),
    );
  }

  if (task.reminderAt) {
    meta.push(chip(icon('bell', { size: 14 }), 'var(--brand-accent)'));
  }
  if (task.recurring) {
    const freq = { daily: 'روزانه', weekly: 'هفتگی', monthly: 'ماهانه' }[task.recurring.freq];
    meta.push(chip(esc(freq), 'var(--brand-accent)'));
  }

  const notes = task.notes
    ? `<p class="mt-1 line-clamp-2 [overflow-wrap:anywhere] text-sm text-muted">${esc(task.notes)}</p>`
    : '';

  const handle = draggable
    ? `<button type="button" class="drag-handle btn btn-icon -ms-1 cursor-grab text-muted" aria-label="جابه‌جایی" data-action="noop" tabindex="-1">${icon('grip', { size: 18 })}</button>`
    : '';

  return `
    <li class="task-card animate-pop group relative flex items-start gap-2 rounded-2xl border border-line bg-surface p-3 transition-shadow hover:shadow-lg${
      done ? ' opacity-70' : ''
    }" data-id="${esc(task.id)}"${draggable ? ' draggable="true"' : ''}>
      <span aria-hidden="true" class="absolute inset-y-2 start-0 w-1 rounded-full" style="background:${esc(task.color)}"></span>
      ${handle}
      <input type="checkbox" class="task-check mt-1 size-5 shrink-0 accent-[var(--brand-success)]"
        ${done ? 'checked' : ''} data-action="toggle" data-id="${esc(task.id)}"
        aria-label="علامت انجام برای ${esc(task.title)}" />
      <div class="min-w-0 flex-1">
        <p class="font-semibold [overflow-wrap:anywhere] ${done ? 'text-muted line-through' : ''}">${esc(task.title)}</p>
        ${notes}
        <div class="mt-2 flex flex-wrap items-center gap-1.5">${meta.join('')}</div>
      </div>
      <div class="flex shrink-0 flex-col gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <button type="button" class="btn btn-icon text-muted" data-action="edit" data-id="${esc(task.id)}" aria-label="ویرایش ${esc(task.title)}">${icon('pencil', { size: 18 })}</button>
        <button type="button" class="btn btn-icon text-muted hover:text-[var(--brand-danger)]" data-action="delete" data-id="${esc(task.id)}" aria-label="حذف ${esc(task.title)}">${icon('trash', { size: 18 })}</button>
      </div>
    </li>`;
}
