import {
  store,
  selectLists,
  categoryById,
  addTask,
  toggleComplete,
  deleteTask,
  reorderTasks,
  setSearch,
  setStatusFilter,
  setPriorityFilter,
  setCategoryFilter,
  setSortBy,
  setTheme,
  takePendingUndoLabel,
  undoLast,
} from '../state/app.ts';
import type { AppState, UIState } from '../state/app.ts';
import type { Priority, SortBy, StatusFilter } from '../lib/types.ts';
import { delegate, esc, qs } from './dom.ts';
import { icon } from './icons.ts';
import { renderTaskCard } from './taskCard.ts';
import { openTaskEditor } from './editModal.ts';
import { openSettings, openHelp, openInstallGuide } from './panels.ts';
import { toast } from './toast.ts';
import { effectiveTheme } from './theme.ts';
import { makeSortable } from './dnd.ts';
import type { InstallManager } from '../lib/platform.ts';

export interface ViewApi {
  focusSearch: () => void;
}

const STATUS_TABS: [StatusFilter, string][] = [
  ['all', 'همه'],
  ['active', 'در حال انجام'],
  ['completed', 'انجام‌شده'],
];

function priorityAddOptions(): string {
  return `<option value="medium">متوسط</option><option value="high">زیاد</option><option value="low">کم</option>`;
}
function priorityFilterOptions(): string {
  return `<option value="all">همه اولویت‌ها</option><option value="high">زیاد</option><option value="medium">متوسط</option><option value="low">کم</option>`;
}
function sortOptions(): string {
  return `<option value="manual">مرتب‌سازی: دستی</option><option value="createdAt">جدیدترین</option><option value="dueDate">نزدیک‌ترین موعد</option><option value="priority">اولویت</option>`;
}

function catOptions(selected: string | undefined, includeAll: boolean): string {
  const cats = store.get().data.categories;
  const head = includeAll
    ? `<option value="all">همه دسته‌ها</option>`
    : `<option value="">بدون دسته</option>`;
  return (
    head +
    cats
      .map(
        (c) =>
          `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`,
      )
      .join('')
  );
}

const isFiltering = (ui: UIState): boolean =>
  ui.search.trim() !== '' || ui.priority !== 'all' || ui.categoryId !== 'all';

