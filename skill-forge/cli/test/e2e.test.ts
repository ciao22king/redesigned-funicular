import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { main } from '../src/index.js';

/**
 * End-to-end test of the dispatcher against a real (local) HTTP server.
 *
 * No client mock: the CLI is run the way the user would run it, `main(argv)` up
 * to the HTTP request. The fake server answers like the real worker, so the
 * whole chain is exercised.
 */

let server: Server;
let baseUrl: string;
let dir: string;
let requests: { method: string; url: string; auth?: string; body?: string }[] = [];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sf-e2e-'));
  process.env.XDG_CONFIG_HOME = dir;

  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        auth: req.headers.authorization as string | undefined,
        body: Buffer.concat(chunks).toString('utf8') || undefined,
      });

      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      const url = req.url ?? '';
      if (url.startsWith('/api/me')) {
        if (req.headers.authorization === 'Bearer buono') {
          send(200, { login: 'tester', quota: { used: 1, remaining: 2, limit: 3, resetsAt: '2026-11-06', unlimited: false } });
        } else {
          send(401, { error: 'Missing or invalid token.' });
        }
      } else if (url.startsWith('/api/marketplace/publish')) {
        if (req.method === 'POST') {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          send(200, { ok: true, skill: { id: 'tester/x', owner: 'tester', name: body.name ?? 'X', description: body.description ?? '', tags: [], stars: 0, starred: false, createdAt: '2026-11-05', updatedAt: '2026-11-05', markdown: body.markdown ?? '' } });
        } else {
          send(200, { ok: true });
        }
      } else if (url.startsWith('/api/marketplace/detail')) {
        send(200, { skill: { id: 'tester/x', owner: 'tester', name: 'X', description: 'd', tags: [], stars: 1, starred: false, createdAt: '2026-11-05', updatedAt: '2026-11-05', markdown: '---\nname: X\n---\n\n# Corpo\n' } });
      } else if (url.startsWith('/api/marketplace')) {
        send(200, { skills: [], total: 0, page: 1, pageSize: 24, pages: 1 });
      } else {
        send(404, { error: 'non trovato' });
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

describe('CLI end-to-end', () => {
  test('help esce con 0', async () => {
    assert.equal(await main(['help']), 0);
  });

  test('comando sconosciuto esce con 1', async () => {
    assert.equal(await main(['inesistente']), 1);
  });

  test('whoami senza token esce con 1', async () => {
    // Nessun token in config ne' in ambiente.
    delete process.env.SKILL_FORGE_TOKEN;
    assert.equal(await main(['whoami', '--url', baseUrl]), 1);
  });

  test('login salva il token e verifica via /api/me', async () => {
    requests = [];
    const code = await main(['login', '--token', 'buono', '--url', baseUrl]);
    assert.equal(code, 0);
    assert.ok(requests.some((r) => r.url.startsWith('/api/me')));
    assert.ok(existsSync(join(dir, 'skill-forge', 'config.json')));
  });

  test('login con token non valido esce con 1', async () => {
    const code = await main(['login', '--token', 'sbagliato', '--url', baseUrl]);
    assert.equal(code, 1);
  });

  test('whoami col token salvato esce con 0', async () => {
    const code = await main(['whoami', '--url', baseUrl]);
    assert.equal(code, 0);
  });

  test('list col server finto esce con 0', async () => {
    const code = await main(['list', '--url', baseUrl]);
    assert.equal(code, 0);
  });

  test('pull scrive il file markdown', async () => {
    const out = join(dir, 'scaricata.md');
    const code = await main(['pull', 'tester/x', '-o', out, '--url', baseUrl]);
    assert.equal(code, 0);
    assert.ok(existsSync(out));
    assert.match(readFileSync(out, 'utf8'), /name: X/);
  });

  test('pull senza id esce con 1', async () => {
    assert.equal(await main(['pull', '--url', baseUrl]), 1);
  });

  test('publish da file esce con 0 e manda il markdown', async () => {
    const file = join(dir, 'da-pubblicare.md');
    writeFileSync(file, '---\nname: Da Pubblicare\ndescription: test\n---\n\n# Corpo\n');
    requests = [];
    const code = await main(['publish', '-f', file, '--url', baseUrl, '--token', 'buono']);
    assert.equal(code, 0);
    const posted = requests.find((r) => r.method === 'POST');
    assert.ok(posted);
    const body = JSON.parse(posted!.body ?? '{}');
    assert.match(body.markdown, /Da Pubblicare/);
    assert.equal(body.name, 'Da Pubblicare');
  });

  test('delete chiama DELETE con lo slug', async () => {
    requests = [];
    const code = await main(['delete', 'tester/x', '--yes', '--url', baseUrl, '--token', 'buono']);
    assert.equal(code, 0);
    assert.ok(requests.some((r) => r.method === 'DELETE' && r.url.includes('slug=x')));
  });

  test('--json produce JSON valido su stdout', async () => {
    // We launch the binary in a separate process: so we capture only its
    // stdout, without also intercepting the test runner output.
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    const bin = new URL('../dist/index.js', import.meta.url).pathname;
    const { stdout } = await run('node', [bin, 'whoami', '--json', '--url', baseUrl], {
      env: { ...process.env, XDG_CONFIG_HOME: dir },
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.login, 'tester');
    assert.equal(parsed.quota.limit, 3);
  });

  test('browse senza un terminale non si blocca e suggerisce list', async () => {
    // Nel runner il processo non ha un TTY: `browse` deve accorgersene e
    // uscire, invece di restare in attesa di tasti che non arriveranno mai.
    const code = await main(['browse', '--url', baseUrl]);
    assert.equal(code, 1);
  });
});
