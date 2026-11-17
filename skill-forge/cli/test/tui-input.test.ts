import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseInput } from '../src/tui/input.js';

/** Convenience: the actions found in a chunk, ignoring mouse and text. */
function actions(chunk: string) {
  return parseInput(chunk)
    .filter((e) => e.type === 'action')
    .map((e) => (e.type === 'action' ? e.action : null));
}

describe('tui/input — tasti', () => {
  test('le frecce muovono il cursore', () => {
    assert.deepEqual(actions('\u001b[A'), [{ type: 'move', delta: -1 }]);
    assert.deepEqual(actions('\u001b[B'), [{ type: 'move', delta: 1 }]);
  });

  test('PgUp e PgDn scorrono di una pagina', () => {
    assert.deepEqual(actions('\u001b[5~'), [{ type: 'page', delta: -1 }]);
    assert.deepEqual(actions('\u001b[6~'), [{ type: 'page', delta: 1 }]);
  });

  test('Home ed End saltano agli estremi', () => {
    assert.deepEqual(actions('\u001b[H'), [{ type: 'top' }]);
    assert.deepEqual(actions('\u001b[F'), [{ type: 'bottom' }]);
  });

  test('Invio apre, Ctrl-C esce', () => {
    assert.deepEqual(actions('\r'), [{ type: 'open' }]);
    assert.deepEqual(actions('\u0003'), [{ type: 'quit' }]);
  });

  test('Esc da solo e back', () => {
    assert.deepEqual(actions('\u001b'), [{ type: 'back' }]);
  });

  test('piu tasti nello stesso chunk producono piu azioni', () => {
    assert.deepEqual(actions('\u001b[B\u001b[B'), [
      { type: 'move', delta: 1 },
      { type: 'move', delta: 1 },
    ]);
  });

  test('un tasto sconosciuto non viene scambiato per testo', () => {
    assert.deepEqual(actions('\u001b[Z'), []);
  });
});

describe('tui/input — testo', () => {
  test('i caratteri stampabili diventano un solo evento', () => {
    const events = parseInput('docker');
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { type: 'text', text: 'docker' });
  });

  test('il backspace e un evento a se', () => {
    assert.deepEqual(parseInput('\u007f'), [{ type: 'text', text: '\b' }]);
  });

  test('una sequenza ANSI dentro il testo non viene inghiottita', () => {
    const events = parseInput('ab\u001b[Bcd');
    const texts = events.filter((e) => e.type === 'text').map((e) => (e.type === 'text' ? e.text : ''));
    assert.deepEqual(texts, ['ab', 'cd']);
    assert.deepEqual(actions('ab\u001b[Bcd'), [{ type: 'move', delta: 1 }]);
  });
});

describe('tui/input — mouse (SGR 1006)', () => {
  test('un click sinistro riporta coordinate a base zero', () => {
    // \u001b[<0;12;5M = pulsante 0 (sinistro), colonna 12, riga 5, pressione.
    const events = parseInput('\u001b[<0;12;5M');
    assert.equal(events.length, 1);
    const event = events[0];
    assert.equal(event.type, 'mouse');
    if (event.type !== 'mouse') return;
    assert.equal(event.event.kind, 'press');
    assert.equal(event.event.button, 0);
    assert.equal(event.event.x, 11);
    assert.equal(event.event.y, 4);
  });

  test('il rilascio usa la M minuscola', () => {
    const events = parseInput('\u001b[<0;3;4m');
    const event = events[0];
    if (event.type !== 'mouse') throw new Error('atteso un evento mouse');
    assert.equal(event.event.kind, 'release');
  });

  test('la rotellina e i pulsanti 64 e 65', () => {
    const up = parseInput('\u001b[<64;5;5M')[0];
    const down = parseInput('\u001b[<65;5;5M')[0];
    if (up.type !== 'mouse' || down.type !== 'mouse') throw new Error('atteso mouse');
    assert.equal(up.event.button, 64);
    assert.equal(down.event.button, 65);
  });

  test('i modificatori vengono decodificati', () => {
    // +4 shift, +8 alt, +16 ctrl sul pulsante 0.
    const event = parseInput('\u001b[<28;1;1M')[0];
    if (event.type !== 'mouse') throw new Error('atteso mouse');
    assert.equal(event.event.shift, true);
    assert.equal(event.event.alt, true);
    assert.equal(event.event.ctrl, true);
    assert.equal(event.event.button, 0);
  });

  test('un movimento non e una pressione', () => {
    const event = parseInput('\u001b[<32;5;5M')[0];
    if (event.type !== 'mouse') throw new Error('atteso mouse');
    assert.equal(event.event.kind, 'move');
  });
});
