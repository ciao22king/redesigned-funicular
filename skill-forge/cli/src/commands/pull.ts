import { writeFileSync } from 'node:fs';
import { requireClient } from './helpers.js';
import { slugify } from '../skill.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/**
 * `pull` — downloads a marketplace skill and saves it as a .md file.
 * Without -o the file name is derived from the id: `owner/slug` -> `slug.md`.
 */
export const pullCommand: Command = {
  name: 'pull',
  usage: 'pull <owner/slug> [-o <file>]',
  summary: 'Download a skill from the marketplace',
  async run(args, ctx) {
    const id = args.find((a) => !a.startsWith('-'));
    if (!id) {
      error('Skill id required, in the form owner/slug.');
      return 1;
    }
    const oIdx = args.findIndex((a) => a === '-o' || a === '--out');
    const out = oIdx !== -1 ? args[oIdx + 1] : undefined;

    const client = requireClient(ctx);
    let skill;
    try {
      skill = await client.detail(id);
    } catch (err) {
      error(err instanceof Error ? err.message : 'request failed');
      return 1;
    }

    const markdown = skill.markdown.trimEnd() + '\n';
    if (out) {
      writeFileSync(out, markdown, 'utf8');
      success(`Downloaded: ${color.bold(skill.name)} -> ${out}`);
      return 0;
    }

    if (!process.stdout.isTTY) {
      // In a pipe we write only the markdown, to chain commands.
      process.stdout.write(markdown);
      return 0;
    }

    const slug = id.includes('/') ? id.slice(id.indexOf('/') + 1) : slugify(skill.name);
    const file = `${slug}.md`;
    writeFileSync(file, markdown, 'utf8');
    success(`Downloaded: ${color.bold(skill.name)} -> ${file}`);
    info(color.dim('Tip: use -o <file> to choose the name.'));
    return 0;
  },
};
