/** Stable unique id with a safe fallback for older browsers. */
export function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return (
    Date.now().toString(36) +
    Math.random().toString(16).slice(2) +
    Math.random().toString(16).slice(2)
  );
}
