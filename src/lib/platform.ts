/** Platform / PWA-install helpers. */

export type Platform = 'ios' | 'android' | 'desktop' | 'other';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as Mac but is touch-capable
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop';
  return 'other';
}

/** Already installed / running as an installed app? */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Safari iOS
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type Sub = () => void;

/**
 * Captures the `beforeinstallprompt` event (Chrome/Edge/Android) so the app can
 * offer a native install button, and tracks install state for the UI.
 */
export class InstallManager {
  private deferred: BeforeInstallPromptEvent | null = null;
  private installed = isStandalone();
  private subs = new Set<Sub>();

  init(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.emit();
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.installed = true;
      this.emit();
    });
  }

  /** True when the browser exposed a native install prompt we can trigger. */
  get canPrompt(): boolean {
    return this.deferred !== null;
  }

  get isInstalled(): boolean {
    return this.installed;
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferred) return 'unavailable';
    await this.deferred.prompt();
    const { outcome } = await this.deferred.userChoice;
    this.deferred = null;
    this.emit();
    return outcome;
  }

  subscribe(fn: Sub): Sub {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit(): void {
    for (const fn of this.subs) fn();
  }
}

export interface InstallStep {
  heading: string;
  steps: string[];
}

/** Per-platform, step-by-step manual install guide. */
export function installGuide(platform: Platform): InstallStep {
  switch (platform) {
    case 'ios':
      return {
        heading: 'آیفون / آی‌پد (Safari)',
        steps: [
          'روی دکمه‌ی «اشتراک‌گذاری» (Share) پایین صفحه بزنید.',
          'کمی پایین بروید و «Add to Home Screen» را انتخاب کنید.',
          'روی «Add» بزنید تا آیکون اپ روی صفحه‌ی خانه نصب شود.',
        ],
      };
    case 'android':
      return {
        heading: 'اندروید (Chrome)',
        steps: [
          'روی دکمه‌ی «نصب اپلیکیشن» بزنید، یا از منوی ⋮ گزینه‌ی «Install app / افزودن به صفحه اصلی» را انتخاب کنید.',
          'در پنجره‌ی باز شده «Install» را تأیید کنید.',
        ],
      };
    case 'desktop':
      return {
        heading: 'دسکتاپ (Chrome / Edge)',
        steps: [
          'روی دکمه‌ی «نصب اپلیکیشن» بزنید، یا آیکون نصب (⊕) را در نوار آدرس مرورگر بزنید.',
          'اگر از Safari یا Firefox استفاده می‌کنید، نصب PWA محدودتر است؛ اما اپ همچنان کاملاً آفلاین و با بوکمارک کار می‌کند.',
        ],
      };
    default:
      return {
        heading: 'سایر مرورگرها',
        steps: [
          'اپ کاملاً آفلاین کار می‌کند. برای دسترسی سریع، این صفحه را بوکمارک کنید.',
          'در مرورگرهای مبتنی بر Chrome می‌توانید از منوی مرورگر گزینه‌ی نصب را بیابید.',
        ],
      };
  }
}
