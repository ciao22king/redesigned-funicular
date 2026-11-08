import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReportReason,
  MAX_NOTE_CHARS,
  reasonLabel,
  REPORT_REASONS,
  validateReport,
} from '../src/lib/reports';

test('tutte le ragioni note sono accettate', () => {
  for (const reason of REPORT_REASONS) {
    assert.equal(isReportReason(reason), true, reason);
  }
});

test('una ragione sconosciuta viene rifiutata', () => {
  assert.equal(isReportReason('perche-si'), false);
});

test('un id non valido viene rifiutato', () => {
  assert.equal(validateReport({ skillId: 'senza-slash', reason: 'spam' }).ok, false);
  assert.equal(validateReport({ skillId: 'a/b', reason: 'inventata' }).ok, false);
});

test('un report valido viene normalizzato', () => {
  const result = validateReport({ skillId: 'owner/slug', reason: 'malware', note: '  una nota  ' });
  assert.equal(result.ok, true);
  assert.equal(result.value?.reason, 'malware');
  assert.equal(result.value?.note, 'una nota');
});

test('la nota viene sanitizzata e troncata', () => {
  const result = validateReport({
    skillId: 'a/b',
    reason: 'other',
    note: `<b>${'x'.repeat(MAX_NOTE_CHARS + 20)}</b>`,
  });
  assert.equal(result.value?.note.length, MAX_NOTE_CHARS);
  assert.ok(!result.value?.note.includes('<'));
});

test('ogni ragione ha una etichetta', () => {
  for (const reason of REPORT_REASONS) {
    assert.ok(reasonLabel(reason).length > 0);
  }
});
