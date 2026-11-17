import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { initialState, reduce, type AppState } from '../src/tui/state.js';
import { render } from '../src/tui/render.js';
import { detailLines, hitTestDetail, hitTestList } from '../src/tui/layout.js';
import { stripAnsi, visibleLength } from '../src/tui/text.js';
import type { Section } from '../src/tui/sections.js';

function listState(height = 24, width = 80): AppState {
  const base = initialState(width, height);
  return reduce(base, {
    type: 'loadedList',
    items: [
      { id: 'owner/uno', name: 'Uno', description: 'prima', stars: 3, tags: [], updatedAt: '2026-11-05' },
      { id: 'owner/due', name: 'Due', description: 'seconda', stars: 0, tags: [], updatedAt: '2026-11-04' },
    ],
    total: 2,
    page: 1,
    pages: 1,
  });
}

function detailState(height = 24, width = 80): AppState {
  const sections: Section[] = [
    { title: 'When to use it', body: 'Usala quando serve.', level: 2 },
    { title: 'Procedure', body: '1. Fai questo.\n2. Poi quello.', level: 2 },
  ];
  const opened = reduce(listState(height, width), { type: 'open' });
  return reduce(opened, {
    type: 'loadedDetail',
    id: 'owner/uno',
    name: 'Uno',
    markdown: '',
    sections,
  });
}

/** Every drawn line must be exactly `width` columns. */
function assertRectangular(state: AppState) {
  const { lines } = render(state);
  for (const [i, line] of lines.entries()) {
    assert.equal(visibleLength(line), state.width, `riga ${i} non larga ${state.width}: ${JSON.stringify(stripAnsi(line))}`);
  }
  assert.equal(lines.length, state.height, 'il frame deve riempire esattamente l altezza');
}

describe('tui/render', () => {
  test('il frame della lista e rettangolare', () => {
    assertRectangular(listState());
  });

  test('il frame del dettaglio e rettangolare', () => {
    assertRectangular(detailState());
  });

  test('il frame dell aiuto e rettangolare', () => {
    assertRectangular(reduce(detailState(), { type: 'help' }));
  });

  test('la lista mostra id e descrizione', () => {
    const text = stripAnsi(render(listState()).lines.join('\n'));
    assert.match(text, /owner\/uno/);
    assert.match(text, /prima/);
  });

  test('il dettaglio mostra la prima sezione aperta', () => {
    const text = stripAnsi(render(detailState()).lines.join('\n'));
    assert.match(text, /When to use it/);
    assert.match(text, /Usala quando serve/);
  });

  test('una sezione chiusa mostra il titolo ma non il corpo', () => {
    const text = stripAnsi(render(detailState()).lines.join('\n'));
    assert.match(text, /Procedure/);
    assert.ok(!text.includes('Fai questo'), 'il corpo della sezione chiusa non deve comparire');
  });

  test('una lista vuota non lascia righe di lunghezza sbagliata', () => {
    const state = reduce(initialState(80, 20), {
      type: 'loadedList',
      items: [],
      total: 0,
      page: 1,
      pages: 1,
    });
    assertRectangular(state);
    assert.match(stripAnsi(render(state).lines.join('\n')), /No skills found/);
  });

  test('anche a larghezze estreme il frame resta rettangolare', () => {
    for (const width of [20, 40, 120]) {
      for (const height of [6, 12, 40]) {
        assertRectangular(listState(height, width));
        assertRectangular(detailState(height, width));
      }
    }
  });
});

describe('tui/layout — hit test', () => {
  test('il click su una riga colpisce la riga disegnata li', () => {
    // Con offset 0 la prima riga sta sotto intestazione + titoli di colonna.
    assert.equal(hitTestList(10, 24, 2, 0), 0);
    assert.equal(hitTestList(10, 24, 3, 0), 1);
  });

  test('l hit test rispetta lo scorrimento', () => {
    assert.equal(hitTestList(50, 24, 2, 10), 10);
  });

  test('il click sull intestazione o sul footer non e una riga', () => {
    assert.equal(hitTestList(10, 24, 0, 0), -1);
    assert.equal(hitTestList(10, 24, 23, 0), -1);
  });

  test('il click oltre le righe disponibili non seleziona nulla', () => {
    assert.equal(hitTestList(2, 24, 10, 0), -1);
  });

  test('il click su un titolo di sezione restituisce quella sezione', () => {
    const sections: Section[] = [
      { title: 'A', body: 'corpo', level: 2 },
      { title: 'B', body: 'corpo', level: 2 },
    ];
    const lines = detailLines(sections, new Set([0]), 80);
    // riga 0: titolo A, riga 1: corpo A, riga 2: titolo B
    assert.equal(hitTestDetail(lines, 24, 1, 0), 0);
    assert.equal(hitTestDetail(lines, 24, 3, 0), 1);
  });

  test('il click sul corpo di una sezione colpisce comunque quella sezione', () => {
    const sections: Section[] = [{ title: 'A', body: 'una riga di corpo', level: 2 }];
    const lines = detailLines(sections, new Set([0]), 80);
    assert.equal(hitTestDetail(lines, 24, 2, 0), 0);
  });
});
