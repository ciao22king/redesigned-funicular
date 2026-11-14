/**
 * Parses raw terminal input into actions.
 *
 * Kept separate from the shell so it can be tested by feeding byte sequences:
 * an arrow key is `\u001b[A`, a mouse click is an SGR report like
 * `\u001b[<0;12;5M`. No TTY is needed to test any of it.
 *
 * Reference: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html (SGR 1006).
 */

import type { Action } from './state.js';

export interface MouseEvent {
  /** 'press' for the button going down, 'release' for it coming up, 'move'. */
  kind: 'press' | 'release' | 'move';
  /** 0 left, 1 middle, 2 right, 64 wheel up, 65 wheel down. */
  button: number;
  /** 0-based column. */
  x: number;
  /** 0-based row. */
  y: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export type InputEvent =
  | { type: 'action'; action: Action }
  | { type: 'mouse'; event: MouseEvent }
  | { type: 'text'; text: string }
  | { type: 'paste'; text: string };

/**
 * Decodes one chunk of input into the events it contains.
 *
 * A chunk can hold several sequences (fast typing, or a mouse report arriving
 * with a key), so it is walked rather than matched as a whole.
 */
export function parseInput(chunk: string): InputEvent[] {
  const events: InputEvent[] = [];
  let i = 0;

  while (i < chunk.length) {
    const rest = chunk.slice(i);

    const mouse = matchSgrMouse(rest);
    if (mouse) {
      events.push({ type: 'mouse', event: mouse.event });
      i += mouse.length;
      continue;
    }

    const escape = matchEscape(rest);
    if (escape) {
      if (escape.action) events.push({ type: 'action', action: escape.action });
      i += escape.length;
      continue;
    }

    const char = rest[0];
    i += 1;

    if (char === '\u0003' || char === '\u0004') {
      events.push({ type: 'action', action: { type: 'quit' } });
      continue;
    }
    if (char === '\r' || char === '\n') {
      events.push({ type: 'action', action: { type: 'open' } });
      continue;
    }
    if (char === '\u007f' || char === '\b') {
      events.push({ type: 'text', text: '\b' });
      continue;
    }
    if (char === '\t') {
      events.push({ type: 'action', action: { type: 'move', delta: 1 } });
      continue;
    }
    if (char >= ' ') {
      // Printable text is collected into runs, so a paste is one event.
      let text = char;
      while (i < chunk.length && chunk[i] >= ' ' && !isEscapeStart(chunk, i)) {
        text += chunk[i];
        i += 1;
      }
      events.push({ type: 'text', text });
    }
    // Other control characters are ignored rather than misread.
  }

  return events;
}

function isEscapeStart(chunk: string, index: number): boolean {
  return chunk[index] === '\u001b';
}

interface EscapeMatch {
  length: number;
  action?: Action;
}

/** CSI and SS3 sequences, plus the bare Escape key. */
function matchEscape(input: string): EscapeMatch | null {
  if (input[0] !== '\u001b') return null;

  // A lone Escape is the key itself; `\u001b[` and `\u001bO` start a sequence.
  if (input.length === 1) return { length: 1, action: { type: 'back' } };
  if (input[1] !== '[' && input[1] !== 'O') return { length: 1, action: { type: 'back' } };

  const match = input.match(/^\u001b(?:\[|O)([0-9;]*)([A-Za-z~])/);
  if (!match) {
    // An incomplete sequence at the end of the chunk: treat it as Escape so the
    // input is never swallowed.
    return { length: 1, action: { type: 'back' } };
  }

  const [, params, final] = match;
  const length = match[0].length;
  const action = mapKey(params, final);
  return action ? { length, action } : { length };
}

function mapKey(params: string, final: string): Action | null {
  switch (final) {
    case 'A':
      return { type: 'move', delta: -1 };
    case 'B':
      return { type: 'move', delta: 1 };
    case 'C':
      return null;
    case 'D':
      return null;
    case 'H':
      return { type: 'top' };
    case 'F':
      return { type: 'bottom' };
    case '~': {
      const code = Number(params.split(';')[0]) || 0;
      if (code === 5) return { type: 'page', delta: -1 };
      if (code === 6) return { type: 'page', delta: 1 };
      if (code === 1 || code === 7) return { type: 'top' };
      if (code === 4 || code === 8) return { type: 'bottom' };
      return null;
    }
    default:
      return null;
  }
}

interface MouseMatch {
  length: number;
  event: MouseEvent;
}

/** SGR mouse report: `\u001b[<Cb;Cx;CyM` (press) or `…m` (release). */
function matchSgrMouse(input: string): MouseMatch | null {
  const match = input.match(/^\u001b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (!match) return null;

  const code = Number(match[1]);
  const x = Number(match[2]) - 1;
  const y = Number(match[3]) - 1;
  const release = match[4] === 'm';

  const shift = (code & 4) !== 0;
  const alt = (code & 8) !== 0;
  const ctrl = (code & 16) !== 0;
  const motion = (code & 32) !== 0;
  const button = code & 0b1100_0011;

  let kind: MouseEvent['kind'] = 'press';
  if (release) kind = 'release';
  else if (motion) kind = 'move';

  return {
    length: match[0].length,
    event: { kind, button, x, y, shift, alt, ctrl },
  };
}
