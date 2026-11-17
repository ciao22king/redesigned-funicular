import { execFileSync } from 'node:child_process';
import { Client } from '../api.js';
import { loadConfig, saveConfig, clearConfig } from '../config.js';
import { deviceFlowLogin } from '../device-flow.js';
import { success, info, error, color } from '../output.js';
import { loadConfigFor } from './helpers.js';
import type { Command } from './types.js';

/**
 * `login` — gets a GitHub token and saves it.
 *
 * Normal path: Device Flow. The user sees a code, types it at
 * github.com/login/device, authorizes. Nothing to paste.
 *
 * If there is no interactive terminal (CI, pipe) the Device Flow makes no sense,
 * so `--token`, `$SKILL_FORGE_TOKEN` or `gh auth token` are accepted.
 */

/** Token from `gh auth token`, if the GitHub CLI is installed and authenticated. */
function tokenFromGh(): string | undefined {
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

/** Verifies the token against the service and returns the login. */
async function verify(url: string, token: string): Promise<string> {
  const client = new Client({ url, token });
  const me = await client.me();
  return me.login;
}

/** Verifies the token and, if valid, saves it. */
async function finish(url: string, token: string): Promise<number> {
  try {
    const login = await verify(url, token);
    saveConfig({ ...loadConfig(), url, token, login });
    success(`Authenticated as ${color.bold(login)}.`);
    info(color.dim('Config saved to ~/.config/skill-forge/config.json (mode 600).'));
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verification failed';
    error(`Sign-in failed: ${message}`);
    return 1;
  }
}

export const loginCommand: Command = {
  name: 'login',
  usage: 'login [--token <token>] [--no-device-flow]',
  summary: 'Authenticate with GitHub (Device Flow) and save the token',
  async run(args, ctx) {
    const i = args.indexOf('--token');
    const explicit = i !== -1 ? args[i + 1] : ctx.token;
    const config = loadConfigFor(ctx);

    // 1. Token esplicito (flag o variabile d'ambiente): niente interazione.
    const provided = explicit?.trim() || process.env.SKILL_FORGE_TOKEN?.trim();
    if (provided) return finish(config.url, provided);

    // 2. In a non-interactive context we try `gh`, then stop.
    const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true;
    if (!interactive) {
      const gh = tokenFromGh();
      if (gh) return finish(config.url, gh);
      error('No interactive terminal: pass a token with --token or $SKILL_FORGE_TOKEN.');
      return 1;
    }

    // 3. Device Flow, salvo richiesta esplicita di saltarlo.
    if (args.includes('--no-device-flow')) {
      const gh = tokenFromGh();
      if (gh) return finish(config.url, gh);
      error('Device Flow disabled and no token available.');
      return 1;
    }

    try {
      const token = await deviceFlowLogin({
        onPrompt: ({ userCode, verificationUri }) => {
          info('');
          info(`  1. Open ${color.cyan(verificationUri)}`);
          info(`  2. Enter the code: ${color.bold(userCode)}`);
          info('');
          info(color.dim('Waiting for authorization... (Ctrl+C to cancel)'));
        },
      });
      return finish(config.url, token);
    } catch (err) {
      error(err instanceof Error ? err.message : 'sign-in failed');
      return 1;
    }
  },
};

export const logoutCommand: Command = {
  name: 'logout',
  usage: 'logout',
  summary: 'Remove the saved token',
  async run() {
    clearConfig();
    success("Signed out. The token has been removed.");
    return 0;
  },
};
