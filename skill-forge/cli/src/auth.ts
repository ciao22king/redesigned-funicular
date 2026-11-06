import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * Recupero del token GitHub.
 *
 * Il Device Flow di GitHub sarebbe la scelta naturale per una CLI, ma va
 * abilitato esplicitamente sulla OAuth App e su questa e' disattivato. Quindi
 * prendiamo il token da una fonte che l'utente ha gia':
 *
 *   1. `--token` (o la variabile SKILL_FORGE_TOKEN)
 *   2. `gh auth token`, se la GitHub CLI e' installata e autenticata
 *   3. input interattivo (incolla un personal access token)
 *
 * In tutti i casi il token viene poi verificato contro l'API di GitHub dal
 * server: qui ci limitiamo a procurarcelo.
 */

/** Chiede a `gh` il token, se disponibile. Restituisce undefined se `gh` manca. */
export function tokenFromGh(): string | undefined {
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/** Chiede il token all'utente, senza mostrarlo sullo schermo. */
export function promptToken(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Nasconde i caratteri digitati: il token e' una credenziale.
    const onData = (char: Buffer) => {
      const s = char.toString();
      if (s === '\n' || s === '\r' || s === '\u0004') return;
      process.stdout.clearLine?.(0);
      process.stdout.cursorTo?.(0);
      process.stdout.write('Token GitHub: ****');
    };
    process.stdin.on('data', onData);
    rl.question('Token GitHub: ', (answer) => {
      process.stdin.off('data', onData);
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Sceglie il token da usare, in ordine di priorita'.
 * `explicit` arriva da --token; `fromEnv` da SKILL_FORGE_TOKEN.
 */
export async function resolveToken(explicit?: string): Promise<string | undefined> {
  if (explicit?.trim()) return explicit.trim();
  const fromEnv = process.env.SKILL_FORGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const fromGh = tokenFromGh();
  if (fromGh) return fromGh;

  if (!process.stdin.isTTY) return undefined;
  const typed = await promptToken();
  return typed || undefined;
}
