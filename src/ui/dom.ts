/** Minimal DOM helpers. `esc` is mandatory around every piece of user text. */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a string for safe interpolation into innerHTML (XSS guard). */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

export function qs<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Element not found: ${selector}`);
  return found;
}

/** Event delegation: handle `type` events whose target matches `selector`. */
export function delegate<E extends Event = Event>(
  root: HTMLElement,
  type: string,
  selector: string,
  handler: (event: E, target: HTMLElement) => void,
): void {
  root.addEventListener(type, (event) => {
    const start = event.target as HTMLElement | null;
    const match = start?.closest<HTMLElement>(selector);
    if (match && root.contains(match)) handler(event as E, match);
  });
}

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
