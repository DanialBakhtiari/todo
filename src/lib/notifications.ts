import type { Task } from './types.ts';
import { parseISO } from './dates.ts';

/** Web Notifications reminders. */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Lightweight in-page reminder checker. Every minute it fires a notification for
 * any active task whose `reminderAt` has just passed. Fired ids are remembered
 * (in-memory + localStorage) so a reminder is not repeated on the same device.
 */
export class ReminderScheduler {
  private timer: number | null = null;
  private readonly firedKey = 'mytasks:fired-reminders';
  private fired = new Set<string>();

  constructor(private getTasks: () => Task[]) {
    try {
      const raw = localStorage.getItem(this.firedKey);
      if (raw) this.fired = new Set(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }

  start(): void {
    if (this.timer !== null) return;
    this.check();
    this.timer = window.setInterval(() => this.check(), 60_000);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private persistFired(): void {
    try {
      localStorage.setItem(this.firedKey, JSON.stringify([...this.fired]));
    } catch {
      /* ignore */
    }
  }

  private check(): void {
    if (notificationPermission() !== 'granted') return;
    const now = Date.now();
    for (const task of this.getTasks()) {
      if (task.completed || !task.reminderAt) continue;
      const key = `${task.id}@${task.reminderAt}`;
      if (this.fired.has(key)) continue;
      const at = parseISO(task.reminderAt);
      if (!at) continue;
      const delta = now - at.getTime();
      // Fire once the reminder is due, but not for very stale ones (>1 day).
      if (delta >= 0 && delta < 86_400_000) {
        try {
          new Notification('یادآوری کار', {
            body: task.title,
            tag: task.id,
            icon: '/pwa-192x192.png',
            badge: '/pwa-64x64.png',
            dir: 'rtl',
            lang: 'fa',
          });
        } catch {
          /* notification construction can throw on some platforms */
        }
        this.fired.add(key);
        this.persistFired();
      }
    }
  }
}
