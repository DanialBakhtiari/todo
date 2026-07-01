/**
 * Tiny hand-rolled reactive store (Observer pattern).
 * ~30 lines, zero dependencies. State is treated as immutable: always replace,
 * never mutate in place, so subscribers see a fresh reference.
 */
export type Listener<T> = (state: T, prev: T) => void;
export type Updater<T> = (prev: T) => T;

export interface Store<T> {
  get(): T;
  set(next: T | Updater<T>): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(next) {
      const prev = state;
      state = typeof next === 'function' ? (next as Updater<T>)(prev) : next;
      if (state === prev) return;
      for (const listener of listeners) listener(state, prev);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
