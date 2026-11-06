import { writeFileSync } from 'node:fs';
import { requireClient } from './helpers.js';
import { slugify } from '../skill.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/**
 * `pull` — scarica una skill del marketplace e la salva come file .md.
 * Senza -o il nome del file si ricava dall'id: `owner/slug` -> `slug.md`.
 */
export const pullCommand: Command = {
  name: 'pull',
  usage: 'pull <owner/slug> [-o <file>]',
  summary: 'Scarica una skill del marketplace',
  async run(args, ctx) {
    const id = args.find((a) => !a.startsWith('-'));
    if (!id) {
      error('Serve l\'id della skill, nella forma owner/slug.');
      return 1;
    }
    const oIdx = args.findIndex((a) => a === '-o' || a === '--out');
    const out = oIdx !== -1 ? args[oIdx + 1] : undefined;

    const client = requireClient(ctx);
    let skill;
    try {
      skill = await client.detail(id);
    } catch (err) {
      error(err instanceof Error ? err.message : 'richiesta fallita');
      return 1;
    }

    const markdown = skill.markdown.trimEnd() + '\n';
    if (out) {
      writeFileSync(out, markdown, 'utf8');
      success(`Scaricata: ${color.bold(skill.name)} -> ${out}`);
      return 0;
    }

    if (!process.stdout.isTTY) {
      // In pipe scriviamo solo il markdown, per unire i comandi.
      process.stdout.write(markdown);
      return 0;
    }

    const slug = id.includes('/') ? id.slice(id.indexOf('/') + 1) : slugify(skill.name);
    const file = `${slug}.md`;
    writeFileSync(file, markdown, 'utf8');
    success(`Scaricata: ${color.bold(skill.name)} -> ${file}`);
    info(color.dim('Suggerimento: usa -o <file> per scegliere il nome.'));
    return 0;
  },
};
