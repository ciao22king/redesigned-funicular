import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateIp,
  validatePublicUrl,
  normalizeHost,
  isGitHubName,
  fetchGitHubRepo,
  htmlToText,
  googleExportUrl,
  isGitHubUrl,
  isGoogleUrl,
  isNotionUrl,
} from '../src/lib/sources';

/**
 * These are the security-relevant tests of the ingest feature: the server
 * fetches a URL chosen by an anonymous visitor, so a regression here is an SSRF
 * hole, not a cosmetic bug.
 */

test('gli indirizzi privati IPv4 sono riconosciuti', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255', '169.254.169.254', '0.0.0.0']) {
    assert.equal(isPrivateIp(ip), true, `${ip} deve essere privato`);
  }
});

test('gli indirizzi pubblici IPv4 non sono privati', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '11.0.0.1']) {
    assert.equal(isPrivateIp(ip), false, `${ip} deve essere pubblico`);
  }
});

test('gli indirizzi IPv6 interni sono riconosciuti', () => {
  for (const ip of ['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} deve essere interno`);
  }
});

test('i nomi di host interni sono rifiutati', () => {
  for (const url of [
    'http://localhost/admin',
    'http://localhost.localdomain/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://printer.local/',
    'http://db.internal/',
  ]) {
    assert.ok(validatePublicUrl(url), `${url} deve essere rifiutato`);
  }
});

test('solo http e https sono accettati', () => {
  assert.ok(validatePublicUrl('file:///etc/passwd'));
  assert.ok(validatePublicUrl('gopher://example.com'));
  assert.ok(validatePublicUrl('javascript:alert(1)'));
  assert.equal(validatePublicUrl('https://example.com/page'), null);
});

test('un IP privato in una URL pubblica e rifiutato', () => {
  assert.ok(validatePublicUrl('http://169.254.169.254/latest/meta-data/'));
  assert.ok(validatePublicUrl('http://10.1.2.3:8080/'));
});

test('una URL non valida e rifiutata senza lanciare', () => {
  assert.ok(validatePublicUrl('not a url'));
  assert.ok(validatePublicUrl(''));
});

test('normalizeHost toglie il punto finale di un FQDN', () => {
  assert.equal(normalizeHost('localhost.'), 'localhost');
  assert.equal(normalizeHost('Example.COM.'), 'example.com');
  assert.equal(normalizeHost('a.b.'), 'a.b');
});

test('normalizeHost srotola un IPv4-mapped IPv6 canonico', () => {
  assert.equal(normalizeHost('[::ffff:7f00:1]'), '127.0.0.1');
  assert.equal(normalizeHost('[::ffff:a9fe:a9fe]'), '169.254.169.254');
});

test('un host interno con punto finale non sfugge al filtro', () => {
  // Regressione: prima del fix il punto finale sconfiggeva il match esatto e le
  // desinenze .local/.internal, quindi queste forme passavano.
  for (const url of [
    'http://localhost./',
    'http://LOCALHOST./',
    'http://metadata.google.internal./',
    'http://db.internal./',
    'http://printer.local./',
  ]) {
    assert.ok(validatePublicUrl(url), `${url} deve essere rifiutato`);
  }
});

test('un IPv4-mapped IPv6 interno non sfugge al filtro', () => {
  // Regressione: il parser canonizza [::ffff:127.0.0.1] in [::ffff:7f00:1],
  // che il vecchio isPrivateIp non riconosceva.
  assert.ok(validatePublicUrl('http://[::ffff:127.0.0.1]/'));
  assert.ok(validatePublicUrl('http://[::ffff:169.254.169.254]/'));
});

test('un host pubblico normale resta accettato', () => {
  assert.equal(validatePublicUrl('https://example.com/page'), null);
  assert.equal(validatePublicUrl('https://raw.githubusercontent.com/a/b/main/x.md'), null);
});

test('isGitHubName accetta i nomi reali e rifiuta i dot-segment', () => {
  for (const ok of ['owner', 'my-repo', 'a.b', 'under_score', 'A1']) {
    assert.equal(isGitHubName(ok), true, `${ok} deve essere valido`);
  }
  for (const bad of ['.', '..', '../..', '-lead', 'trail-', 'a..b', '', 'a/b', 'x y']) {
    assert.equal(isGitHubName(bad), false, `${bad} deve essere rifiutato`);
  }
});

test('fetchGitHubRepo non costruisce un URL fuori da /repos/', async () => {
  // Regressione: con owner/repo = ".." il path collassava a api.github.com/ e la
  // richiesta partiva con il token del server allegato. Ora e' rifiutata prima.
  for (const url of ['https://github.com/../../user', 'https://github.com/..%2f..%2fuser/x']) {
    const result = await fetchGitHubRepo(url);
    assert.equal(result.ok, false, `${url} non deve essere accettato`);
    if (!result.ok) assert.match(result.error, /not a github repository/i);
  }
});

test('htmlToText rimuove script, stili e tag', () => {
  const html = `<html><head><style>body{color:red}</style><script>alert('x')</script></head>
    <body><h1>Title</h1><p>First &amp; second</p><ul><li>item</li></ul></body></html>`;
  const text = htmlToText(html);
  assert.ok(!text.includes('<script'), 'lo script deve sparire');
  assert.ok(!text.includes('alert'), 'il codice dello script non deve restare');
  assert.ok(!text.includes('color:red'), 'lo stile non deve restare');
  assert.ok(text.includes('Title'));
  assert.ok(text.includes('First & second'));
  assert.ok(text.includes('item'));
});

test('un link Google Docs diventa un export in testo', () => {
  const url = googleExportUrl('https://docs.google.com/document/d/ABC123_-x/edit#heading=h.1');
  assert.equal(url, 'https://docs.google.com/document/d/ABC123_-x/export?format=txt');
});

test('un foglio Google diventa un export CSV', () => {
  assert.equal(
    googleExportUrl('https://docs.google.com/spreadsheets/d/XYZ789/edit'),
    'https://docs.google.com/spreadsheets/d/XYZ789/export?format=csv',
  );
});

test('un link Google non riconosciuto resta invariato', () => {
  assert.equal(googleExportUrl('https://docs.google.com/forms/d/e/1FAIpQLS/viewform'), null);
});

test('il riconoscimento delle fonti distingue i casi', () => {
  assert.equal(isGitHubUrl('https://github.com/owner/repo'), true);
  assert.equal(isGitHubUrl('https://example.com/owner/repo'), false);
  assert.equal(isGoogleUrl('https://docs.google.com/document/d/x/edit'), true);
  assert.equal(isNotionUrl('https://www.notion.so/Page-abc123'), true);
  assert.equal(isNotionUrl('https://example.com/notion-like'), false);
});
