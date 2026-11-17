import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USE_CASES, getUseCase, useCasePath } from '../src/lib/usecases';

test('ogni use case ha slug, titolo e almeno tre passi', () => {
  assert.ok(USE_CASES.length >= 5, 'almeno cinque casi');
  for (const u of USE_CASES) {
    assert.match(u.slug, /^[a-z0-9-]+$/, u.slug);
    assert.ok(u.title.length > 0, u.slug);
    assert.ok(u.steps.length >= 3, `${u.slug} ha ${u.steps.length} passi`);
  }
});

test('gli slug sono unici', () => {
  const slugs = USE_CASES.map((u) => u.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('useCasePath usa il segmento /use-cases/<slug>', () => {
  assert.equal(useCasePath('code-review'), '/use-cases/code-review');
});

test('getUseCase trova per slug e restituisce undefined se assente', () => {
  assert.equal(getUseCase('onboarding')?.title, 'Onboarding');
  assert.equal(getUseCase('non-esiste'), undefined);
});

test('useCasePath di ogni caso corrisponde al suo slug', () => {
  for (const u of USE_CASES) {
    assert.equal(useCasePath(u.slug), `/use-cases/${u.slug}`);
    assert.equal(getUseCase(u.slug)?.slug, u.slug);
  }
});
