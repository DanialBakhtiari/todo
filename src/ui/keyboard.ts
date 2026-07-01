/** Global keyboard shortcuts (n = new task, / = focus search). */
export interface Shortcuts {
  onNew: () => void;
  onSearch: () => void;
}

export function initKeyboardShortcuts({ onNew, onSearch }: Shortcuts): void {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (typing) {
      if (e.key === 'Escape') target.blur();
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      onNew();
    } else if (e.key === '/') {
      e.preventDefault();
      onSearch();
    }
  });
}
