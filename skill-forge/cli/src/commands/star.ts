import { requireClient } from './helpers.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/** `star` / `unstar` — the star is a toggle: the same call flips it. */
async function toggle(id: string | undefined, ctx: Parameters<Command['run']>[1]) {
  if (!id) {
    error('Skill id required, in the form owner/slug.');
    return 1;
  }
  const client = requireClient(ctx);
  try {
    const result = await client.star(id);
    if (ctx.json) {
      info(JSON.stringify({ id, ...result }, null, 2));
      return 0;
    }
    const verb = result.starred ? 'Starred' : 'Unstarred';
    success(`${verb} ${color.bold(id)} (now ${result.stars}).`);
    return 0;
  } catch (err) {
    error(err instanceof Error ? err.message : 'operation failed');
    return 1;
  }
}

export const starCommand: Command = {
  name: 'star',
  usage: 'star <owner/slug>',
  summary: 'Star or unstar a skill',
  needsAuth: true,
  async run(args, ctx) {
    return toggle(args.find((a) => !a.startsWith('-')), ctx);
  },
};
