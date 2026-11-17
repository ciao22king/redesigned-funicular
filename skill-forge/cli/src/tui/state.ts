/**
 * State of the interactive view, and the transitions between states.
 *
 * This module is pure: no terminal, no timers, no I/O. `reduce` takes the
 * current state and an action and returns the next state, so every navigation
 * rule (where the cursor stops, which section a click opens, what Escape does)
 * is testable without a real TTY. `render.ts` turns the state into a frame, and
 * `app.ts` owns the only impure parts: reading keys and writing to stdout.
 */

import type { Section } from './sections.js';
import { detailLines, detailViewportFor, listViewportFor } from './layout.js';

export type Screen = 'list' | 'detail' | 'help';

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  stars: number;
  tags: string[];
  updatedAt: string;
}

export interface ListState {
  items: SkillRow[];
  total: number;
  page: number;
  pages: number;
  cursor: number;
  /** First row shown, for when the list is longer than the window. */
  offset: number;
}

export interface DetailState {
  id: string;
  name: string;
  markdown: string;
  sections: Section[];
  /** Indexes of the sections currently open. Everything else is a title only. */
  expanded: Set<number>;
  cursor: number;
  offset: number;
  loading: boolean;
}

export interface AppState {
  screen: Screen;
  /** Screen to come back to when the help overlay closes. */
  previous: Screen;
  width: number;
  height: number;
  /** One-line message in the footer. */
  status: string;
  /** True while a request is in flight. */
  busy: boolean;
  /** The search box is focused and keystrokes go into `query`. */
  editing: boolean;
  query: string;
  list: ListState;
  detail: DetailState;
}

/** Actions the shell can produce. A mouse click is resolved to a row first. */
export type Action =
  | { type: 'resize'; width: number; height: number }
  | { type: 'move'; delta: number }
  | { type: 'scroll'; delta: number }
  | { type: 'page'; delta: number }
  | { type: 'top' }
  | { type: 'bottom' }
  | { type: 'open' }
  | { type: 'back' }
  | { type: 'quit' }
  | { type: 'help' }
  | { type: 'startSearch' }
  | { type: 'cancelSearch' }
  | { type: 'submitSearch' }
  | { type: 'query'; value: string }
  | { type: 'toggle'; index: number }
  | { type: 'focus'; index: number }
  | { type: 'loading'; message: string }
  | { type: 'status'; message: string }
  | { type: 'loadedList'; items: SkillRow[]; total: number; page: number; pages: number }
  | { type: 'loadedDetail'; id: string; name: string; markdown: string; sections: Section[] }
  | { type: 'failed'; message: string };

export function initialState(width = 80, height = 24): AppState {
  return {
    screen: 'list',
    previous: 'list',
    width,
    height,
    status: 'Enter opens a skill, / searches, q quits.',
    busy: false,
    editing: false,
    query: '',
    list: { items: [], total: 0, page: 1, pages: 1, cursor: 0, offset: 0 },
    detail: {
      id: '',
      name: '',
      markdown: '',
      sections: [],
      expanded: new Set(),
      cursor: 0,
      offset: 0,
      loading: false,
    },
  };
}

/**
 * Rows a list window can show: the frame spends one line on the header, one on
 * the column titles and one on the footer.
 */
export function listViewport(state: AppState): number {
  return listViewportFor(state.height);
}

/**
 * Lines a detail window can show. Sections cost one line when closed and one
 * per body line when open, so the viewport is computed against the rendered
 * lines rather than a fixed number of items.
 */
export function detailViewport(state: AppState): number {
  return detailViewportFor(state.height);
}

/** Keeps `offset` such that `cursor` is inside the visible window. */
function scrollToCursor(offset: number, cursor: number, viewport: number): number {
  if (cursor < offset) return cursor;
  if (cursor >= offset + viewport) return cursor - viewport + 1;
  return Math.max(0, offset);
}

function clampCursor(cursor: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, cursor), length - 1);
}

/**
 * Applies an action. Returns the same object when nothing changes, so the shell
 * can skip a redraw.
 */
