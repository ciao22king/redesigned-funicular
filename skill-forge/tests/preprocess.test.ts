import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeTranscript,
  normalizeNotes,
  preprocessMaterial,
  transcriptToText,
} from '../src/lib/preprocess';

/**
 * Pre-processing is the difference between feeding the model a subtitle file
 * and feeding it the meeting it recorded. These tests pin the two behaviours:
 * transcripts become prose, messy notes are tidied, and both are idempotent.
 */

const SRT = `1
00:00:01,000 --> 00:00:04,000
Alice: The deploy keeps failing on staging.

2
00:00:04,000 --> 00:00:07,000
Alice: Someone needs to check the migration.

3
00:00:07,000 --> 00:00:10,000
Bob: And we forget the changelog every release.

4
00:00:10,000 --> 00:00:13,000
Bob: Let's make it part of the PR.
`;

test('riconosce un file SRT e uno VTT', () => {
  assert.equal(looksLikeTranscript(SRT), true);
  assert.equal(looksLikeTranscript('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nciao'), true);
  assert.equal(looksLikeTranscript('# Note\n\nsolo appunti normali'), false);
});

test('converte l SRT in prosa, senza tempi ne numeri di cue', () => {
  const text = transcriptToText(SRT);
  assert.ok(!/\d{2}:\d{2}:\d{2}/.test(text));
  assert.ok(!/^\s*\d+\s*$/m.test(text));
  assert.match(text, /Alice: The deploy keeps failing on staging\./);
  assert.match(text, /Bob: And we forget the changelog every release\./);
});

test('unisce i turni consecutivi dello stesso parlante', () => {
  const text = transcriptToText(SRT);
  assert.match(text, /Alice: The deploy keeps failing on staging\. Someone needs to check the migration\./);
  const aliceLines = text.split('\n\n').filter((l) => l.startsWith('Alice:'));
  assert.equal(aliceLines.length, 1);
});

test('toglie BOM, righe decorative e marker di pagina', () => {
  const messy = '\uFEFFIntro\n-----\nPage 1 of 3\nContenuto vero\n======\nAltro contenuto\n';
  const clean = normalizeNotes(messy);
  assert.ok(!clean.includes('\uFEFF'));
  assert.ok(!clean.includes('-----'));
  assert.ok(!/Page 1 of 3/.test(clean));
  assert.match(clean, /Contenuto vero/);
  assert.match(clean, /Altro contenuto/);
});

test('non riscrive le parole, solo la cornice', () => {
  const text = 'nota uno\n\n\n\n\nnota due';
  assert.equal(normalizeNotes(text), 'nota uno\n\nnota due');
});

test('preprocessMaterial segnala cosa ha applicato ed e idempotente', () => {
  const first = preprocessMaterial(SRT);
  assert.ok(first.applied.some((a) => a.includes('transcript')));
  const second = preprocessMaterial(first.text);
  assert.equal(second.text, first.text);
});

test('del testo gia pulito non viene toccato', () => {
  const clean = 'Una nota ordinata.\n\nUn altro paragrafo.';
  const result = preprocessMaterial(clean);
  assert.equal(result.text, clean);
  assert.deepEqual(result.applied, []);
});