function shell(): string {
  return `
  <a class="skip-link btn btn-primary" href="#main-content">پرش به فهرست کارها</a>
  <div class="app-shell mx-auto my-4 flex w-full max-w-5xl flex-col gap-5 p-4 sm:my-8 sm:gap-6 sm:p-6">
    <header class="flex flex-col gap-4 border-b border-line pb-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold sm:text-3xl">
            <span class="bg-[image:var(--grad-brand)] bg-clip-text text-transparent">لیست کارهای من</span>
          </h1>
          <p class="mt-1 text-sm text-muted">برنامه‌ریز روزانه با تقویم شمسی — سریع، خصوصی و آفلاین</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button type="button" data-ref="install" class="btn btn-ghost !hidden sm:!inline-flex" hidden>${icon('install')}<span class="hidden md:inline">نصب</span></button>
          <button type="button" data-ref="theme" class="btn btn-icon" aria-label="تغییر پوسته"></button>
          <button type="button" data-ref="settings" class="btn btn-icon" aria-label="تنظیمات">${icon('settings')}</button>
          <button type="button" data-ref="help" class="btn btn-icon" aria-label="راهنما">${icon('info')}</button>
        </div>
      </div>
      <div class="flex flex-col gap-1 border-t border-line pt-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
        <span class="flex items-center gap-1.5 tabular-nums text-muted"><span class="shrink-0">${icon('calendar', { size: 16 })}</span><span data-ref="clock-greg"></span></span>
        <span class="whitespace-nowrap font-semibold tabular-nums text-[var(--brand-warning)]" data-ref="clock-jalali"></span>
      </div>
    </header>

    <main id="main-content" class="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
      <aside class="flex flex-col gap-5">
        <section class="card p-4" aria-labelledby="add-h">
          <h2 id="add-h" class="mb-3 font-bold">افزودن کار جدید</h2>
          <form data-ref="add-form" class="flex flex-col gap-3" novalidate>
            <div class="field">
              <label for="q-title">عنوان کار</label>
              <input id="q-title" name="title" type="text" required maxlength="200" autocomplete="off" placeholder="مثلاً: تمرین جاوااسکریپت" />
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="field"><label for="q-due">موعد</label><input id="q-due" name="dueDate" type="date" /></div>
              <div class="field"><label for="q-priority">اولویت</label><select id="q-priority" name="priority">${priorityAddOptions()}</select></div>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="field"><label for="q-cat">دسته</label><select id="q-cat" name="categoryId" data-ref="add-cat">${catOptions('', false)}</select></div>
              <div class="field"><label for="q-color">رنگ</label><input id="q-color" name="color" type="color" value="#6366f1" class="h-10 p-1" /></div>
            </div>
            <button type="submit" class="btn btn-primary">${icon('plus')} افزودن کار</button>
          </form>
        </section>

        <section class="card p-4" aria-labelledby="stats-h">
          <h2 id="stats-h" class="mb-3 font-bold">آمار</h2>
          <div class="mb-1 flex items-center justify-between text-xs text-muted">
            <span>پیشرفت</span><span data-ref="progress-label">۰٪</span>
          </div>
          <div class="mb-4 h-2.5 overflow-hidden rounded-full bg-base" role="progressbar" aria-label="درصد پیشرفت" data-ref="progressbar">
            <div data-ref="progress" class="h-full rounded-full bg-[image:var(--grad-brand)] transition-[width] duration-500" style="width:0%"></div>
          </div>
          <dl class="flex flex-col gap-2 text-sm">
            <div class="flex items-center justify-between"><dt>در حال انجام</dt><dd class="chip" style="color:var(--brand-primary);background:color-mix(in srgb,var(--brand-primary) 14%,transparent)" data-ref="stat-active">۰</dd></div>
            <div class="flex items-center justify-between"><dt>انجام‌شده</dt><dd class="chip" style="color:var(--brand-success);background:color-mix(in srgb,var(--brand-success) 14%,transparent)" data-ref="stat-completed">۰</dd></div>
            <div class="flex items-center justify-between"><dt>کل کارها</dt><dd class="chip" style="color:var(--brand-warning);background:color-mix(in srgb,var(--brand-warning) 14%,transparent)" data-ref="stat-total">۰</dd></div>
          </dl>
        </section>
      </aside>

      <section class="flex min-w-0 flex-col gap-4">
        <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
          <div class="field flex-1">
            <label class="sr-only" for="search">جستجو</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">${icon('search', { size: 18 })}</span>
              <input id="search" data-ref="search" type="search" class="input ps-9" placeholder="جستجوی کارها…" autocomplete="off" />
            </div>
          </div>
          <div class="field"><label class="sr-only" for="fp">اولویت</label><select id="fp" data-ref="filter-priority">${priorityFilterOptions()}</select></div>
          <div class="field"><label class="sr-only" for="fc">دسته</label><select id="fc" data-ref="filter-category">${catOptions('all', true)}</select></div>
          <div class="field"><label class="sr-only" for="fs">مرتب‌سازی</label><select id="fs" data-ref="sort">${sortOptions()}</select></div>
        </div>

        <div role="tablist" aria-label="فیلتر وضعیت" class="flex flex-wrap gap-2" data-ref="status-tabs">
          ${STATUS_TABS.map(
            ([v, l]) =>
              `<button type="button" role="tab" class="btn btn-ghost" data-status="${v}">${l}</button>`,
          ).join('')}
        </div>

        <section data-ref="active-section" aria-labelledby="active-h">
          <h2 id="active-h" class="mb-2 flex items-center gap-2 font-bold">در حال انجام
            <span class="chip" style="color:var(--brand-primary);background:color-mix(in srgb,var(--brand-primary) 14%,transparent)" data-ref="active-badge">۰</span>
          </h2>
          <ul data-ref="active-list" class="flex flex-col gap-2.5"></ul>
          <div data-ref="active-empty" class="hidden"></div>
        </section>

        <section data-ref="completed-section">
          <h2 class="mb-2 flex items-center gap-2 font-bold text-muted">انجام‌شده
            <span class="chip" style="color:var(--brand-success);background:color-mix(in srgb,var(--brand-success) 14%,transparent)" data-ref="completed-badge">۰</span>
          </h2>
          <ul data-ref="completed-list" class="flex flex-col gap-2.5"></ul>
          <p data-ref="completed-empty" class="hidden text-sm text-muted">هنوز کاری کامل نشده.</p>
        </section>
      </section>
    </main>

    <footer class="mt-1 flex flex-col items-center gap-2.5 border-t border-line pt-4 text-center text-xs text-muted">
      <p>
        طراحی و توسعه توسط
        <a href="https://danialbakhtiari.com" target="_blank" rel="author noopener"
          class="font-bold text-[var(--brand-primary)] hover:underline">دانیال بختیاری</a>
      </p>
      <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <a href="https://danialbakhtiari.com" target="_blank" rel="noopener"
          class="inline-flex items-center gap-1 transition-colors hover:text-ink"
          aria-label="وب‌سایت دانیال بختیاری">${icon('globe', { size: 15 })}<span>danialbakhtiari.com</span></a>
        <a href="https://github.com/danialbakhtiari" target="_blank" rel="noopener"
          class="inline-flex items-center gap-1 transition-colors hover:text-ink"
          aria-label="گیت‌هاب دانیال بختیاری">${icon('github', { size: 15 })}<span>GitHub</span></a>
        <button type="button" data-ref="footer-install"
          class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink">راهنمای نصب</button>
      </div>
      <p class="opacity-70">داده‌ها فقط روی همین دستگاه ذخیره می‌شوند</p>
    </footer>
  </div>`;
}

