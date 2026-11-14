import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findAudience,
  findTone,
  audienceInstruction,
  toneInstruction,
  DEFAULT_AUDIENCE,
  DEFAULT_TONE,
} from '../src/lib/audience';
import { buildPlan, deriveTitle, detectAudience } from '../src/lib/plan';
import { parseQuestions } from '../src/lib/generate';

test('un target sconosciuto ricade sul predefinito', () => {
  assert.equal(findAudience('does-not-exist').id, DEFAULT_AUDIENCE);
  assert.equal(findAudience(undefined).id, DEFAULT_AUDIENCE);
});

test('un tono sconosciuto ricade sul predefinito', () => {
  assert.equal(findTone('does-not-exist').id, DEFAULT_TONE);
  assert.equal(findTone(undefined).id, DEFAULT_TONE);
});

test('ogni target produce un istruzione non vuota', () => {
  for (const id of ['claude-code', 'codex', 'generic-agent', 'human']) {
    assert.ok(audienceInstruction(id).length > 30, `${id} senza istruzione`);
  }
});

test('ogni tono produce un istruzione non vuota', () => {
  for (const id of ['concise', 'technical', 'didactic']) {
    assert.ok(toneInstruction(id).length > 20, `${id} senza istruzione`);
  }
});

test('il titolo viene dal primo heading', () => {
  assert.equal(deriveTitle('# Pull request review\n\ntext'), 'Pull request review');
  assert.equal(deriveTitle('no heading here\nsecond line'), 'no heading here');
});

test('il target viene dedotto dal materiale', () => {
  assert.equal(detectAudience('a CLAUDE.md file for the repo', 'human'), 'claude-code');
  assert.equal(detectAudience('for the team to read', 'claude-code'), 'human');
  assert.equal(detectAudience('nothing relevant', 'codex'), 'codex');
});

test('il riepilogo elenca i materiali e le mancanze', () => {
  const plan = buildPlan({
    text: '# Release check\n\nGoal: verify a release.\n\n- the version is TBD\n- deploy must never run on Friday',
    materials: [{ kind: 'file', label: 'notes.md', chars: 120 }],
    audience: 'claude-code',
  });
  assert.equal(plan.title, 'Release check');
  assert.equal(plan.materials.length, 1);
  assert.ok(plan.constraints.length >= 1, 'la regola "must never" deve essere rilevata');
  assert.ok(plan.missing.some((m) => /TBD/.test(m)), 'TBD deve finire tra le mancanze');
});

test('senza informazioni esplicite, il riepilogo aggiunge le domande strutturali', () => {
  const plan = buildPlan({ text: '# Thing\n\nA short description.', materials: [], audience: 'human' });
  assert.ok(plan.missing.some((m) => /NOT be used/i.test(m)));
  assert.ok(plan.missing.some((m) => /before starting/i.test(m)));
});

test('parseQuestions legge un array JSON, anche con fence', () => {
  assert.deepEqual(parseQuestions('["A question here?", "Another one?"]'), [
    'A question here?',
    'Another one?',
  ]);
  assert.deepEqual(parseQuestions('```json\n["Fenced question?"]\n```'), ['Fenced question?']);
});

test('parseQuestions ignora risposte non valide', () => {
  assert.deepEqual(parseQuestions('no array here'), []);
  assert.deepEqual(parseQuestions('[1, 2, 3]'), []);
  assert.deepEqual(parseQuestions('["ok but short"]'), ['ok but short']);
  const many = ['one question?', 'two question?', 'three question?', 'four question?', 'five question?', 'six question?', 'seven question?'];
  assert.equal(parseQuestions(JSON.stringify(many)).length, 5);
});
