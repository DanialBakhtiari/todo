/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// 100% front-end, static-hostable, fully installable PWA.
// Deployed at https://tools.danialbakhtiari.com/todo/ — hence the /todo/ base.
// Override for other hosts: VITE_BASE=/ npm run build  (or any sub-path).
const base = process.env.VITE_BASE ?? '/todo/';

export default defineConfig({
  base,
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // show "new version available" toast, user reloads
      pwaAssets: {
        preset: 'minimal-2023',
        image: 'public/logo.svg',
      },
      manifest: {
        id: base,
        name: 'لیست کارهای من — مدیریت وظایف',
        short_name: 'کارهای من',
        description:
          'برنامه‌ریز روزانه فارسی با تقویم شمسی؛ سریع، خصوصی و آفلاین.',
        lang: 'fa',
        dir: 'rtl',
        start_url: `${base}?source=pwa`,
        scope: base,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        theme_color: '#6366f1',
        background_color: '#0b0b12',
        categories: ['productivity', 'utilities'],
        prefer_related_applications: false,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // keep dev server lean; test PWA via `npm run preview`
        type: 'module',
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: { include: ['src/lib/**'] },
  },
});
