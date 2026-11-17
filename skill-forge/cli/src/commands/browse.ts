import { requireClient } from './helpers.js';
import { browse } from '../tui/app.js';
import type { Command } from './types.js';

/**
 * `browse` (alias `ui`) — the interactive marketplace, navigated with the
 * keyboard or the mouse. It needs a real terminal: in a pipe it falls back to a
 * message pointing at `list`.
 */
export const browseCommand: Command = {
  name: 'browse',
  usage: 'browse [-q <text>]',
  summary: 'Browse the marketplace interactively (mouse and keyboard)',
  async run(args, ctx) {
    let query: string | undefined;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-q' || args[i] === '--query') query = args[++i];
      else if (!args[i].startsWith('-')) query = args[i];
    }
    const client = requireClient(ctx);
    return browse({ client, query });
  },
};

export const uiCommand: Command = {
  ...browseCommand,
  name: 'ui',
  usage: 'ui [-q <text>]',
  summary: 'Alias of `browse`',
};
