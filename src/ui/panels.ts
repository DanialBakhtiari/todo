import {
  store,
  addCategory,
  deleteCategory,
  setTheme,
  setNotificationsEnabled,
  replaceData,
} from '../state/app.ts';
import type { ThemePref } from '../lib/types.ts';
import { openModal } from './modal.ts';
import { create, esc, qs } from './dom.ts';
import { icon } from './icons.ts';
import { toast } from './toast.ts';
import { exportBackup, importBackup } from '../lib/storage.ts';
import {
  detectPlatform,
  installGuide,
  isStandalone,
  type InstallManager,
} from '../lib/platform.ts';
import {
  notificationsSupported,
  requestNotificationPermission,
} from '../lib/notifications.ts';

/* --------------------------------- Install -------------------------------- */

export function openInstallGuide(install: InstallManager): void {
  const wrap = create('div', 'flex flex-col gap-4');
  const platform = detectPlatform();
  const guides = [installGuide(platform)];
  // Also list the other platforms so the guide is always complete.
  (['ios', 'android', 'desktop'] as const)
    .filter((p) => p !== platform)
    .forEach((p) => guides.push(installGuide(p)));

  if (isStandalone()) {
    wrap.innerHTML = `<p class="rounded-2xl border border-line bg-surface p-4 text-sm">✅ اپ هم‌اکنون به‌صورت نصب‌شده اجرا می‌شود. از دسترسی سریع و آفلاین لذت ببرید!</p>`;
  }

  if (install.canPrompt) {
    const btn = create('button', 'btn btn-primary self-start');
    btn.type = 'button';
    btn.innerHTML = `${icon('install')} نصب اپلیکیشن`;
    btn.addEventListener('click', () => {
      void install.promptInstall().then((r) => {
        if (r === 'accepted') toast('اپ با موفقیت نصب شد 🎉', { tone: 'success' });
      });
    });
    wrap.appendChild(btn);
  }

  guides.forEach((g, i) => {
    const card = create('div', 'rounded-2xl border border-line bg-surface p-4');
    card.innerHTML = `
      <h3 class="mb-2 font-bold${i === 0 ? ' text-[var(--brand-primary)]' : ''}">${esc(g.heading)}</h3>
      <ol class="flex list-decimal flex-col gap-1 ps-5 text-sm text-muted">
        ${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}
      </ol>`;
    wrap.appendChild(card);
  });

  openModal('نصب اپلیکیشن', wrap);
}

/* --------------------------------- Settings ------------------------------- */

const THEME_LABELS: Record<ThemePref, string> = {
  light: 'روشن',
  dark: 'تیره',
  system: 'سیستم',
};

function themeSection(): HTMLElement {
  const section = create('div', 'field');
  const current = store.get().data.settings.theme;
  section.innerHTML = `<label>پوسته</label>
    <div class="flex gap-2" role="radiogroup" aria-label="انتخاب پوسته">
      ${(['light', 'dark', 'system'] as ThemePref[])
        .map(
          (t) => `<button type="button" role="radio" aria-checked="${t === current}"
            class="btn flex-1 ${t === current ? 'btn-primary' : 'btn-ghost'}" data-theme-opt="${t}">
            ${THEME_LABELS[t]}</button>`,
        )
        .join('')}
    </div>`;
  section.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-opt]');
    if (!btn) return;
    setTheme(btn.dataset['themeOpt'] as ThemePref);
    section
      .querySelectorAll<HTMLElement>('[data-theme-opt]')
      .forEach((b) => {
        const active = b === btn;
        b.setAttribute('aria-checked', String(active));
        b.className = `btn flex-1 ${active ? 'btn-primary' : 'btn-ghost'}`;
      });
  });
  return section;
}

function notificationsSection(): HTMLElement {
  const section = create('div', 'field');
  const enabled = store.get().data.settings.notificationsEnabled;
  const supported = notificationsSupported();
  section.innerHTML = `<label>یادآوری‌ها</label>
    <div class="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
      <span class="text-sm text-muted">${
        supported
          ? 'اعلان یادآوری برای کارهای دارای زمان یادآوری'
          : 'مرورگر شما از اعلان‌ها پشتیبانی نمی‌کند'
      }</span>
      <button type="button" class="switch" role="switch" aria-checked="${enabled}" aria-label="فعال‌سازی یادآوری" ${
        supported ? '' : 'disabled'
      }></button>
    </div>`;
  const sw = qs<HTMLButtonElement>('.switch', section);
  sw.addEventListener('click', () => {
    const turningOn = sw.getAttribute('aria-checked') !== 'true';
    if (turningOn) {
      void requestNotificationPermission().then((perm) => {
        if (perm === 'granted') {
          setNotificationsEnabled(true);
          sw.setAttribute('aria-checked', 'true');
          toast('یادآوری‌ها فعال شد.', { tone: 'success' });
        } else {
          toast('اجازه‌ی اعلان داده نشد.', { tone: 'danger' });
        }
      });
    } else {
      setNotificationsEnabled(false);
      sw.setAttribute('aria-checked', 'false');
    }
  });
  return section;
}

