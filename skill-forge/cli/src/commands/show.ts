import { requireClient } from './helpers.js';
import { info, error, color } from '../output.js';
import type { Command } from './types.js';

/** `show` — detail of a skill: metadata and full markdown. */
export const showCommand: Command = {
  name: 'show',
  usage: 'show <owner/slug> [--no-body]',
  summary: 'Show the detail of a skill',
  async run(args, ctx) {
    const id = args.find((a) => !a.startsWith('-'));
    if (!id) {
      error('Skill id required, in the form owner/slug.');
      return 1;
    }
    const noBody = args.includes('--no-body');
    const client = requireClient(ctx);

    let skill;
    try {
      skill = await client.detail(id);
    } catch (err) {
      error(err instanceof Error ? err.message : 'request failed');
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
    info(`  ★ ${skill.stars}${skill.starred ? color.dim(' (your star)') : ''}`);
    if (skill.tags.length) info(`  tag: ${skill.tags.join(', ')}`);
    info(`  updated: ${skill.updatedAt}`);
    if (!noBody) {
      info(`\n${color.dim('---')}\n`);
      info(skill.markdown.trimEnd());
    }
    return 0;
  },
};
