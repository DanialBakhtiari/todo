import type { Priority, RecurrenceFreq, Subtask, Task } from '../lib/types.ts';
import { store, addTask, updateTask } from '../state/app.ts';
import { openModal } from './modal.ts';
import { create, esc, qs } from './dom.ts';
import { icon } from './icons.ts';
import { uid } from '../lib/id.ts';

function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function categoryOptions(selected: string | undefined): string {
  const cats = store.get().data.categories;
  const none = `<option value="">بدون دسته</option>`;
  return (
    none +
    cats
      .map(
        (c) =>
          `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(
            c.name,
          )}</option>`,
      )
      .join('')
  );
}

function priorityOptions(selected: Priority): string {
  const opts: [Priority, string][] = [
    ['low', 'کم'],
    ['medium', 'متوسط'],
    ['high', 'زیاد'],
  ];
  return opts
    .map(
      ([v, l]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${l}</option>`,
    )
    .join('');
}

function recurringOptions(freq: RecurrenceFreq | ''): string {
  const opts: [string, string][] = [
    ['', 'بدون تکرار'],
    ['daily', 'روزانه'],
    ['weekly', 'هفتگی'],
    ['monthly', 'ماهانه'],
  ];
  return opts
    .map(
      ([v, l]) => `<option value="${v}"${v === freq ? ' selected' : ''}>${l}</option>`,
    )
    .join('');
}

/** Shared task form used for both creating and editing. */
function openEditor(existing: Task | null): void {
  const isEdit = existing !== null;
  const form = create('form', 'flex flex-col gap-4');
  form.noValidate = true;

  form.innerHTML = `
    <div class="field">
      <label for="f-title">عنوان کار *</label>
      <input id="f-title" name="title" type="text" required maxlength="200"
        placeholder="مثلاً: تمرین جاوااسکریپت" />
    </div>
    <div class="field">
      <label for="f-notes">یادداشت</label>
      <textarea id="f-notes" name="notes" rows="2" maxlength="1000"
        placeholder="جزئیات بیشتر (اختیاری)"></textarea>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="field">
        <label for="f-due">تاریخ موعد (میلادی)</label>
        <input id="f-due" name="dueDate" type="date" />
      </div>
      <div class="field">
        <label for="f-reminder">یادآوری</label>
        <input id="f-reminder" name="reminderAt" type="datetime-local" />
      </div>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="field">
        <label for="f-priority">اولویت</label>
        <select id="f-priority" name="priority">${priorityOptions(
          existing?.priority ?? 'medium',
        )}</select>
      </div>
      <div class="field">
        <label for="f-category">دسته‌بندی</label>
        <select id="f-category" name="categoryId">${categoryOptions(
          existing?.categoryId,
        )}</select>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="field">
        <label for="f-color">رنگ</label>
        <input id="f-color" name="color" type="color" class="h-10 p-1" value="${esc(
          existing?.color ?? '#6366f1',
        )}" />
      </div>
      <div class="field">
        <label for="f-freq">تکرار</label>
        <select id="f-freq" name="freq">${recurringOptions(
          existing?.recurring?.freq ?? '',
        )}</select>
      </div>
      <div class="field" data-interval hidden>
        <label for="f-interval">هر چند بار</label>
        <input id="f-interval" name="interval" type="number" min="1" value="${
          existing?.recurring?.interval ?? 1
        }" />
      </div>
    </div>
  `;

  // --- Subtasks (edit mode only) -------------------------------------------
  let subtasks: Subtask[] = existing ? existing.subtasks.map((s) => ({ ...s })) : [];
  if (isEdit) {
    const wrap = create('div', 'field');
    wrap.innerHTML = `<label>زیرکارها</label><div data-sub-list class="flex flex-col gap-2"></div>`;
    const adder = create('div', 'mt-2 flex gap-2');
    adder.innerHTML = `<input type="text" data-sub-input class="input flex-1" placeholder="افزودن زیرکار…" maxlength="200" />`;
    const addBtn = create('button', 'btn btn-ghost shrink-0');
    addBtn.type = 'button';
    addBtn.innerHTML = icon('plus');
    adder.appendChild(addBtn);
    wrap.appendChild(adder);
    form.appendChild(wrap);

    const listEl = qs('[data-sub-list]', wrap);
    const subInput = qs<HTMLInputElement>('[data-sub-input]', wrap);

    const renderSubs = (): void => {
      if (subtasks.length === 0) {
        listEl.innerHTML = `<p class="text-sm text-muted">هنوز زیرکاری اضافه نشده.</p>`;
        return;
      }
      listEl.innerHTML = subtasks
        .map(
          (s) => `
        <div class="flex items-center gap-2" data-sub-id="${esc(s.id)}">
          <input type="checkbox" class="size-4" ${s.done ? 'checked' : ''} data-sub-toggle />
          <span class="flex-1 text-sm${s.done ? ' text-muted line-through' : ''}">${esc(s.title)}</span>
          <button type="button" class="btn btn-icon !p-1 text-muted" data-sub-del aria-label="حذف زیرکار">${icon('x', { size: 16 })}</button>
        </div>`,
        )
        .join('');
    };
    renderSubs();

    const addSub = (): void => {
      const v = subInput.value.trim();
      if (!v) return;
      subtasks.push({ id: uid(), title: v, done: false });
      subInput.value = '';
      renderSubs();
      subInput.focus();
    };
    addBtn.addEventListener('click', addSub);
    subInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSub();
      }
    });
    listEl.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-sub-id]');
      if (!row) return;
      const id = row.dataset['subId']!;
      if ((e.target as HTMLElement).closest('[data-sub-del]')) {
        subtasks = subtasks.filter((s) => s.id !== id);
        renderSubs();
      } else if ((e.target as HTMLElement).closest('[data-sub-toggle]')) {
        subtasks = subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
      }
    });
  }

  // --- Footer actions -------------------------------------------------------
  const footer = create('div', 'mt-2 flex items-center justify-end gap-2');
  const cancel = create('button', 'btn btn-ghost');
  cancel.type = 'button';
  cancel.textContent = 'انصراف';
  const submit = create('button', 'btn btn-primary');
  submit.type = 'submit';
  submit.innerHTML = `${icon('check')} ${isEdit ? 'ذخیره تغییرات' : 'افزودن کار'}`;
  footer.append(cancel, submit);
  form.appendChild(footer);

  const close = openModal(isEdit ? 'ویرایش کار' : 'کار جدید', form);
  cancel.addEventListener('click', close);

  // Prefill values that carry user text (avoids attribute-escaping pitfalls).
  const titleEl = qs<HTMLInputElement>('#f-title', form);
  titleEl.value = existing?.title ?? '';
  qs<HTMLTextAreaElement>('#f-notes', form).value = existing?.notes ?? '';
  qs<HTMLInputElement>('#f-due', form).value = existing?.dueDate ?? '';
  qs<HTMLInputElement>('#f-reminder', form).value = toLocalInput(existing?.reminderAt);

  // Recurrence interval visibility.
  const freqEl = qs<HTMLSelectElement>('#f-freq', form);
  const intervalWrap = qs<HTMLElement>('[data-interval]', form);
  const syncInterval = (): void => {
    intervalWrap.hidden = freqEl.value === '';
  };
  freqEl.addEventListener('change', syncInterval);
  syncInterval();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') ?? '').trim();
    if (!title) {
      titleEl.focus();
      titleEl.setAttribute('aria-invalid', 'true');
      return;
    }
    const freq = String(fd.get('freq') ?? '') as RecurrenceFreq | '';
    const reminderRaw = String(fd.get('reminderAt') ?? '');
    const recurring =
      freq === ''
        ? undefined
        : {
            freq,
            interval: Math.max(1, Number(fd.get('interval') ?? 1) || 1),
          };

    const patch = {
      title,
      notes: String(fd.get('notes') ?? '').trim() || undefined,
      dueDate: String(fd.get('dueDate') ?? '') || undefined,
      priority: String(fd.get('priority') ?? 'medium') as Priority,
      color: String(fd.get('color') ?? '#6366f1'),
      categoryId: String(fd.get('categoryId') ?? '') || undefined,
      reminderAt: reminderRaw ? new Date(reminderRaw).toISOString() : undefined,
      recurring,
    };

    if (existing) {
      updateTask(existing.id, { ...patch, subtasks });
    } else {
      addTask(patch);
    }
    close();
  });
}

export function openTaskEditor(task: Task): void {
  openEditor(task);
}

export function openTaskCreator(): void {
  openEditor(null);
}
