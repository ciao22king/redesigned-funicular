import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarFor,
  displayNameFor,
  emptyProfile,
  githubUrl,
  isProfileIndexable,
  isTopAuthor,
  normalizeAvatarUrl,
  normalizeSocialUrl,
  profileReasonLabel,
  publicProfileBadges,
  socialLinksFor,
  toProfileInput,
  validateProfileInput,
  validateProfileReport,
  PROFILE_LIMITS,
  SOCIALS,
  TOP_AUTHOR,
} from '../src/lib/profile';

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

test('un handle diventa l URL della piattaforma', () => {
  assert.equal(normalizeSocialUrl('@editbydrix', 'x'), 'https://x.com/editbydrix');
  assert.equal(normalizeSocialUrl('editbydrix', 'x'), 'https://x.com/editbydrix');
  assert.equal(
    normalizeSocialUrl('editbydrix', 'linkedin'),
    'https://www.linkedin.com/in/editbydrix',
  );
  assert.equal(normalizeSocialUrl('mychannel', 'youtube'), 'https://www.youtube.com/@mychannel');
});

test('un dominio nudo prende https', () => {
  assert.equal(normalizeSocialUrl('example.com', 'website'), 'https://example.com');
  assert.equal(normalizeSocialUrl('example.com/blog', 'newsletter'), 'https://example.com/blog');
});

test('un URL completo resta com e', () => {
  assert.equal(normalizeSocialUrl('https://a.dev/x', 'website'), 'https://a.dev/x');
  assert.equal(normalizeSocialUrl('http://a.dev', 'newsletter'), 'http://a.dev');
});

test('un campo vuoto resta vuoto', () => {
  assert.equal(normalizeSocialUrl('', 'x'), '');
  assert.equal(normalizeSocialUrl('   ', 'website'), '');
  assert.equal(normalizeSocialUrl(undefined, 'x'), '');
});

test('un handle non valido per un link libero non produce URL', () => {
  // A bare handle with no dot is not a domain, and a free-form link has no
  // platform base to fall back on.
  assert.equal(normalizeSocialUrl('justahandle', 'website'), '');
});

