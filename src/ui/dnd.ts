/**
 * Pointer-based sortable list — works for both mouse and touch.
 * Uses elementFromPoint to reorder live; no HTML5 drag (which most
 * mobile browsers ignore).
 */
export interface SortableOptions {
  handle: string;
  itemSelector: string;
  onReorder: (orderedIds: string[]) => void;
}

export function makeSortable(list: HTMLElement, opts: SortableOptions): void {
  let dragEl: HTMLElement | null = null;

  list.addEventListener('pointerdown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>(opts.handle);
    if (!handle) return;
    const item = handle.closest<HTMLElement>(opts.itemSelector);
    if (!item) return;
    e.preventDefault();
    dragEl = item;
    item.classList.add('dragging');
    item.setPointerCapture(e.pointerId);
  });

  list.addEventListener('pointermove', (e) => {
    if (!dragEl) return;
    e.preventDefault();
    const under = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find(
        (el) => el instanceof HTMLElement && el !== dragEl && el.matches(opts.itemSelector),
      ) as HTMLElement | undefined;
    if (!under) return;
    const rect = under.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    list.insertBefore(dragEl, after ? under.nextSibling : under);
  });

  const finish = (e: PointerEvent): void => {
    if (!dragEl) return;
    dragEl.classList.remove('dragging');
    try {
      dragEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragEl = null;
    const ids = [...list.querySelectorAll<HTMLElement>(opts.itemSelector)].map(
      (el) => el.dataset['id']!,
    );
    opts.onReorder(ids);
  };

  list.addEventListener('pointerup', finish);
  list.addEventListener('pointercancel', finish);
}
