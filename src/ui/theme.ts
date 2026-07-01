import type { ThemePref } from '../lib/types.ts';

/** Theme application — dark/light + system, persisted. */

export function effectiveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  const theme = effectiveTheme(pref);
  document.documentElement.dataset['theme'] = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0b0b12' : '#f5f5fb';
}

/** Re-apply on OS theme change while the user preference is "system". */
export function watchSystemTheme(getPref: () => ThemePref): void {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getPref() === 'system') applyTheme('system');
    });
}
