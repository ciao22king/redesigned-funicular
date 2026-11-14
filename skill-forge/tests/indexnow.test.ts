import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDEXNOW_KEY, buildPayload, submitUrls } from '../src/lib/indexnow';

/**
 * Replaces `fetch` to observe the outgoing request without touching the
 * network: here we care about the shape of the payload and how a non-2xx
 * response is handled, not about the engines.
 */
function stubFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('il payload usa l host canonico e la posizione della chiave', () => {
  const p = buildPayload(['https://skillforge.cc.cd/s/a-b'], 'https://skillforge.cc.cd');
  assert.equal(p.host, 'skillforge.cc.cd');
  assert.equal(p.key, INDEXNOW_KEY);
  assert.equal(p.keyLocation, `https://skillforge.cc.cd/${INDEXNOW_KEY}.txt`);
  assert.deepEqual(p.urlList, ['https://skillforge.cc.cd/s/a-b']);
});

test('un host con slash finale non produce una keyLocation con doppio slash', () => {
  const p = buildPayload(['https://skillforge.cc.cd/'], 'https://skillforge.cc.cd/');
  assert.equal(p.keyLocation, `https://skillforge.cc.cd/${INDEXNOW_KEY}.txt`);
});

test('invia un POST JSON all endpoint IndexNow', async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const restore = stubFetch(async (url, init) => {
    seen = { url, init };
    return new Response(null, { status: 200 });
  });

  try {
    const ok = await submitUrls(['https://skillforge.cc.cd/s/a-b']);
    assert.equal(ok, true);
    assert.equal(seen?.url, 'https://api.indexnow.org/indexnow');
    assert.equal(seen?.init.method, 'POST');
    const body = JSON.parse(String(seen?.init.body));
    assert.equal(body.host, 'skillforge.cc.cd');
    assert.equal(body.key, INDEXNOW_KEY);
  } finally {
    restore();
  }
});

test('un elenco vuoto non chiama la rete', async () => {
  let called = false;
  const restore = stubFetch(async () => {
    called = true;
    return new Response(null, { status: 200 });
  });
  try {
    assert.equal(await submitUrls([]), false);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test('un errore di rete non propaga un errore', async () => {
  const restore = stubFetch(async () => {
    throw new Error('offline');
  });
  try {
    assert.equal(await submitUrls(['https://skillforge.cc.cd/s/a-b']), false);
  } finally {
    restore();
  }
});
