import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfileReport,
  getProfile,
  hasPublishedSkills,
  listIndexableCreators,
  profilesFor,
  saveProfile,
  suspendedLogins,
} from '../src/lib/profile-db';
import type { D1Like } from '../src/lib/d1';

/**
 * Minimal fake D1 for the profile queries.
 *
 * It recognises the handful of statements `profile-db` issues and keeps the rows
 * in Maps, which is enough to exercise the upsert, the suspended filter and the
 * report deduplication without Cloudflare.
 */
function fakeD1() {
  const profiles = new Map<string, Record<string, unknown>>();
  const skills = new Map<string, { owner: string; updated_at: string }[]>();
  const reports = new Set<string>();

  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
        },
        async all() {
          if (/FROM profiles WHERE suspended = 1 OR banned = 1/i.test(sql)) {
            return {
              results: [...profiles.values()]
                .filter((p) => Number(p.suspended) === 1 || Number(p.banned) === 1)
                .map((p) => ({ login: p.login })),
            };
          }
          if (/FROM profiles WHERE login IN/i.test(sql)) {
            const wanted = new Set(params as string[]);
            return {
              results: [...profiles.values()].filter((p) => wanted.has(p.login as string)),
            };
          }
          if (/FROM skills WHERE status = 'published' GROUP BY owner/i.test(sql)) {
            const out: { login: string; updated_at: string }[] = [];
            for (const [owner, rows] of skills) {
              const updated = rows.map((r) => r.updated_at).sort().at(-1) ?? '';
              out.push({ login: owner, updated_at: updated });
            }
            return { results: out.sort((a, b) => a.login.localeCompare(b.login)) };
          }
          return { results: [] };
        },
        async first<T>() {
          if (/SELECT 1 AS ok FROM skills WHERE owner/i.test(sql)) {
            const rows = skills.get(params[0] as string);
            return (rows && rows.length ? { ok: 1 } : null) as T | null;
          }
          const login = params[0] as string;
          return (profiles.get(login) ?? null) as T | null;
        },
        async run() {
          if (/INSERT INTO profiles/i.test(sql)) {
            const login = params[0] as string;
            const existing = profiles.get(login) ?? { login };
            // Map the bound values to the columns named in the statement, so the
            // partial admin setters (verified, suspended, banned, socials) work.
            const columns = /\(([^)]*)\)/.exec(sql)?.[1].split(',').map((c) => c.trim()) ?? [];
            const next: Record<string, unknown> = { ...existing };
            columns.forEach((col, i) => {
              next[col] = params[i];
            });
            profiles.set(login, next);
            return { meta: { changes: 1 } };
          }
          if (/INSERT OR IGNORE INTO profile_reports/i.test(sql)) {
            const [username, , , , reporter_key, , day] = params as string[];
            const key = `${username}|${reporter_key}|${day}`;
            if (reports.has(key)) return { meta: { changes: 0 } };
            reports.add(key);
            return { meta: { changes: 1, last_row_id: reports.size } };
          }
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
  } as unknown as D1Like;

  return { db, profiles, skills, reports };
}

function addSkill(skills: Map<string, { owner: string; updated_at: string }[]>, owner: string, updated: string) {
  const rows = skills.get(owner) ?? [];
  rows.push({ owner, updated_at: updated });
  skills.set(owner, rows);
}

test('un profilo senza riga torna i default', async () => {
  const { db } = fakeD1();
  const profile = await getProfile('ciao22king', db);
  assert.equal(profile.login, 'ciao22king');
  assert.equal(profile.displayName, '');
  assert.equal(profile.hasRow, false);
  assert.equal(profile.suspended, false);
});

test('un login non valido non tocca il database', async () => {
  const { db, profiles } = fakeD1();
  const profile = await getProfile('bad--name', db);
  assert.equal(profile.hasRow, false);
  assert.equal(profiles.size, 0);
});

test('saveProfile crea la riga e la rilegge', async () => {
  const { db } = fakeD1();
  await saveProfile(
    'ciao22king',
    {
      displayName: 'Drix',
      bio: 'hello',
      avatarUrl: 'https://x.dev/a.png',
      socials: { x: 'https://x.com/a', linkedin: '', youtube: '', website: '', newsletter: '' },
    },
    db,
  );
  const profile = await getProfile('ciao22king', db);
  assert.equal(profile.displayName, 'Drix');
  assert.equal(profile.x, 'https://x.com/a');
  assert.equal(profile.hasRow, true);
});

test('un secondo salvataggio aggiorna invece di duplicare', async () => {
  const { db, profiles } = fakeD1();
  const base = {
    displayName: 'A',
    bio: '',
    avatarUrl: '',
    socials: { x: '', linkedin: '', youtube: '', website: '', newsletter: '' },
  };
  await saveProfile('a', base, db);
  await saveProfile('a', { ...base, displayName: 'B' }, db);
  assert.equal(profiles.size, 1);
  assert.equal((await getProfile('a', db)).displayName, 'B');
});

test('i profili sospesi si elencano e si escludono dalla directory', async () => {
  const { db, skills, profiles } = fakeD1();
  addSkill(skills, 'alice', '2026-11-01T00:00:00Z');
  addSkill(skills, 'bob', '2026-11-02T00:00:00Z');
  profiles.set('bob', { login: 'bob', suspended: 1, verified: 0 });

  const suspended = await suspendedLogins(db);
  assert.deepEqual([...suspended], ['bob']);

  const listed = await listIndexableCreators(db);
  assert.deepEqual(listed.map((c) => c.login), ['alice']);
});

test('profilesFor legge piu profili in una volta', async () => {
  const { db, profiles } = fakeD1();
  profiles.set('a', { login: 'a', display_name: 'A' });
  profiles.set('b', { login: 'b', display_name: 'B' });
  const map = await profilesFor(['a', 'b', 'missing'], db);
  assert.equal(map.size, 2);
  assert.equal(map.get('a')?.displayName, 'A');
});

test('hasPublishedSkills distingue un autore da un login qualsiasi', async () => {
  const { db, skills } = fakeD1();
  addSkill(skills, 'alice', '2026-11-01T00:00:00Z');
  assert.equal(await hasPublishedSkills('alice', db), true);
  assert.equal(await hasPublishedSkills('nobody', db), false);
});

test('un report identico non viene scritto due volte', async () => {
  const { db } = fakeD1();
  const report = { username: 'a', reason: 'spam' as const, note: '' };
  const first = await createProfileReport({ report, reporter: 'anon', ip: '1.2.3.4' }, db);
  const second = await createProfileReport({ report, reporter: 'anon', ip: '1.2.3.4' }, db);
  assert.equal(typeof first, 'number');
  assert.equal(second, null);
});
