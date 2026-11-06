import { requireClient } from './helpers.js';
import { info, error, color, table, truncate, shortDate } from '../output.js';
import type { Command } from './types.js';

/**
 * `list` (alias `search`) — sfoglia e cerca nel marketplace.
 * Non richiede autenticazione: la vetrina e' pubblica.
 */

interface Flags {
  query?: string;
  sort?: string;
  owner?: string;
  page: number;
  limit?: number;
}

function parseListArgs(args: string[]): Flags {
  const flags: Flags = { page: 1 };
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    switch (a) {
      case '-q':
      case '--query':
        flags.query = next();
        break;
      case '-s':
      case '--sort':
        flags.sort = next();
        break;
      case '-o':
      case '--owner':
        flags.owner = next();
        break;
      case '-p':
      case '--page':
        flags.page = Math.max(1, Number(next()) || 1);
        break;
      case '-n':
      case '--limit':
        flags.limit = Math.max(1, Number(next()) || 24);
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Opzione sconosciuta: ${a}`);
        positional.push(a);
    }
  }
  // La query si puo' dare come argomento posizionale: `skill-forge list docker`.
  if (!flags.query && positional.length) flags.query = positional.join(' ');
  return flags;
}

export const listCommand: Command = {
  name: 'list',
  usage: 'list [-q <testo>] [-s recent|stars|name] [-o <owner>] [-p <pagina>]',
  summary: 'Cerca e sfoglia il marketplace',
  async run(args, ctx) {
    const flags = parseListArgs(args);
    const client = requireClient(ctx);

    let data;
    try {
      data = await client.list({
        q: flags.query,
        sort: flags.sort,
        owner: flags.owner,
        page: flags.page,
      });
    } catch (err) {
      error(err instanceof Error ? err.message : 'ricerca fallita');
      return 1;
    }

    if (ctx.json) {
      info(JSON.stringify(data, null, 2));
      return 0;
    }

    const skills = flags.limit ? data.skills.slice(0, flags.limit) : data.skills;
    if (skills.length === 0) {
      info(color.dim('Nessuna skill trovata.'));
      return 0;
    }

    const rows = skills.map((s) => [
      color.cyan(s.id),
      String(s.stars),
      truncate(s.description || s.name, 46),
      shortDate(s.updatedAt),
    ]);
    info(table(['ID', '★', 'DESCRIZIONE', 'AGGIORNATA'], rows));

    if (data.pages > 1) {
      info(color.dim(`\nPagina ${data.page}/${data.pages} — ${data.total} skill in totale.`));
    }
    return 0;
  },
};

export const searchCommand: Command = {
  ...listCommand,
  name: 'search',
  usage: 'search <testo> [-s recent|stars|name] [-o <owner>]',
  summary: 'Alias di `list`',
};
