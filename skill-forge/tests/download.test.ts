import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithTimeout, TimedOutError, RETRY_MESSAGE } from '../src/lib/fetch-with-timeout';
import {
  fetchSkillForDownload,
  SignInRequiredError,
  saveMarkdownFile,
} from '../src/lib/skill-download';

/** Replaces `fetch`, restoring it after the test. */
function stubFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('una risposta rapida passa attraverso', async () => {
  const restore = stubFetch(async () => new Response('ok', { status: 200 }));
  try {
    const res = await fetchWithTimeout('https://example.test/x', {}, 1_000);
    assert.equal(res.status, 200);
  } finally {
    restore();
  }
});

test('una richiesta oltre il tetto viene abbandonata con il messaggio di riprova', async () => {
  // Non risponde mai: il timeout deve scattare e dare la frase pronta all'utente.
  const restore = stubFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  );
  try {
    await assert.rejects(
      () => fetchWithTimeout('https://example.test/slow', {}, 20),
      (err: unknown) => err instanceof TimedOutError && err.message === RETRY_MESSAGE,
    );
  } finally {
    restore();
  }
});

test('il messaggio di riprova e quello mostrato all utente', () => {
  assert.equal(RETRY_MESSAGE, 'Sorry, retry in a few seconds or hours.');
});

test('lo scaricamento senza accesso segnala il login richiesto', async () => {
  const restore = stubFetch(
    async () =>
      new Response(JSON.stringify({ error: 'Sign in with GitHub to download a skill.', signInRequired: true }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
  );
  try {
    await assert.rejects(
      () => fetchSkillForDownload('owner/slug'),
      (err: unknown) => err instanceof SignInRequiredError,
    );
  } finally {
    restore();
  }
});

test('lo scaricamento con accesso restituisce la skill', async () => {
  let seenUrl = '';
  const restore = stubFetch(async (url) => {
    seenUrl = url;
    return new Response(
      JSON.stringify({ skill: { id: 'owner/slug', name: 'N', description: 'D', markdown: '# M' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  try {
    const skill = await fetchSkillForDownload('owner/slug');
    assert.equal(skill.markdown, '# M');
    // L'id va codificato: contiene una barra.
    assert.match(seenUrl, /id=owner%2Fslug/);
  } finally {
    restore();
  }
});

test('un errore diverso dal 401 non viene scambiato per un login richiesto', async () => {
  const restore = stubFetch(
    async () =>
      new Response(JSON.stringify({ error: 'Skill not found.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
  );
  try {
    await assert.rejects(
      () => fetchSkillForDownload('owner/missing'),
      (err: unknown) =>
        err instanceof Error && !(err instanceof SignInRequiredError) && /not found/i.test(err.message),
    );
  } finally {
    restore();
  }
});

test('il token viene inviato come bearer quando c e', async () => {
  let auth: string | undefined;
  const restore = stubFetch(async (_url, init) => {
    auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    return new Response(JSON.stringify({ skill: { id: 'a/b', name: 'N', description: '', markdown: '' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  try {
    await fetchSkillForDownload('a/b', 'tok-123');
    assert.equal(auth, 'Bearer tok-123');
  } finally {
    restore();
  }
});

test('saveMarkdownFile crea un link di scaricamento e lo revoca', () => {
  const created: string[] = [];
  const revoked: string[] = [];
  const clicked: string[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalDocument = (globalThis as { document?: unknown }).document;

  URL.createObjectURL = () => {
    created.push('blob:url');
    return 'blob:url';
  };
  URL.revokeObjectURL = (u: string) => {
    revoked.push(u);
  };
  // Node non ha un DOM: basta un `<a>` che si annota da solo quando viene
  // cliccato, perche' e' l'unica cosa che la funzione usa.
  (globalThis as { document?: unknown }).document = {
    createElement: (tag: string) => {
      assert.equal(tag, 'a');
      return {
        href: '',
        download: '',
        click() {
          clicked.push(this.download);
        },
      };
    },
  };

  try {
    saveMarkdownFile('my-skill', '# body');
    assert.deepEqual(created, ['blob:url']);
    assert.deepEqual(revoked, ['blob:url']);
    assert.deepEqual(clicked, ['my-skill.md']);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    (globalThis as { document?: unknown }).document = originalDocument;
  }
});
