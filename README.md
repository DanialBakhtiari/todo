# لیست کارهای من — My Tasks PWA

<div dir="rtl">

یک برنامه‌ریز روزانه‌ی **فارسی**، **آفلاین‌محور** و **نصب‌شدنی (PWA)** برای مدیریت
وظایف — با **تقویم شمسی (جلالی)**، اولویت‌بندی، دسته‌بندی، زیرکارها و یادآوری.
سریع، خصوصی و آفلاین — **بدون حساب کاربری و بدون ردیابی**. داده‌ها فقط روی
دستگاه شما در `localStorage` ذخیره می‌شوند.

</div>

> A professional, installable, offline-first PWA — 100% front-end and static-hostable.

## ✨ Features

- **PWA** — installable on mobile & desktop, works fully offline, in-app update prompt, multi-platform install guide (Android / iOS Safari / desktop).
- **Persian-first & RTL** — live Gregorian + Jalali (Shamsi) clock, Persian digits, RTL-correct icons and motion.
- **Tasks** — quick add + full editor: notes, due date, priority, colour, category, subtasks, reminder, recurrence.
- **Organise** — colour categories, priority chips, combined search/filter (text · priority · category · status) and sorting.
- **Reorder** — pointer-based drag & drop (touch + mouse) in manual sort mode.
- **Undo** — non-blocking toast with “Undo” for delete/complete.
- **Backup** — export / import a JSON file to move between devices.
- **Reminders** — Web Notifications with explicit permission.
- **Theme** — light / dark / system, persisted, no flash of wrong theme.
- **Accessible** — WCAG 2.1 AA: real labels, ARIA live regions, focus-trap modals, keyboard shortcuts (`n` = new, `/` = search), reduced-motion aware.
- **SEO** — title/description, canonical, Open Graph, Twitter card, JSON-LD `WebApplication`, `robots.txt`, `sitemap.xml`.

## 🧱 Tech stack

| Layer | Choice |
| --- | --- |
| Build | Vite 6 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + CSS design tokens (“Aurora Glass”) |
| UI | Modular vanilla TS + a tiny observer store (no framework) |
| Calendar | Jalali conversion ported to TS (jalaali algorithm) |
| PWA | `vite-plugin-pwa` (Workbox) + `@vite-pwa/assets-generator` |
| Font | Vazirmatn Variable (self-hosted via `@fontsource-variable`) |
| Quality | ESLint 9 (flat) · Prettier · Vitest (jsdom) |

Runtime bundle is tiny: **~18 KB JS + ~6 KB CSS (gzip)**, zero runtime npm dependencies except the self-hosted font.

## 🚀 Getting started

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build
npm run check      # tsc --noEmit && eslint . && vitest run && vite build  (CI gate)
npm test           # unit tests only
```

## 📲 Installing the app

- **Android / Chrome / Edge:** tap **نصب اپلیکیشن** (or the browser’s ⋮ → *Install app*).
- **iPhone / Safari:** Share → *Add to Home Screen* → *Add*.
- **Desktop Chrome/Edge:** the install icon in the address bar, or the in-app button.

The in-app **راهنمای نصب** (footer / help) always shows the full step-by-step guide with automatic platform detection.

## 🗂️ Project structure

```
src/
  lib/        types, id, jalali, dates, store, storage(+migration), platform, notifications
  state/      app.ts — store, actions, selectors (undo, recurring, filters)
  ui/         dom, icons, theme, toast, modal, taskCard, editModal, panels, dnd, keyboard, view
  styles/     app.css — Aurora Glass tokens + Tailwind theme + components
  main.ts     entry: theme, clock, install, reminders, SW registration
tests/        vitest: jalali, dates, storage(migration), state
public/       logo.svg, robots.txt, sitemap.xml, og-image.png (generated)
```

## ☁️ Deployment notes

- **Configured for `https://tools.danialbakhtiari.com/todo/`** — the Vite `base`
  defaults to `/todo/`, and the canonical/OG/sitemap URLs point at that address.
  Just build and upload `dist/` into the `todo/` folder on the host.
- **Different path or root domain:** override the base at build time —
  `VITE_BASE=/ npm run build` (root) or `VITE_BASE=/other/ npm run build`.
  If you move domains, also update the absolute URLs in `index.html`
  (canonical/OG), `public/robots.txt` and `public/sitemap.xml`.

## 💾 Data & privacy

All data lives in your browser under the `mytasks:data:v2` key. Data from the
original vanilla version (`todo-vanilla-tasks-v2`) is **migrated automatically** on
first launch — nothing is lost. Use **Settings → export JSON** for backups.

## 👤 Author

Designed & built by **Danial Bakhtiari (دانیال بختیاری)**
· [danialbakhtiari.com](https://danialbakhtiari.com)
· [GitHub @danialbakhtiari](https://github.com/danialbakhtiari)

## 📄 License

Personal project by Danial Bakhtiari. Vazirmatn font is licensed under the SIL Open Font License.
