import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLogin } from '../src/lib/users';
import { readRole, recordUser } from '../src/lib/users-db';
import type { D1Like } from '../src/lib/d1';

/** Minimal fake D1 that remembers rows in a Map, enough for the users queries. */
function fakeD1() {
  const users = new Map<string, { first_seen: string; last_seen: string; role: string }>();
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
        },
        async all() {
          return { results: [...users.entries()].map(([login, v]) => ({ login, ...v })) };
        },
        async first<T>() {
          if (/COUNT\(\*\)/i.test(sql)) return { n: users.size } as T;
          const login = params[0] as string;
          const v = users.get(login);
          if (/SELECT first_seen/i.test(sql)) return (v ? { first_seen: v.first_seen } : null) as T | null;
          if (/SELECT role/i.test(sql)) return (v ? { role: v.role } : null) as T | null;
          return (v ? { login, ...v } : null) as T | null;
        },
        async run() {
          if (/INSERT INTO users/i.test(sql)) {
            const [login, first, last, role] = params as [string, string, string, string];
            const existing = users.get(login);
            // Mirrors ON CONFLICT: only last_seen moves. first_seen and role are
            // fixed at account creation.
            users.set(login, {
              first_seen: existing?.first_seen ?? first,
              last_seen: last,
              role: existing?.role ?? role ?? 'member',
            });
          }
          return {};
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
  } as unknown as D1Like;
  return { db, users };
}

test('isLogin accetta un login GitHub valido e rifiuta il resto', () => {
  assert.equal(isLogin('ciao22king'), true);
  assert.equal(isLogin('a-b-c'), true);
  assert.equal(isLogin('bad--name'), false);
  assert.equal(isLogin('-start'), false);
  assert.equal(isLogin(''), false);
  assert.equal(isLogin('x'.repeat(40)), false);
  assert.equal(isLogin(42), false);
  assert.equal(isLogin(undefined), false);
});

test('recordUser tiene una riga per utente, non una per accesso', async () => {
  const { db, users } = fakeD1();
  await recordUser('alice', db);
  await recordUser('bob', db);
  await recordUser('alice', db);
  assert.equal(users.size, 2);
});

test('recordUser conserva first_seen e sposta last_seen', async () => {
  const { db, users } = fakeD1();
  await recordUser('alice', db, '2026-11-01T00:00:00.000Z');
  await recordUser('alice', db, '2026-11-07T00:00:00.000Z');
  assert.equal(users.get('alice')?.first_seen, '2026-11-01T00:00:00.000Z');
  assert.equal(users.get('alice')?.last_seen, '2026-11-07T00:00:00.000Z');
});

test('recordUser ignora un login non valido senza toccare il database', async () => {
  const { db, users } = fakeD1();
  await recordUser('bad--login', db);
  assert.equal(users.size, 0);
});

test('recordUser assegna owner a chi e in lista, a prescindere dalla data', async () => {
  const { db, users } = fakeD1();
  await recordUser('ciao22king', db, '2027-01-01T00:00:00.000Z');
  assert.equal(users.get('ciao22king')?.role, 'owner');
});

test('recordUser fa founding tester un invitato anche dopo la scadenza', async () => {
  const { db, users } = fakeD1();
  process.env.FOUNDING_TESTERS = 'invitato';
  try {
    await recordUser('invitato', db, '2027-01-01T00:00:00.000Z');
  } finally {
    delete process.env.FOUNDING_TESTERS;
  }
  assert.equal(users.get('invitato')?.role, 'founding_tester');
});

test('recordUser fa founding tester chi si iscrive prima della scadenza', async () => {
  const { db, users } = fakeD1();
  await recordUser('nuovo', db, '2026-12-10T00:00:00.000Z');
  assert.equal(users.get('nuovo')?.role, 'founding_tester');
});

test('recordUser lascia member chi si iscrive dopo la scadenza', async () => {
  const { db, users } = fakeD1();
  await recordUser('tardi', db, '2026-12-16T00:00:00.000Z');
  assert.equal(users.get('tardi')?.role, 'member');
});

test('il ruolo assegnato all iscrizione non cambia con gli accessi successivi', async () => {
  const { db, users } = fakeD1();
  await recordUser('fedele', db, '2026-12-10T00:00:00.000Z');
  assert.equal(users.get('fedele')?.role, 'founding_tester');
  // Un accesso dopo la scadenza non deve revocare il vantaggio gia ottenuto.
  await recordUser('fedele', db, '2027-01-01T00:00:00.000Z');
  assert.equal(users.get('fedele')?.role, 'founding_tester');
  assert.equal(users.get('fedele')?.first_seen, '2026-12-10T00:00:00.000Z');
});

test('readRole decide dalla data di creazione, non dalla colonna role', async () => {
  const { db, users } = fakeD1();
  // Riga incoerente di proposito: role dice founding_tester, ma first_seen e
  // dopo la scadenza. La lettura deve correggere, non fidarsi della colonna.
  users.set('tardivo', {
    first_seen: '2026-12-20T00:00:00.000Z',
    last_seen: '2026-12-20T00:00:00.000Z',
    role: 'founding_tester',
  });
  assert.equal(await readRole('tardivo', db), 'member');

  users.set('pioniere', {
    first_seen: '2026-11-20T00:00:00.000Z',
    last_seen: '2026-11-20T00:00:00.000Z',
    role: 'member',
  });
  assert.equal(await readRole('pioniere', db), 'founding_tester');
});

test('readRole ricade su un ruolo valido quando la riga manca', async () => {
  const { db } = fakeD1();
  // Nessuna riga salvata: l'owner resta owner; per gli altri la caduta dipende
  // dalla data odierna, quindi si verifica solo che il ruolo sia valido.
  assert.equal(await readRole('ciao22king', db), 'owner');
  assert.ok(['founding_tester', 'member'].includes(await readRole('sconosciuto', db)));
});
