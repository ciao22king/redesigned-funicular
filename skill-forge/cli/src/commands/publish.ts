import { readFileSync } from 'node:fs';
import { requireClient } from './helpers.js';
import { stripFences, readFrontmatterName, readFrontmatterDescription } from '../skill.js';
import { info, error, success, color } from '../output.js';
import type { Command } from './types.js';

/**
 * `publish` — uploads a skill to the marketplace.
 *
 * The file can come from -f, from stdin, or from the pipe of `generate`. Name,
 * description and tags are read from the frontmatter if not passed by hand.
 */

interface Flags {
  file?: string;
  tags?: string;
  name?: string;
  description?: string;
}

function parsePublishArgs(args: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    switch (a) {
      case '-f':
      case '--file':
        flags.file = next();
        break;
      case '-t':
      case '--tags':
        flags.tags = next();
        break;
      case '--name':
        flags.name = next();
        break;
      case '--description':
        flags.description = next();
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
        if (!flags.file) flags.file = a;
    }
  }
  return flags;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export const publishCommand: Command = {
  name: 'publish',
  usage: 'publish [-f <file>] [--tags a,b] [--name ...] [--description ...]',
  summary: 'Publish a skill to the marketplace',
  needsAuth: true,
  async run(args, ctx) {
    const flags = parsePublishArgs(args);

    let markdown: string;
    if (flags.file) {
      markdown = readFileSync(flags.file, 'utf8');
    } else if (!process.stdin.isTTY) {
      markdown = await readStdin();
    } else {
      error('A skill is required: pass -f <file> or send it on stdin.');
      return 1;
    }

    markdown = stripFences(markdown);
    if (!markdown.trim()) {
      error('The skill is empty.');
      return 1;
    }

    const name = flags.name ?? readFrontmatterName(markdown);
    const description = flags.description ?? readFrontmatterDescription(markdown);
    const tags = flags.tags
      ? flags.tags.split(/[,\s]+/).filter(Boolean)
      : undefined;

    const client = requireClient(ctx);
    try {
      const skill = await client.publish({ markdown, name, description, tags });
      if (ctx.json) {
        info(JSON.stringify(skill, null, 2));
        return 0;
      }
      success(`Published: ${color.bold(skill.name)}`);
      info(`  id:  ${color.cyan(skill.id)}`);
      info(`  url: ${client.baseUrl}/marketplace`);
      return 0;
    } catch (err) {
      error(err instanceof Error ? err.message : 'publishing failed');
      return 1;
    }
  },
};
