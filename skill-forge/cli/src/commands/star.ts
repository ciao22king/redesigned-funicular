import { requireClient } from './helpers.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/** `star` / `unstar` — la stella e' un interruttore: la stessa chiamata la alterna. */
async function toggle(id: string | undefined, ctx: Parameters<Command['run']>[1]) {
  if (!id) {
    error('Serve l\'id della skill, nella forma owner/slug.');
    return 1;
  }
  const client = requireClient(ctx);
  try {
    const result = await client.star(id);
    if (ctx.json) {
      info(JSON.stringify({ id, ...result }, null, 2));
      return 0;
    }
    const verb = result.starred ? 'Aggiunta la stella a' : 'Tolta la stella a';
    success(`${verb} ${color.bold(id)} (ora ${result.stars}).`);
    return 0;
  } catch (err) {
    error(err instanceof Error ? err.message : 'operazione fallita');
    return 1;
  }
}

export const starCommand: Command = {
  name: 'star',
  usage: 'star <owner/slug>',
  summary: 'Mette o toglie la stella a una skill',
  needsAuth: true,
  async run(args, ctx) {
    return toggle(args.find((a) => !a.startsWith('-')), ctx);
  },
};
