import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Minimal shape of the D1 binding, so the queries can be tested with a fake
 * database and `next dev` without the binding does not blow up.
 *
 * `prepare()` returns a statement that carries the terminal methods directly
 * (as the real `D1PreparedStatement` does) and also `bind()`, which returns the
 * same shape. A query with no parameters can therefore run without a `bind`.
 */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: unknown[]): Promise<unknown>;
}

/**
 * Returns the `MARKETPLACE` D1 binding, or an injected fake in tests.
 *
 * The error is a single readable message: the callers catch it and degrade
 * (empty state, empty feed) instead of failing the whole render when the
 * binding is missing in local development.
 */
export async function getDatabase(injected?: D1Like): Promise<D1Like> {
  if (injected) return injected;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bound = (env as { MARKETPLACE?: D1Like }).MARKETPLACE;
    if (!bound) throw new Error('binding assente');
    return bound;
  } catch {
    throw new Error('Marketplace unavailable: the D1 binding `MARKETPLACE` is missing.');
  }
}
