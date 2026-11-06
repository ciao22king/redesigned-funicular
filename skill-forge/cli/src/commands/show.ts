import { requireClient } from './helpers.js';
import { info, error, color } from '../output.js';
import type { Command } from './types.js';

/** `show` — dettaglio di una skill: metadati e markdown completo. */
export const showCommand: Command = {
  name: 'show',
  usage: 'show <owner/slug> [--no-body]',
  summary: 'Mostra il dettaglio di una skill',
  async run(args, ctx) {
    const id = args.find((a) => !a.startsWith('-'));
    if (!id) {
      error('Serve l\'id della skill, nella forma owner/slug.');
      return 1;
    }
    const noBody = args.includes('--no-body');
    const client = requireClient(ctx);

    let skill;
    try {
      skill = await client.detail(id);
    } catch (err) {
      error(err instanceof Error ? err.message : 'richiesta fallita');
      return 1;
    }

    if (ctx.json) {
      info(JSON.stringify(skill, null, 2));
      return 0;
    }

    info(`${color.bold(skill.name)}`);
    info(color.dim(`  ${skill.id}`));
    if (skill.description) info(`\n${skill.description}`);
    info('');
    info(`  ★ ${skill.stars}${skill.starred ? color.dim(' (tua stella)') : ''}`);
    if (skill.tags.length) info(`  tag: ${skill.tags.join(', ')}`);
    info(`  aggiornata: ${skill.updatedAt}`);
    if (!noBody) {
      info(`\n${color.dim('---')}\n`);
      info(skill.markdown.trimEnd());
    }
    return 0;
  },
};
