import { create, esc } from './dom.ts';
import { icon } from './icons.ts';

/** Accessible modal dialog with focus-trap, ESC + backdrop close. */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function openModal(title: string, content: HTMLElement): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const titleId = `modal-title-${Math.floor(performance.now())}`;

  const backdrop = create(
    'div',
    'fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4',
  );
  backdrop.style.background = 'rgb(0 0 0 / 0.5)';
  backdrop.style.backdropFilter = 'blur(2px)';

  const dialog = create(
    'div',
    'glass animate-pop w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl',
  );
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);

  const header = create(
    'div',
    'sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/80 px-5 py-3 backdrop-blur',
  );
  header.innerHTML = `<h2 id="${titleId}" class="text-lg font-bold">${esc(title)}</h2>`;
  const closeBtn = create('button', 'btn btn-icon text-muted');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'بستن');
  closeBtn.innerHTML = icon('x');
  header.appendChild(closeBtn);

  const body = create('div', 'p-5');
  body.appendChild(content);

  dialog.append(header, body);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    backdrop.remove();
    previouslyFocused?.focus?.();
  };

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) => n.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  // Focus the first meaningful control inside the dialog.
  const firstField = dialog.querySelector<HTMLElement>(FOCUSABLE);
  (firstField ?? dialog).focus();

  return close;
}
