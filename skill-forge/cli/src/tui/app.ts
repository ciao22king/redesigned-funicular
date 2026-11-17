/**
 * The interactive shell: terminal setup, event loop, data loading.
 *
 * This is the only impure part of the view. It wires the pure pieces together:
 * `input.ts` turns bytes into actions, `state.ts` applies them, `render.ts`
 * draws the result. Keeping the terminal code here means the navigation rules
 * stay testable without a TTY.
 *
 * The screen is the alternate buffer, so the user's scrollback is untouched,
 * and the mouse is reported in SGR mode (1006) which is unambiguous past column
 * 223.
 */

import { parseInput, type MouseEvent } from './input.js';
import { render } from './render.js';
import { hitTestDetail, hitTestHeader, hitTestList, detailLines } from './layout.js';
import {
  initialState,
  reduce,
  type Action,
  type SkillRow,
} from './state.js';
import { parseDocument } from './sections.js';
import type { Client } from '../api.js';
import { stripFences } from '../skill.js';

const ENTER_ALT = '\u001b[?1049h';
const LEAVE_ALT = '\u001b[?1049l';
const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';
const ENABLE_MOUSE = '\u001b[?1000h\u001b[?1006h';
const DISABLE_MOUSE = '\u001b[?1000l\u001b[?1006l';
const CLEAR = '\u001b[2J\u001b[H';
const HOME = '\u001b[H';

export interface BrowseOptions {
  client: Client;
  query?: string;
  /** Injectable for tests: the loop ends when this resolves. */
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}

