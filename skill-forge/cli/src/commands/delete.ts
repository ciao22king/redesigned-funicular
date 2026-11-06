import { requireClient } from './helpers.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/**
 * `delete` — rimuove una skill dal marketplace.
 * L'endpoint accetta solo lo slug: il proprietario viene dal token, quindi si
 * possono cancellare soltanto le proprie skill. Accettiamo comunque `owner/slug`
 * e teniamo lo slug.
 */
export const deleteCommand: Command = {
  name: 'delete',
  usage: 'delete <owner/slug> [--yes]',
  summary: 'Cancella una tua skill dal marketplace',
  needsAuth: true,
  async run(args, ctx) {
    const id = args.find((a) => !a.startsWith('-'));
    if (!id) {
      error('Serve l\'id della skill, nella forma owner/slug.');
      return 1;
    }
    const slug = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;

    // Conferma esplicita: la cancellazione non si annulla.
    if (!args.includes('--yes') && process.stdin.isTTY) {
      const { createInterface } = await import('node:readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) =>
        rl.question(`Cancellare definitivamente ${color.bold(id)}? [s/N] `, resolve),
      );
      rl.close();
      if (!/^(s|si|y|yes)$/i.test(answer.trim())) {
        info('Annullato.');
        return 0;
      }
    }

    const client = requireClient(ctx);
    try {
      await client.remove(slug);
      success(`Cancellata: ${color.bold(id)}`);
      return 0;
    } catch (err) {
      error(err instanceof Error ? err.message : 'cancellazione fallita');
      return 1;
    }
  },
};
