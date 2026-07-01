import { create, esc } from './dom.ts';

/** Accessible toast notifications with optional Undo. */

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  tone?: 'default' | 'success' | 'danger';
}

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container) return container;
  const node = create('div', 'fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  node.style.pointerEvents = 'none';
  document.body.appendChild(node);
  container = node;
  return node;
}

export function toast(message: string, opts: ToastOptions = {}): () => void {
  const root = ensureContainer();
  const toneRing =
    opts.tone === 'danger'
      ? 'var(--brand-danger)'
      : opts.tone === 'success'
        ? 'var(--brand-success)'
        : 'var(--color-line)';

  const card = create(
    'div',
    'glass animate-pop flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg',
  );
  card.style.pointerEvents = 'auto';
  card.style.borderColor = toneRing;
  card.style.maxWidth = 'min(92vw, 30rem)';
  card.setAttribute('role', 'status');

  const text = create('span', 'flex-1');
  text.textContent = message;
  card.appendChild(text);

  let timer = 0;
  const dismiss = (): void => {
    window.clearTimeout(timer);
    card.style.opacity = '0';
    card.style.transform = 'translateY(8px)';
    window.setTimeout(() => card.remove(), 200);
  };

  if (opts.actionLabel && opts.onAction) {
    const btn = create('button', 'btn btn-ghost !py-1 !px-3 shrink-0');
    btn.type = 'button';
    btn.innerHTML = esc(opts.actionLabel);
    btn.addEventListener('click', () => {
      opts.onAction?.();
      dismiss();
    });
    card.appendChild(btn);
  }

  const close = create('button', 'btn btn-icon !p-1 shrink-0 text-muted');
  close.type = 'button';
  close.setAttribute('aria-label', 'بستن');
  close.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  close.addEventListener('click', dismiss);
  card.appendChild(close);

  root.appendChild(card);
  const duration = opts.duration ?? 5000;
  if (duration > 0) timer = window.setTimeout(dismiss, duration);
  return dismiss;
}
