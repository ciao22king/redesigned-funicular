import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  initialState,
  reduce,
  listViewport,
  type Action,
  type AppState,
  type SkillRow,
} from '../src/tui/state.js';
import type { Section } from '../src/tui/sections.js';

/** Applies a list of actions in order, as the shell would. */
function run(state: AppState, actions: Action[]): AppState {
  return actions.reduce((acc, action) => reduce(acc, action), state);
}

function rows(n: number): SkillRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `owner/skill-${i}`,
    name: `Skill ${i}`,
    description: `desc ${i}`,
    stars: i,
    tags: [],
    updatedAt: '2026-11-05',
  }));
}

function sections(n: number): Section[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Sezione ${i}`,
    body: `corpo ${i}`,
    level: 2,
  }));
}

function withList(n: number, height = 24): AppState {
  const base = initialState(80, height);
  return reduce(base, { type: 'loadedList', items: rows(n), total: n, page: 1, pages: 1 });
}

function withDetail(n: number, height = 24): AppState {
  const state = reduce(withList(1, height), { type: 'open' });
  return reduce(state, {
    type: 'loadedDetail',
    id: 'owner/skill-0',
    name: 'Skill 0',
    markdown: '',
    sections: sections(n),
  });
}

describe('tui/state', () => {
  test('il cursore non esce dalla lista', () => {
    let state = withList(3);
    state = run(state, [
      { type: 'move', delta: -1 },
      { type: 'move', delta: -1 },
    ]);
    assert.equal(state.list.cursor, 0);
    state = run(state, [
      { type: 'move', delta: 1 },
      { type: 'move', delta: 1 },
      { type: 'move', delta: 1 },
      { type: 'move', delta: 1 },
    ]);
    assert.equal(state.list.cursor, 2);
  });

  test('su una lista vuota il cursore resta a zero', () => {
    const state = run(withList(0), [{ type: 'move', delta: 5 }]);
    assert.equal(state.list.cursor, 0);
  });

  test('la finestra scorre per tenere il cursore visibile', () => {
    const height = 10;
    const viewport = listViewport(initialState(80, height));
    let state = withList(50, height);
    const moves = viewport + 2;
    state = run(
      state,
      Array.from({ length: moves }, () => ({ type: 'move', delta: 1 }) as Action),
    );
    assert.equal(state.list.cursor, moves);
    assert.ok(state.list.offset > 0, 'la finestra deve essersi spostata');
    assert.ok(
      state.list.cursor < state.list.offset + viewport,
      'il cursore deve restare dentro la finestra',
    );
  });

  test('torna su quando il cursore risale sopra la finestra', () => {
    let state = withList(50, 10);
    state = run(state, [{ type: 'bottom' }]);
    assert.ok(state.list.offset > 0);
    state = run(state, [{ type: 'top' }]);
    assert.equal(state.list.offset, 0);
    assert.equal(state.list.cursor, 0);
  });

  test('Enter sulla lista apre il dettaglio e segnala il caricamento', () => {
    const state = run(withList(3), [{ type: 'open' }]);
    assert.equal(state.screen, 'detail');
    assert.equal(state.detail.loading, true);
    assert.equal(state.detail.id, 'owner/skill-0');
  });

  test('al caricamento la prima sezione e gia aperta', () => {
    const state = withDetail(4);
    assert.equal(state.detail.sections.length, 4);
    assert.ok(state.detail.expanded.has(0), 'la prima sezione deve essere aperta');
    assert.equal(state.detail.expanded.size, 1);
  });

  test('un click su una sezione la apre e la chiude', () => {
    let state = withDetail(4);
    state = reduce(state, { type: 'toggle', index: 2 });
    assert.ok(state.detail.expanded.has(2));
    assert.equal(state.detail.cursor, 2);
    state = reduce(state, { type: 'toggle', index: 2 });
    assert.ok(!state.detail.expanded.has(2));
  });

  test('un click fuori dalle sezioni non cambia nulla', () => {
    const state = withDetail(3);
    assert.equal(reduce(state, { type: 'toggle', index: 99 }), state);
    assert.equal(reduce(state, { type: 'toggle', index: -1 }), state);
  });

  test('Esc torna alla lista dal dettaglio', () => {
    const state = run(withDetail(3), [{ type: 'back' }]);
    assert.equal(state.screen, 'list');
  });

  test('la ricerca assorbe i tasti finche non si conferma', () => {
    let state = run(withList(3), [{ type: 'startSearch' }]);
    assert.equal(state.editing, true);
    state = reduce(state, { type: 'query', value: 'docker' });
    assert.equal(state.query, 'docker');
    state = reduce(state, { type: 'submitSearch' });
    assert.equal(state.editing, false);
    assert.equal(state.busy, true);
    assert.equal(state.query, 'docker');
  });

  test('Esc annulla la ricerca senza cancellare il testo', () => {
    let state = run(withList(3), [{ type: 'startSearch' }, { type: 'query', value: 'abc' }]);
    state = reduce(state, { type: 'back' });
    assert.equal(state.editing, false);
    assert.equal(state.query, 'abc');
  });

  test('il pannello di aiuto si apre e si chiude tornando alla schermata di prima', () => {
    let state = withDetail(2);
    state = reduce(state, { type: 'help' });
    assert.equal(state.screen, 'help');
    assert.equal(state.previous, 'detail');
    state = reduce(state, { type: 'help' });
    assert.equal(state.screen, 'detail');
  });

  test('un errore spegne il caricamento e mostra il messaggio', () => {
    const state = reduce(withList(3), { type: 'failed', message: 'boom' });
    assert.equal(state.busy, false);
    assert.equal(state.status, 'boom');
  });

  test('un ridimensionamento non perde il cursore', () => {
    let state = withList(50, 24);
    state = run(state, [{ type: 'bottom' }]);
    const cursor = state.list.cursor;
    state = reduce(state, { type: 'resize', width: 100, height: 12 });
    assert.equal(state.list.cursor, cursor);
    assert.ok(state.list.offset > 0);
  });

  test('la rotellina scorre il documento senza muovere la selezione', () => {
    // Una sezione con un corpo lungo, cosi il documento supera la finestra.
    const long: Section[] = [
      { title: 'Lunga', body: Array.from({ length: 40 }, (_, i) => `riga ${i}`).join('\n'), level: 2 },
      { title: 'Corta', body: 'breve', level: 2 },
    ];
    const opened = reduce(withList(1, 12), { type: 'open' });
    let state = reduce(opened, {
      type: 'loadedDetail',
      id: 'owner/skill-0',
      name: 'Skill 0',
      markdown: '',
      sections: long,
    });
    const cursorBefore = state.detail.cursor;
    state = reduce(state, { type: 'scroll', delta: 5 });
    assert.equal(state.detail.offset, 5, 'la vista deve scorrere');
    assert.equal(state.detail.cursor, cursorBefore, 'la selezione non deve muoversi');
  });

  test('lo scorrimento non supera la fine del documento', () => {
    const state = withDetail(2, 12);
    const scrolled = run(state, [
      { type: 'scroll', delta: 9999 },
    ]);
    const total = scrolled.detail.sections.length;
    assert.ok(scrolled.detail.offset >= 0);
    assert.ok(scrolled.detail.offset <= total);
  });

  test('la rotellina sulla lista muove comunque il cursore', () => {
    const state = reduce(withList(10), { type: 'scroll', delta: 2 });
    assert.equal(state.list.cursor, 2);
  });
});