/** Runs the interactive view until the user quits. Returns an exit code. */
export async function browse(options: BrowseOptions): Promise<number> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  if (!input.isTTY || !output.isTTY) {
    output.write('The interactive view needs a terminal.\n');
    output.write('Use `skill-forge list` for the plain output.\n');
    return 1;
  }

  const width = output.columns || 80;
  const height = output.rows || 24;
  let state = initialState(width, height);
  let quitting = false;
  let dirty = true;
  let lastLines: string[] = [];

  const dispatch = (action: Action) => {
    state = reduce(state, action);
    dirty = true;
  };

  const draw = () => {
    const { lines } = render(state);
    let buffer = '';
    // Redraw only the lines that changed: a full repaint flickers on slow
    // terminals when only the cursor moved.
    for (let i = 0; i < Math.max(lines.length, lastLines.length); i++) {
      const line = lines[i] ?? '';
      if (line === lastLines[i]) continue;
      buffer += `\u001b[${i + 1};1H\u001b[2K${line}`;
    }
    buffer += HOME;
    output.write(buffer);
    lastLines = lines;
    dirty = false;
  };

  const restore = () => {
    output.write(DISABLE_MOUSE + SHOW_CURSOR + LEAVE_ALT);
    if (input.isTTY && typeof input.setRawMode === 'function') input.setRawMode(false);
    input.pause();
  };

  // ── Data loading ────────────────────────────────────────────────────────
  const loadList = async (query: string | undefined, page: number) => {
    dispatch({ type: 'loading', message: 'Loading…' });
    try {
      const data = await options.client.list({ q: query, page });
      const items: SkillRow[] = data.skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        stars: s.stars,
        tags: s.tags,
        updatedAt: s.updatedAt,
      }));
      dispatch({ type: 'loadedList', items, total: data.total, page: data.page, pages: data.pages });
    } catch (err) {
      dispatch({ type: 'failed', message: err instanceof Error ? err.message : 'Request failed.' });
    }
  };

  const openDetail = async (id: string) => {
    try {
      const skill = await options.client.detail(id);
      const markdown = stripFences(skill.markdown);
      dispatch({
        type: 'loadedDetail',
        id: skill.id,
        name: skill.name,
        markdown,
        sections: parseDocument(markdown).sections,
      });
    } catch (err) {
      dispatch({ type: 'failed', message: err instanceof Error ? err.message : 'Request failed.' });
      dispatch({ type: 'back' });
    }
  };

  /** Opens a skill from the list: switches the screen, then loads it. */
  const openSkill = (id: string) => {
    dispatch({ type: 'open' });
    return enqueue(() => openDetail(id));
  };

  // ── Input ───────────────────────────────────────────────────────────────
  // Work is queued rather than run inline: an async load (opening a skill) must
  // finish and repaint before the next action starts, otherwise two fast clicks
  // can interleave and the older result lands last.
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): Promise<void> => {
    queue = queue.then(task).then(() => {
      if (quitting) {
        cleanup();
        return;
      }
      if (dirty) draw();
    });
    return queue;
  };

  const onMouse = (event: MouseEvent) => {
    if (event.kind === 'move') return;

    if (event.button === 64 || event.button === 65) {
      dispatch({ type: 'scroll', delta: event.button === 64 ? -3 : 3 });
      return;
    }
    if (event.kind !== 'press') return;

    if (hitTestHeader(event.y) && state.screen === 'list') {
      dispatch({ type: 'startSearch' });
      return;
    }
    if (state.screen === 'list') {
      const index = hitTestList(state.list.items.length, state.height, event.y, state.list.offset);
      if (index >= 0) {
        dispatch({ type: 'focus', index });
        const row = state.list.items[index];
        if (row) void openSkill(row.id);
      }
      return;
    }
    if (state.screen === 'detail') {
      const lines = detailLines(state.detail.sections, state.detail.expanded, state.width);
      const index = hitTestDetail(lines, state.height, event.y, state.detail.offset);
      if (index >= 0) dispatch({ type: 'toggle', index });
    }
  };

  const onText = (text: string) => {
    if (state.editing) {
      if (text === '\b') {
        dispatch({ type: 'query', value: state.query.slice(0, -1) });
        return;
      }
      dispatch({ type: 'query', value: state.query + text });
      return;
    }
    // Outside the search box the keys are single-letter commands, so `q` quits
    // and `?` opens the help instead of being typed into nothing.
    for (const ch of text) {
      switch (ch) {
        case 'q':
          quitting = true;
          return;
        case '?':
          dispatch({ type: 'help' });
          break;
        case '/':
          dispatch({ type: 'startSearch' });
          break;
        case 'j':
          dispatch({ type: 'move', delta: 1 });
          break;
        case 'k':
          dispatch({ type: 'move', delta: -1 });
          break;
        case 'g':
          dispatch({ type: 'top' });
          break;
        case 'G':
          dispatch({ type: 'bottom' });
          break;
        default:
          break;
      }
    }
  };

  const handleAction = async (action: Action) => {
    // While the search box is focused, Enter confirms the search instead of
    // opening the selected skill.
    if (action.type === 'open' && state.editing) {
      dispatch({ type: 'submitSearch' });
      await loadList(state.query || undefined, 1);
      return;
    }
    // The `open` action on the list screen means "load the selected skill".
    if (action.type === 'open' && state.screen === 'list') {
      const row = state.list.items[state.list.cursor];
      if (row) await openSkill(row.id);
      return;
    }
    if (action.type === 'submitSearch') {
      dispatch(action);
      await loadList(state.query || undefined, 1);
      return;
    }
    if (action.type === 'quit') {
      quitting = true;
      return;
    }
    if (action.type === 'startSearch') {
      dispatch({ type: 'startSearch' });
      return;
    }
    dispatch(action);
  };

  const onData = (chunk: Buffer | string) => {
    for (const event of parseInput(chunk.toString('utf8'))) {
      if (event.type === 'mouse') {
        onMouse(event.event);
      } else if (event.type === 'text' || event.type === 'paste') {
        onText(event.text);
      } else {
        void enqueue(() => handleAction(event.action));
      }
      if (quitting) break;
    }
    if (quitting) {
      cleanup();
      return;
    }
    if (dirty) draw();
  };

  const onResize = () => {
    dispatch({ type: 'resize', width: output.columns || 80, height: output.rows || 24 });
    output.write(CLEAR);
    lastLines = [];
    draw();
  };

  const cleanup = () => {
    restore();
    input.off('data', onData);
    output.off('resize', onResize);
    resolve();
  };

  let resolve: () => void = () => {};
  const done = new Promise<void>((r) => {
    resolve = r;
  });

  // ── Start ───────────────────────────────────────────────────────────────
  output.write(ENTER_ALT + CLEAR + HIDE_CURSOR + ENABLE_MOUSE);
  if (typeof input.setRawMode === 'function') input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  input.on('data', onData);
  output.on('resize', onResize);

  draw();
  await loadList(options.query, 1);
  draw();

  await done;
  return 0;
}