test('avatar: URL completo o dominio, altrimenti vuoto', () => {
  assert.equal(normalizeAvatarUrl('https://x.dev/a.png'), 'https://x.dev/a.png');
  assert.equal(normalizeAvatarUrl('cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  assert.equal(normalizeAvatarUrl('not a url'), '');
  assert.equal(normalizeAvatarUrl(''), '');
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('un profilo valido viene normalizzato e ripulito', () => {
  const res = validateProfileInput({
    displayName: '  Drix  ',
    bio: 'I make <b>edits</b>',
    x: '@editbydrix',
    website: 'drix.dev',
  });
  assert.equal(res.ok, true);
  assert.equal(res.value?.displayName, 'Drix');
  // Markup is stripped from the public text.
  assert.equal(res.value?.bio, 'I make edits');
  assert.equal(res.value?.socials.x, 'https://x.com/editbydrix');
  assert.equal(res.value?.socials.website, 'https://drix.dev');
});

test('un link non valido fa fallire la validazione con il campo', () => {
  const res = validateProfileInput({ website: 'not a url' });
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /Website/);
});

test('un avatar non valido fa fallire la validazione', () => {
  const res = validateProfileInput({ avatarUrl: 'nope nope' });
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /avatar/i);
});

test('i campi vuoti azzerano il valore', () => {
  const res = validateProfileInput({ displayName: '', bio: '', x: '' });
  assert.equal(res.ok, true);
  assert.equal(res.value?.displayName, '');
  assert.equal(res.value?.socials.x, '');
});

test('nome e bio sono limitati', () => {
  const res = validateProfileInput({
    displayName: 'x'.repeat(PROFILE_LIMITS.displayName + 50),
    bio: 'y'.repeat(PROFILE_LIMITS.bio + 50),
  });
  assert.equal(res.value?.displayName.length, PROFILE_LIMITS.displayName);
  assert.equal(res.value?.bio.length, PROFILE_LIMITS.bio);
});

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

test('senza nome si mostra il login', () => {
  assert.equal(displayNameFor('ciao22king', { displayName: '' }), 'ciao22king');
  assert.equal(displayNameFor('ciao22king', { displayName: 'Drix' }), 'Drix');
});

test('senza avatar si usa quello di GitHub', () => {
  assert.equal(avatarFor('ciao22king', { avatarUrl: '' }), 'https://avatars.githubusercontent.com/ciao22king');
  assert.equal(avatarFor('ciao22king', { avatarUrl: 'https://x.dev/a.png' }), 'https://x.dev/a.png');
});

test('i link social partono sempre da GitHub', () => {
  const links = socialLinksFor('ciao22king', { ...emptyProfile('ciao22king'), x: 'https://x.com/a' });
  assert.equal(links[0].key, 'github');
  assert.equal(links[0].url, githubUrl('ciao22king'));
  assert.equal(links.length, 2);
  assert.equal(links[1].url, 'https://x.com/a');
});

test('un profilo vuoto non mostra altri link oltre a GitHub', () => {
  const links = socialLinksFor('a', emptyProfile('a'));
  assert.equal(links.length, 1);
});

test('toProfileInput riporta i campi nel form', () => {
  const input = toProfileInput({ ...emptyProfile('a'), displayName: 'D', x: 'https://x.com/a' });
  assert.equal(input.displayName, 'D');
  assert.equal(input.x, 'https://x.com/a');
});

test('ogni social ha un URL base tranne i link liberi', () => {
  const withBase = SOCIALS.filter((s) => s.base).map((s) => s.key);
  assert.deepEqual(withBase, ['x', 'linkedin', 'youtube']);
});

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

test('i badge seguono i fatti, non la mano', () => {
  const stats = { published: 1, stars: 0, downloads: 0 };
  assert.deepEqual(publicProfileBadges(stats).map((b) => b.id), []);
  assert.deepEqual(
    publicProfileBadges(stats, { founding: true }).map((b) => b.id),
    ['founding'],
  );
  assert.deepEqual(
    publicProfileBadges(stats, { founding: true, verified: true, featured: true }).map((b) => b.id),
    ['founding', 'verified', 'featured'],
  );
});

test('top author richiede pubblicazioni e stelle', () => {
  assert.equal(isTopAuthor({ published: TOP_AUTHOR.published, stars: TOP_AUTHOR.stars, downloads: 0 }), true);
  assert.equal(isTopAuthor({ published: TOP_AUTHOR.published, stars: TOP_AUTHOR.stars - 1, downloads: 0 }), false);
  assert.equal(isTopAuthor({ published: TOP_AUTHOR.published - 1, stars: 999, downloads: 0 }), false);
});

test('top author compare tra i badge quando guadagnato', () => {
  const badges = publicProfileBadges({ published: TOP_AUTHOR.published, stars: TOP_AUTHOR.stars, downloads: 0 });
  assert.deepEqual(badges.map((b) => b.id), ['top-author']);
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

test('un profilo vuoto o sospeso non e indicizzabile', () => {
  assert.equal(isProfileIndexable({ published: 0, suspended: false }), false);
  assert.equal(isProfileIndexable({ published: 3, suspended: true }), false);
  assert.equal(isProfileIndexable({ published: 3, suspended: false }), true);
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

test('un report valido richiede login e motivo', () => {
  assert.equal(validateProfileReport({ username: 'ciao22king', reason: 'spam' }).ok, true);
  assert.equal(validateProfileReport({ username: 'bad--name', reason: 'spam' }).ok, false);
  assert.equal(validateProfileReport({ username: 'ciao22king', reason: 'nope' }).ok, false);
  assert.equal(validateProfileReport({}).ok, false);
});

test('la nota di un report e ripulita dal markup', () => {
  const res = validateProfileReport({
    username: 'a',
    reason: 'spam',
    note: '<script>alert(1)</script>',
  });
  assert.equal(res.value?.note, 'alert(1)');
});

test('ogni motivo ha un' + "'" + 'etichetta', () => {
  assert.equal(profileReasonLabel('impersonation'), 'Impersonation or a fake account');
  assert.ok(profileReasonLabel('other').length > 0);
});