export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'resize': {
      const next = { ...state, width: action.width, height: action.height };
      return { ...next, list: reflowList(next), detail: reflowDetail(next) };
    }
    case 'quit':
      return state;

    case 'help':
      return state.screen === 'help'
        ? { ...state, screen: state.previous }
        : { ...state, previous: state.screen, screen: 'help' };

    case 'move': {
      if (state.screen === 'list') {
        const cursor = clampCursor(state.list.cursor + action.delta, state.list.items.length);
        return {
          ...state,
          list: {
            ...state.list,
            cursor,
            offset: scrollToCursor(state.list.offset, cursor, listViewport(state)),
          },
        };
      }
      if (state.screen === 'detail') {
        const cursor = clampCursor(state.detail.cursor + action.delta, state.detail.sections.length);
        // Moving the selection also scrolls the document to keep the section
        // title in view; the offset is clamped against the rendered height.
        const next = { ...state, detail: { ...state.detail, cursor } };
        return { ...next, detail: { ...next.detail, offset: scrollDetailToCursor(next) } };
      }
      return state;
    }

    case 'page':
      return reduce(state, { type: 'move', delta: action.delta * listViewport(state) });

    case 'scroll': {
      if (state.screen !== 'detail') {
        return reduce(state, { type: 'move', delta: action.delta });
      }
      const total = detailLines(state.detail.sections, state.detail.expanded, state.width).length;
      const max = Math.max(0, total - detailViewport(state));
      const offset = Math.min(Math.max(0, state.detail.offset + action.delta), max);
      if (offset === state.detail.offset) return state;
      return { ...state, detail: { ...state.detail, offset } };
    }

    case 'top':
      return reduce(state, { type: 'move', delta: -Number.MAX_SAFE_INTEGER });

    case 'bottom':
      return reduce(state, { type: 'move', delta: Number.MAX_SAFE_INTEGER });

    case 'focus': {
      if (state.screen === 'list') {
        const cursor = clampCursor(action.index, state.list.items.length);
        return {
          ...state,
          list: {
            ...state.list,
            cursor,
            offset: scrollToCursor(state.list.offset, cursor, listViewport(state)),
          },
        };
      }
      return state;
    }

    case 'toggle': {
      if (state.screen !== 'detail') return state;
      if (action.index < 0 || action.index >= state.detail.sections.length) return state;
      const expanded = new Set(state.detail.expanded);
      if (expanded.has(action.index)) expanded.delete(action.index);
      else expanded.add(action.index);
      const next = { ...state, detail: { ...state.detail, expanded, cursor: action.index } };
      return { ...next, detail: reflowDetail(next) };
    }

    case 'open': {
      if (state.screen === 'list') {
        const row = state.list.items[state.list.cursor];
        if (!row) return state;
        return {
          ...state,
          screen: 'detail',
          busy: true,
          status: `Loading ${row.id}…`,
          detail: { ...state.detail, id: row.id, loading: true, cursor: 0, offset: 0 },
        };
      }
      if (state.screen === 'detail') return reduce(state, { type: 'toggle', index: state.detail.cursor });
      return state;
    }

    case 'back': {
      if (state.editing) {
        return { ...state, editing: false, query: state.query };
      }
      if (state.screen === 'detail') {
        return { ...state, screen: 'list', status: 'Enter opens a skill, / searches, q quits.' };
      }
      if (state.screen === 'help') return { ...state, screen: state.previous };
      return state;
    }

    case 'startSearch':
      return { ...state, screen: 'list', editing: true, status: 'Type to search, Enter to confirm.' };

    case 'query':
      return { ...state, query: action.value };

    case 'cancelSearch':
      return { ...state, editing: false };

    case 'submitSearch':
      return {
        ...state,
        editing: false,
        busy: true,
        status: state.query ? `Searching “${state.query}”…` : 'Loading…',
      };

    case 'loading':
      return { ...state, busy: true, status: action.message };

    case 'status':
      return { ...state, busy: false, status: action.message };

    case 'loadedList': {
      const list: ListState = {
        items: action.items,
        total: action.total,
        page: action.page,
        pages: action.pages,
        cursor: 0,
        offset: 0,
      };
      const status =
        action.items.length === 0
          ? 'No skills found.'
          : `${action.total} skill${action.total === 1 ? '' : 's'}${
              action.pages > 1 ? ` — page ${action.page}/${action.pages}` : ''
            }.`;
      return { ...state, busy: false, status, list };
    }

    case 'loadedDetail': {
      // The first section is open by default: the view must show some content
      // without requiring a click to discover that sections are clickable.
      const expanded = new Set<number>(action.sections.length ? [0] : []);
      return {
        ...state,
        busy: false,
        status: 'Click a section to open or close it. Esc goes back.',
        detail: {
          ...state.detail,
          id: action.id,
          name: action.name,
          markdown: action.markdown,
          sections: action.sections,
          expanded,
          cursor: 0,
          offset: 0,
          loading: false,
        },
      };
    }

    case 'failed':
      return { ...state, busy: false, status: action.message };
  }
}

function reflowList(state: AppState): ListState {
  return {
    ...state.list,
    offset: scrollToCursor(state.list.offset, state.list.cursor, listViewport(state)),
  };
}

function reflowDetail(state: AppState): DetailState {
  const total = detailLines(state.detail.sections, state.detail.expanded, state.width).length;
  const max = Math.max(0, total - detailViewport(state));
  return { ...state.detail, offset: Math.min(Math.max(0, state.detail.offset), max) };
}

/**
 * Scrolls the document so the title line of the selected section is visible.
 * The titles are not at a fixed pitch, so the rendered lines are walked to find
 * the selected one rather than multiplying the index by a row height.
 */
function scrollDetailToCursor(state: AppState): number {
  const lines = detailLines(state.detail.sections, state.detail.expanded, state.width);
  const viewport = detailViewport(state);
  let first = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].isTitle && lines[i].sectionIndex === state.detail.cursor) {
      first = i;
      break;
    }
  }
  if (first === -1) return state.detail.offset;
  const max = Math.max(0, lines.length - viewport);
  return Math.min(scrollToCursor(state.detail.offset, first, viewport), max);
}