function categoriesSection(): HTMLElement {
  const section = create('div', 'field');
  section.innerHTML = `<label>دسته‌بندی‌ها</label><div data-cat-list class="flex flex-col gap-2"></div>`;
  const adder = create('div', 'mt-2 flex gap-2');
  adder.innerHTML = `
    <input type="text" data-cat-name class="input flex-1" placeholder="نام دسته جدید" maxlength="40" />
    <input type="color" data-cat-color class="h-10 w-12 p-1" value="#6366f1" />`;
  const addBtn = create('button', 'btn btn-ghost shrink-0');
  addBtn.type = 'button';
  addBtn.innerHTML = icon('plus');
  adder.appendChild(addBtn);
  section.appendChild(adder);

  const list = qs('[data-cat-list]', section);
  const nameInput = qs<HTMLInputElement>('[data-cat-name]', section);
  const colorInput = qs<HTMLInputElement>('[data-cat-color]', section);

  const render = (): void => {
    const cats = store.get().data.categories;
    list.innerHTML =
      cats.length === 0
        ? `<p class="text-sm text-muted">دسته‌ای وجود ندارد.</p>`
        : cats
            .map(
              (c) => `<div class="flex items-center gap-2" data-cat-id="${esc(c.id)}">
          <span class="size-4 rounded-full" style="background:${esc(c.color)}"></span>
          <span class="flex-1 text-sm">${esc(c.name)}</span>
          <button type="button" class="btn btn-icon !p-1 text-muted" data-cat-del aria-label="حذف دسته">${icon('trash', { size: 16 })}</button>
        </div>`,
            )
            .join('');
  };
  render();

  const add = (): void => {
    const name = nameInput.value.trim();
    if (!name) return;
    addCategory(name, colorInput.value || '#6366f1');
    nameInput.value = '';
    render();
  };
  addBtn.addEventListener('click', add);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  });
  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-cat-id]');
    if (row && (e.target as HTMLElement).closest('[data-cat-del]')) {
      deleteCategory(row.dataset['catId']!);
      render();
    }
  });
  return section;
}

function dataSection(): HTMLElement {
  const section = create('div', 'field');
  section.innerHTML = `<label>پشتیبان‌گیری داده‌ها</label>`;
  const row = create('div', 'flex flex-wrap gap-2');

  const exportBtn = create('button', 'btn btn-ghost');
  exportBtn.type = 'button';
  exportBtn.innerHTML = `${icon('download')} خروجی JSON`;
  exportBtn.addEventListener('click', () => {
    const json = exportBackup(store.get().data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    a.download = `my-tasks-backup-${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('نسخه‌ی پشتیبان دانلود شد.', { tone: 'success' });
  });

  const importBtn = create('button', 'btn btn-ghost');
  importBtn.type = 'button';
  importBtn.innerHTML = `${icon('upload')} بازیابی از فایل`;
  const fileInput = create('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      try {
        const data = importBackup(text);
        const count = data.tasks.length;
        if (
          window.confirm(
            `بازیابی ${count} کار از فایل پشتیبان؟ داده‌های فعلی جایگزین می‌شوند.`,
          )
        ) {
          replaceData(data);
          toast('داده‌ها با موفقیت بازیابی شد.', { tone: 'success' });
        }
      } catch {
        toast('فایل نامعتبر است.', { tone: 'danger' });
      }
      fileInput.value = '';
    });
  });

  row.append(exportBtn, importBtn, fileInput);
  section.appendChild(row);
  return section;
}

export function openSettings(): void {
  const wrap = create('div', 'flex flex-col gap-5');
  wrap.append(
    themeSection(),
    notificationsSection(),
    categoriesSection(),
    dataSection(),
  );
  openModal('تنظیمات', wrap);
}

/* ----------------------------------- Help --------------------------------- */

export function openHelp(install: InstallManager): void {
  const wrap = create('div', 'flex flex-col gap-4 text-sm leading-relaxed');
  wrap.innerHTML = `
    <p>«لیست کارهای من» یک برنامه‌ریز روزانه‌ی فارسی است که همه‌چیز روی دستگاه شما می‌ماند — سریع، خصوصی و آفلاین، حتی بدون اینترنت و بدون حساب کاربری.</p>
    <ul class="flex list-disc flex-col gap-1 ps-5 text-muted">
      <li>داده‌ها فقط در همین مرورگر ذخیره می‌شوند (localStorage).</li>
      <li>برای انتقال به دستگاه دیگر، از «تنظیمات ← خروجی JSON» استفاده کنید.</li>
      <li>میان‌برها: <kbd class="rounded bg-surface px-1">N</kbd> کار جدید، <kbd class="rounded bg-surface px-1">/</kbd> جستجو.</li>
    </ul>
    <p class="border-t border-line pt-3">
      طراحی و توسعه توسط
      <a href="https://danialbakhtiari.com" target="_blank" rel="author noopener"
        class="font-bold text-[var(--brand-primary)] hover:underline">دانیال بختیاری</a>
      —
      <a href="https://github.com/danialbakhtiari" target="_blank" rel="noopener"
        class="hover:underline">GitHub</a>
    </p>`;
  const btn = create('button', 'btn btn-primary self-start');
  btn.type = 'button';
  btn.innerHTML = `${icon('install')} راهنمای نصب`;
  btn.addEventListener('click', () => openInstallGuide(install));
  wrap.appendChild(btn);
  openModal('درباره و راهنما', wrap);
}
