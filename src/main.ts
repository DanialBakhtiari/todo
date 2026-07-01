import './styles/app.css';
import '@fontsource-variable/vazirmatn';

import { registerSW } from 'virtual:pwa-register';
import { store, onStateError } from './state/app.ts';
import { mountApp } from './ui/view.ts';
import { applyTheme, watchSystemTheme } from './ui/theme.ts';
import { InstallManager } from './lib/platform.ts';
import { ReminderScheduler } from './lib/notifications.ts';
import { formatGregorianLong } from './lib/dates.ts';
import { formatJalaliLong } from './lib/jalali.ts';
import { initKeyboardShortcuts } from './ui/keyboard.ts';
import { openTaskCreator } from './ui/editModal.ts';
import { toast } from './ui/toast.ts';

/* ------------------------------ Theme ---------------------------- */
applyTheme(store.get().data.settings.theme);
watchSystemTheme(() => store.get().data.settings.theme);
store.subscribe((s, p) => {
  if (s.data.settings.theme !== p.data.settings.theme) {
    applyTheme(s.data.settings.theme);
  }
});

/* --------------------------- Storage error toasts ------------------------- */
onStateError((message) => toast(message, { tone: 'danger', duration: 8000 }));

/* ------------------------------- Install (PWA) ---------------------------- */
const install = new InstallManager();
install.init();

/* --------------------------------- Mount UI ------------------------------- */
const appRoot = document.getElementById('app');
if (!appRoot) throw new Error('#app root missing');
const view = mountApp(appRoot, { install });

/* ------------------- Live Gregorian + Jalali clock --------------- */
const clockGreg = document.querySelector<HTMLElement>('[data-ref="clock-greg"]');
const clockJalali = document.querySelector<HTMLElement>('[data-ref="clock-jalali"]');
function tick(): void {
  const now = new Date();
  if (clockGreg) clockGreg.textContent = formatGregorianLong(now);
  if (clockJalali) clockJalali.textContent = formatJalaliLong(now);
}
tick();
window.setInterval(tick, 1000);

/* ------------------------------ Keyboard (#20) ---------------------------- */
initKeyboardShortcuts({ onNew: openTaskCreator, onSearch: view.focusSearch });

/* --------------------------- Reminders (#18) ------------------------------ */
const scheduler = new ReminderScheduler(() => store.get().data.tasks);
function syncScheduler(): void {
  if (store.get().data.settings.notificationsEnabled) scheduler.start();
  else scheduler.stop();
}
syncScheduler();
store.subscribe((s, p) => {
  if (s.data.settings.notificationsEnabled !== p.data.settings.notificationsEnabled) {
    syncScheduler();
  }
});

/* ---------------------- Service worker update flow ----------------- */
const updateSW = registerSW({
  onNeedRefresh() {
    toast('نسخه‌ی جدید در دسترس است.', {
      actionLabel: 'بارگذاری مجدد',
      onAction: () => void updateSW(true),
      duration: 0,
    });
  },
  onOfflineReady() {
    toast('اپ برای استفاده‌ی آفلاین آماده است.', { tone: 'success' });
  },
});
