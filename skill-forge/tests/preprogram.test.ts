import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preProgram, preProgramCutoff, withinPreProgram } from '../src/lib/preProgram';

test('la scadenza e il 15 dicembre 2026', () => {
  assert.equal(preProgram.deadline, '2026-12-15');
  assert.equal(preProgram.deadlineLabel, 'December 15, 2026');
});

test('il taglio e l inizio del 16 dicembre UTC', () => {
  assert.equal(preProgramCutoff, Date.parse('2026-12-16T00:00:00.000Z'));
});

test('un account creato prima della scadenza entra nel programma', () => {
  assert.equal(withinPreProgram('2026-11-05T12:00:00.000Z'), true);
});

test('il giorno della scadenza conta fino a fine giornata UTC', () => {
  assert.equal(withinPreProgram('2026-12-15T23:59:59.000Z'), true);
});

test('un account creato dopo la scadenza non entra', () => {
  assert.equal(withinPreProgram('2026-12-16T00:00:00.000Z'), false);
  assert.equal(withinPreProgram('2027-01-01T00:00:00.000Z'), false);
});

test('accetta Date, stringhe ISO e millisecondi', () => {
  assert.equal(withinPreProgram(new Date('2026-12-10T00:00:00.000Z')), true);
  assert.equal(withinPreProgram(Date.parse('2026-12-20T00:00:00.000Z')), false);
});

test('una data non valida non entra nel programma', () => {
  assert.equal(withinPreProgram('non-una-data'), false);
  assert.equal(withinPreProgram(Number.NaN), false);
});
