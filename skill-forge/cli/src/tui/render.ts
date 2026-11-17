/**
 * Turns an `AppState` into the lines of a frame.
 *
 * Pure: same state in, same lines out, no terminal involved. The shell writes
 * the lines and clears what is left over, so a shorter frame cannot leave
 * debris from the previous one.
 */

import type { AppState } from './state.js';
import { detailLines, detailViewportFor, hitTestList, listViewportFor } from './layout.js';
import { fit, visibleLength } from './text.js';
import { color, truncate } from '../output.js';

export interface Frame {
  lines: string[];
}

/** The whole screen, one string per line, each exactly `width` columns wide. */
export function render(state: AppState): Frame {
  const lines =
    state.screen === 'help'
      ? renderHelp(state)
      : state.screen === 'detail'
        ? renderDetail(state)
        : renderList(state);
  return { lines };
}

function header(state: AppState, title: string, hint: string): string {
  const left = ` ${color.bold('skill-forge')} ${color.dim('›')} ${title}`;
  const right = `${color.dim(hint)} `;
  const gap = Math.max(1, state.width - visibleLength(left) - visibleLength(right));
  return fit(left + ' '.repeat(gap) + right, state.width);
}

function footer(state: AppState): string {
  const spinner = state.busy ? `${color.cyan('◐')} ` : '';
  const text = `${spinner}${state.status}`;
  return fit(` ${color.dim(truncate(text, Math.max(10, state.width - 2)))}`, state.width);
}

function renderList(state: AppState): string[] {
  const out: string[] = [];
  const title = state.editing
    ? `search: ${state.query}${color.cyan('▌')}`
    : state.query
      ? `search: ${color.cyan(state.query)}`
      : 'marketplace';
  out.push(header(state, title, '↑↓ move  Enter open  / search  ? help  q quit'));

  out.push(
    fit(
      ` ${color.bold(fit('ID', 30))}  ${color.bold(fit('★', 3))}  ${color.bold('DESCRIPTION')}`,
      state.width,
    ),
  );

  const viewport = listViewportFor(state.height);
  const slice = state.list.items.slice(state.list.offset, state.list.offset + viewport);
  for (let i = 0; i < viewport; i++) {
    const row = slice[i];
    if (!row) {
      out.push(fit('', state.width));
      continue;
    }
    const index = state.list.offset + i;
    const selected = index === state.list.cursor && !state.editing;
    const id = fit(truncate(row.id, 30), 30);
    const stars = fit(String(row.stars), 3);
    const desc = truncate(row.description || row.name, Math.max(10, state.width - 42));
    const body = ` ${id}  ${stars}  ${desc}`;
    out.push(selected ? color.cyan(fit(body, state.width)) : fit(body, state.width));
  }

  out.push(footer(state));
  return out;
}

function renderDetail(state: AppState): string[] {
  const out: string[] = [];
  const title = state.detail.name || state.detail.id || 'skill';
  out.push(header(state, `${color.dim(state.detail.id)}  ${title}`, 'Esc back  ↑↓ move  Enter toggle  ? help'));

  const lines = detailLines(state.detail.sections, state.detail.expanded, state.width);
  const viewport = detailViewportFor(state.height);
  const slice = lines.slice(state.detail.offset, state.detail.offset + viewport);

  if (state.detail.loading || lines.length === 0) {
    out.push(fit(color.dim(state.detail.loading ? ' Loading…' : ' This skill has no sections.'), state.width));
  } else {
    for (let i = 0; i < viewport; i++) {
      const line = slice[i];
      if (!line) {
        out.push(fit('', state.width));
        continue;
      }
      const selected = line.isTitle && line.sectionIndex === state.detail.cursor;
      const text = fit(line.text, state.width);
      out.push(selected ? color.cyan(text) : text);
    }
  }

  out.push(footer(state));
  return out;
}

function renderHelp(state: AppState): string[] {
  const out: string[] = [];
  out.push(header(state, 'help', 'Esc or ? to close'));

  const rows: [string, string][] = [
    ['↑ / ↓', 'Move the cursor one row'],
    ['j / k', 'Move the cursor one row'],
    ['PgUp / PgDn', 'Move a page at a time'],
    ['Home / End', 'Jump to the first or last row'],
    ['Enter', 'Open the skill, or toggle the section'],
    ['Click', 'Click a row to select it, click a section title to open it'],
    ['Wheel', 'Scroll the list and the document'],
    ['/', 'Search the marketplace'],
    ['Esc', 'Close the search, go back, close the help'],
    ['?', 'Show this help'],
    ['q', 'Quit'],
  ];
  out.push(fit('', state.width));
  for (const [key, description] of rows) {
    const left = `  ${color.cyan(fit(key, 14))}`;
    out.push(fit(`${left}${description}`, state.width));
  }

  const viewport = state.height - 2;
  while (out.length < viewport + 1) out.push(fit('', state.width));
  out.push(footer(state));
  return out;
}

export { hitTestList };
