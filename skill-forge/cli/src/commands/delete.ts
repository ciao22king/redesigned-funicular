import { requireClient } from './helpers.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/**
 * `delete` — removes a skill from the marketplace.
 * The endpoint accepts only the slug: the owner comes from the token, so you can
 * delete only your own skills. We still accept `owner/slug` and keep the slug.
 */
export const deleteCommand: Command = {
  name: 'delete',
  usage: 'delete <owner/slug> [--yes]',
  summary: 'Delete one of your skills from the marketplace',
  needsAuth: true,
  async run(args, ctx) {
    const id = args.find((a) => !a.startsWith('-'));
    if (!id) {
      error('Skill id required, in the form owner/slug.');
      return 1;
    }
    const slug = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;

    // Explicit confirmation: deletion cannot be undone.
    if (!args.includes('--yes') && process.stdin.isTTY) {
      const { createInterface } = await import('node:readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) =>
        rl.question(`Permanently delete ${color.bold(id)}? [y/N] `, resolve),
      );
      rl.close();
      if (!/^(y|yes)$/i.test(answer.trim())) {
        info('Cancelled.');
        return 0;
      }
    }

    const client = requireClient(ctx);
    try {
      await client.remove(slug);
      success(`Deleted: ${color.bold(id)}`);
      return 0;
    } catch (err) {
      error(err instanceof Error ? err.message : 'deletion failed');
      return 1;
    }
  },
};
