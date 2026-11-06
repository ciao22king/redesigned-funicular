/**
 * Formattazione dell'output.
 *
 * I colori si disattivano da soli quando l'output non e' un terminale (pipe,
 * file, CI) o quando NO_COLOR e' impostata: cosi' l'output resta leggibile
 * quando viene salvato o passato a un altro comando.
 */

const useColor =
  !process.env.NO_COLOR && process.stdout.isTTY === true && process.env.TERM !== 'dumb';

function wrap(code: number, text: string): string {
  return useColor ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const color = {
  bold: (t: string) => wrap(1, t),
  dim: (t: string) => wrap(2, t),
  red: (t: string) => wrap(31, t),
  green: (t: string) => wrap(32, t),
  yellow: (t: string) => wrap(33, t),
  blue: (t: string) => wrap(34, t),
  magenta: (t: string) => wrap(35, t),
  cyan: (t: string) => wrap(36, t),
};

export function info(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function success(message: string): void {
  process.stdout.write(`${color.green('✔')} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${color.yellow('!')} ${message}\n`);
}

/** Errore su stderr. Non esce: decide il chiamante. */
export function error(message: string): void {
  process.stderr.write(`${color.red('✖')} ${message}\n`);
}

/** Tabella semplice a colonne, con intestazione. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(visibleLength(h), ...rows.map((r) => visibleLength(r[i] ?? ''))),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i])).join('  ').replace(/\s+$/, '');

  const out = [color.bold(line(headers))];
  out.push(color.dim(widths.map((w) => '-'.repeat(w)).join('  ')));
  for (const row of rows) out.push(line(row));
  return out.join('\n');
}

/** Lunghezza senza codici ANSI, per allineare le colonne. */
function visibleLength(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '').length;
}

function pad(text: string, width: number): string {
  const missing = width - visibleLength(text);
  return missing > 0 ? text + ' '.repeat(missing) : text;
}

/** Tronca una stringa lunga, con ellissi. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1))}…`;
}

/** Formatta una data ISO in una forma breve. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}
