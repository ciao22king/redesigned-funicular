import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEEDBACK_VERDICTS,
  isFeedbackVerdict,
  MAX_FEEDBACK_CHARS,
  summarizeFeedback,
  validateFeedback,
  VERDICT_LABELS,
} from '../src/lib/feedback';

test('tutti i verdetti noti sono accettati', () => {
  for (const v of FEEDBACK_VERDICTS) {
    assert.equal(isFeedbackVerdict(v), true, v);
  }
});

test('un verdetto sconosciuto viene rifiutato', () => {
  assert.equal(validateFeedback({ verdict: 'boh' }).ok, false);
  assert.equal(validateFeedback({}).ok, false);
});

test('un feedback valido viene normalizzato', () => {
  const result = validateFeedback({ verdict: 'partly', note: '  manca la sezione X  ' });
  assert.equal(result.ok, true);
  assert.equal(result.value?.verdict, 'partly');
  assert.equal(result.value?.note, 'manca la sezione X');
});

test('la nota e sanitizzata e troncata', () => {
  const result = validateFeedback({
    verdict: 'no',
    note: `<script>${'x'.repeat(MAX_FEEDBACK_CHARS + 30)}</script>`,
  });
  assert.equal(result.value?.note.length, MAX_FEEDBACK_CHARS);
  assert.ok(!result.value?.note.includes('<'));
});

test('la modalita sconosciuta ricade sul valore predefinito', () => {
  const result = validateFeedback({ verdict: 'yes', mode: 'hack' });
  assert.equal(result.value?.mode, 'from-skills');
  const known = validateFeedback({ verdict: 'yes', mode: 'demo' });
  assert.equal(known.value?.mode, 'demo');
});

test('il riepilogo conta i tre verdetti e la quota utile', () => {
  const summary = summarizeFeedback([
    { verdict: 'yes' },
    { verdict: 'yes' },
    { verdict: 'partly' },
    { verdict: 'no' },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.yes, 2);
  assert.equal(summary.partly, 1);
  assert.equal(summary.no, 1);
  assert.equal(summary.usefulShare, 0.75);
});

test('il riepilogo vuoto non divide per zero', () => {
  const summary = summarizeFeedback([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.usefulShare, 0);
});

test('ogni verdetto ha una etichetta', () => {
  for (const v of FEEDBACK_VERDICTS) {
    assert.ok(VERDICT_LABELS[v].length > 0);
  }
});
