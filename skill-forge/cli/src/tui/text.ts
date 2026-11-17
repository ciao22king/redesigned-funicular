/**
 * Text measurement and layout helpers for the interactive view.
 *
 * Everything is measured on the *visible* length, with the ANSI escapes
 * removed: a styled string must occupy the same number of columns as its plain
 * text, otherwise the boxes drift and the frame tears.
 */

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

/** Keeps at most `width` visible columns, walking around the escapes. */
export function truncateVisible(text: string, width: number): string {
  if (width <= 0) return '';
  let out = '';
  let visible = 0;
  let i = 0;
  while (i < text.length && visible < width) {
    if (text[i] === '\u001b') {
      const match = text.slice(i).match(/^\u001b\[[0-9;]*m/);
      if (match) {
        out += match[0];
        i += match[0].length;
        continue;
      }
    }
    out += text[i];
    visible += 1;
    i += 1;
  }
  return out;
}

/** Pads or truncates to exactly `width` visible columns. */
export function fit(text: string, width: number): string {
  if (width <= 0) return '';
  const visible = visibleLength(text);
  if (visible === width) return text;
  if (visible < width) return text + ' '.repeat(width - visible);
  const cut = `${truncateVisible(text, width - 1)}…`;
  const missing = width - visibleLength(cut);
  return missing > 0 ? cut + ' '.repeat(missing) : cut;
}

/**
 * Greedy word wrap, keeping the leading indentation of the line.
 * A word wider than the line is broken rather than allowed to overflow the box.
 */
export function wrap(text: string, width: number): string[] {
  if (width <= 0) return [text];
  if (text.trim() === '') return [''];
  const indent = text.match(/^\s*/)?.[0] ?? '';
  const avail = Math.max(1, width - visibleLength(indent));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const flush = () => {
    if (current) {
      lines.push(indent + current);
      current = '';
    }
  };

  for (const rawWord of words) {
    let word = rawWord;
    while (visibleLength(word) > avail) {
      flush();
      lines.push(indent + word.slice(0, avail));
      word = word.slice(avail);
    }
    if (!current) current = word;
    else if (visibleLength(current) + 1 + visibleLength(word) <= avail) current += ` ${word}`;
    else {
      flush();
      current = word;
    }
  }
  flush();
  return lines.length ? lines : [''];
}
