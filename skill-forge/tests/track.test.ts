import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markVisit } from '../src/lib/track';
import type { StorageLike } from '../src/lib/localstore';

/** In-memory storage, the same shape `localstore` tests use. */
function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

test('la prima visita non e un ritorno', () => {
  const store = fakeStorage();
  assert.equal(markVisit(store).returning, false);
});

test('la seconda visita e un ritorno', () => {
  const store = fakeStorage();
  markVisit(store);
  assert.equal(markVisit(store).returning, true);
});

test('la data del primo accesso viene salvata', () => {
  const store = fakeStorage();
  markVisit(store);
  assert.equal(store.data.size, 1);
});

test('senza storage non si segnala un ritorno', () => {
  assert.equal(markVisit(undefined).returning, false);
});
