import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Serialises every mutating operation.
 *
 * Capacity reservation must be atomic (Master PRD / Backend PRD §5). With a
 * single Node process and JSON files, running all mutations one-at-a-time is the
 * smallest correct implementation — no database transactions required.
 *
 * The lock is re-entrant: a service that calls another locking service (e.g.
 * createShipment -> reserveCapacity -> confirmShipment) must NOT deadlock, so
 * nested calls run inline while still holding the outer lock.
 */
const inCriticalSection = new AsyncLocalStorage<boolean>();
let tail: Promise<unknown> = Promise.resolve();

export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (inCriticalSection.getStore() === true) {
    return fn();
  }
  return inCriticalSection.run(true, () => {
    const result = tail.then(fn, fn);
    // Keep the chain alive even when a task rejects.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  });
}
