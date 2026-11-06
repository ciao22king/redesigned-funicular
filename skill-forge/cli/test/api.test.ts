import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Client, ApiError } from '../src/api.js';

/**
 * Il client si prova con un `fetch` finto: nessuna rete nei test, ma il
 * percorso reale (headers, status, parsing) viene esercitato per intero.
 */

/** Costruisce un fetch finto che registra la richiesta e risponde con `body`. */
function fakeFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }) {
  return (async (input: string | URL, init?: RequestInit) => {
    if (capture) {
      capture.url = String(input);
      capture.init = init;
    }
    return new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('Client', () => {
  test('manda il token come Bearer', async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    const client = new Client({ url: 'https://api.test', token: 'tok', fetchImpl: fakeFetch(200, {}, capture) });
    await client.me();
    const headers = capture.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer tok');
    assert.equal(capture.url, 'https://api.test/api/me');
  });

  test('senza token non manda Authorization', async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    const client = new Client({ url: 'https://api.test', fetchImpl: fakeFetch(200, {}, capture) });
    await client.list();
    const headers = capture.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(client.authenticated, false);
  });

  test('compone la query di ricerca', async () => {
    const capture: { url?: string } = {};
    const client = new Client({ url: 'https://api.test', fetchImpl: fakeFetch(200, {}, capture) });
    await client.list({ q: 'docker', sort: 'stars', owner: 'me', page: 2 });
    assert.match(capture.url!, /q=docker/);
    assert.match(capture.url!, /sort=stars/);
    assert.match(capture.url!, /owner=me/);
    assert.match(capture.url!, /page=2/);
  });

  test('page=1 non viene aggiunto alla query', async () => {
    const capture: { url?: string } = {};
    const client = new Client({ url: 'https://api.test', fetchImpl: fakeFetch(200, {}, capture) });
    await client.list({ page: 1 });
    assert.ok(!capture.url!.includes('page='));
  });

  test('detail codifica l\'id con lo slash', async () => {
    const capture: { url?: string } = {};
    const client = new Client({ url: 'https://api.test', fetchImpl: fakeFetch(200, { skill: {} }, capture) });
    await client.detail('me/skill');
    assert.match(capture.url!, /id=me%2Fskill/);
  });

  test('un errore HTTP diventa ApiError con il messaggio del server', async () => {
    const client = new Client({ url: 'https://api.test', fetchImpl: fakeFetch(401, { error: 'Token non valido' }) });
    await assert.rejects(() => client.me(), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      assert.equal(err.message, 'Token non valido');
      return true;
    });
  });

  test('un errore di rete diventa ApiError con status 0', async () => {
    const boom = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const client = new Client({ url: 'https://api.test', fetchImpl: boom });
    await assert.rejects(() => client.list(), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 0);
      assert.match(err.message, /Impossibile contattare/);
      return true;
    });
  });

  test('publish manda il markdown nel corpo', async () => {
    const capture: { init?: RequestInit } = {};
    const client = new Client({ url: 'https://api.test', token: 't', fetchImpl: fakeFetch(200, { skill: {} }, capture) });
    await client.publish({ markdown: '---\nname: X\n---\n', tags: ['a', 'b'] });
    const sent = JSON.parse(String(capture.init?.body));
    assert.equal(sent.markdown, '---\nname: X\n---\n');
    assert.deepEqual(sent.tags, ['a', 'b']);
  });

  test('remove usa DELETE con lo slug', async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    const client = new Client({ url: 'https://api.test', token: 't', fetchImpl: fakeFetch(200, { ok: true }, capture) });
    await client.remove('la-mia-skill');
    assert.equal(capture.init?.method, 'DELETE');
    assert.match(capture.url!, /slug=la-mia-skill/);
  });

  test('baseUrl non ha lo slash finale', () => {
    const client = new Client({ url: 'https://api.test///', fetchImpl: fakeFetch(200, {}) });
    assert.equal(client.baseUrl, 'https://api.test');
  });
});