export function mountApp(root: HTMLElement, deps: { install: InstallManager }): ViewApi {
  root.innerHTML = shell();
  root.removeAttribute('aria-busy');

  const refs = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-ref]').forEach((el) => {
    refs.set(el.dataset['ref']!, el);
  });
  const r = <T extends HTMLElement = HTMLElement>(name: string): T =>
    refs.get(name) as T;

  let prevCategories = store.get().data.categories;

  /* --------------------------------- Wiring ------------------------------- */

  // Quick add
  r<HTMLFormElement>('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return;
    addTask({
      title,
      priority: String(fd.get('priority') ?? 'medium') as Priority,
      color: String(fd.get('color') ?? '#6366f1'),
      dueDate: String(fd.get('dueDate') ?? '') || undefined,
      categoryId: String(fd.get('categoryId') ?? '') || undefined,
    });
    form.reset();
    qs<HTMLInputElement>('#q-color', form).value = '#6366f1';
    qs<HTMLInputElement>('#q-title', form).focus();
  });

  // Search (debounced)
  let searchTimer = 0;
  r<HTMLInputElement>('search').addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => setSearch(value), 120);
  });

  r<HTMLSelectElement>('filter-priority').addEventListener('change', (e) =>
    setPriorityFilter((e.target as HTMLSelectElement).value as Priority | 'all'),
  );
  r<HTMLSelectElement>('filter-category').addEventListener('change', (e) =>
    setCategoryFilter((e.target as HTMLSelectElement).value),
  );
  r<HTMLSelectElement>('sort').addEventListener('change', (e) =>
    setSortBy((e.target as HTMLSelectElement).value as SortBy),
  );

  r('status-tabs').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-status]');
    if (btn) setStatusFilter(btn.dataset['status'] as StatusFilter);
  });

  r('theme').addEventListener('click', () => {
    const next = effectiveTheme(store.get().data.settings.theme) === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
  r('settings').addEventListener('click', () => openSettings());
  r('help').addEventListener('click', () => openHelp(deps.install));
  r('install').addEventListener('click', () => {
    void deps.install.promptInstall().then((res) => {
      if (res === 'unavailable') openInstallGuide(deps.install);
      else if (res === 'accepted') toast('اپ نصب شد 🎉', { tone: 'success' });
    });
  });
  r('footer-install').addEventListener('click', () => openInstallGuide(deps.install));

  // Task list interactions (event delegation on the root)
  const showUndo = (): void => {
    const label = takePendingUndoLabel();
    if (label) toast(label, { actionLabel: 'بازگردانی', onAction: () => undoLast() });
  };
  delegate(root, 'change', '.task-check', (_e, el) => {
    toggleComplete(el.dataset['id']!);
    showUndo();
  });
  delegate(root, 'click', '[data-action="edit"]', (_e, el) => {
    const task = store.get().data.tasks.find((t) => t.id === el.dataset['id']);
    if (task) openTaskEditor(task);
  });
  delegate(root, 'click', '[data-action="delete"]', (_e, el) => {
    deleteTask(el.dataset['id']!);
    showUndo();
  });

  // Drag & drop reorder on the active list
  makeSortable(r('active-list'), {
    handle: '.drag-handle',
    itemSelector: '.task-card',
    onReorder: (ids) => reorderTasks(ids),
  });

  /* --------------------------------- Render ------------------------------- */

  function renderLists(state: AppState): void {
    const { active, completed, counts } = selectLists(state);
    const { ui } = state;
    const manual = state.data.settings.sortBy === 'manual';

    const activeSection = r('active-section');
    const completedSection = r('completed-section');
    activeSection.hidden = ui.status === 'completed';
    completedSection.hidden = ui.status === 'active';

    r('active-list').innerHTML = active
      .map((t) => renderTaskCard(t, categoryById(state, t.categoryId), manual))
      .join('');
    r('completed-list').innerHTML = completed
      .map((t) => renderTaskCard(t, categoryById(state, t.categoryId), false))
      .join('');

    r('active-badge').textContent = String(active.length);
    r('completed-badge').textContent = String(completed.length);

    // Empty states
    const activeEmpty = r('active-empty');
    if (active.length === 0) {
      activeEmpty.classList.remove('hidden');
      if (counts.total === 0) {
        activeEmpty.className =
          'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line p-8 text-center';
        activeEmpty.innerHTML = `<span class="text-4xl">🌱</span><p class="font-semibold">هنوز کاری اضافه نکرده‌اید</p><p class="text-sm text-muted">با فرم «افزودن کار جدید» شروع کنید.</p>`;
      } else {
        activeEmpty.className = 'rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted';
        activeEmpty.textContent = isFiltering(ui)
          ? 'کاری مطابق فیلتر پیدا نشد.'
          : 'همه‌ی کارها انجام شده! 🎉';
      }
    } else {
      activeEmpty.classList.add('hidden');
    }

    const completedEmpty = r('completed-empty');
    completedEmpty.classList.toggle('hidden', completed.length !== 0);

    // Stats
    const pct = counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100);
    r('progress').style.width = `${pct}%`;
    r('progressbar').setAttribute('aria-valuenow', String(pct));
    r('progress-label').textContent = `${new Intl.NumberFormat('fa-IR').format(pct)}٪`;
    const fa = (n: number): string => new Intl.NumberFormat('fa-IR').format(n);
    r('stat-active').textContent = fa(counts.active);
    r('stat-completed').textContent = fa(counts.completed);
    r('stat-total').textContent = fa(counts.total);
  }

  function renderControls(state: AppState): void {
    const { ui, data } = state;

    // Status tabs active state
    r('status-tabs')
      .querySelectorAll<HTMLElement>('[data-status]')
      .forEach((b) => {
        const active = b.dataset['status'] === ui.status;
        b.className = `btn ${active ? 'btn-primary' : 'btn-ghost'}`;
        b.setAttribute('aria-selected', String(active));
      });

    // Keep selects in sync with state
    r<HTMLSelectElement>('filter-priority').value = ui.priority;
    r<HTMLSelectElement>('sort').value = data.settings.sortBy;

    // Rebuild category-dependent selects only when categories change
    if (data.categories !== prevCategories) {
      prevCategories = data.categories;
      const addCat = r<HTMLSelectElement>('add-cat');
      const addVal = addCat.value;
      addCat.innerHTML = catOptions(addVal, false);
      const filterCat = r<HTMLSelectElement>('filter-category');
      filterCat.innerHTML = catOptions(
        ui.categoryId === 'all' ? undefined : ui.categoryId,
        true,
      );
      filterCat.value = data.categories.some((c) => c.id === ui.categoryId)
        ? ui.categoryId
        : 'all';
    } else {
      r<HTMLSelectElement>('filter-category').value = ui.categoryId;
    }

    // Theme toggle icon reflects the *opposite* action
    const isDark = effectiveTheme(data.settings.theme) === 'dark';
    r('theme').innerHTML = isDark ? icon('sun') : icon('moon');

    // Install button visibility
    const installBtn = r('install');
    const canShow = deps.install.canPrompt && !deps.install.isInstalled;
    installBtn.hidden = !canShow;
    installBtn.classList.toggle('!hidden', !canShow);
  }

  function render(state: AppState): void {
    renderControls(state);
    renderLists(state);
  }

  store.subscribe((state) => render(state));
  deps.install.subscribe(() => renderControls(store.get()));
  render(store.get());

  return {
    focusSearch: () => {
      const s = r<HTMLInputElement>('search');
      s.focus();
      s.select();
    },
  };
}
