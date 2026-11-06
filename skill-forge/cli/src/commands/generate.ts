import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { requireClient } from './helpers.js';
import { slugify, stripFences, readFrontmatterName } from '../skill.js';
import { info, error, success, color, warn } from '../output.js';
import type { Command } from './types.js';

/**
 * `generate` — produces a skill, in two modes:
 *
 *   - from material: one or more files, or text on stdin
 *   - from scratch: the six wizard fields
 *
 * The result goes to stdout (for pipes) or to a file with -o. On stdout we print
 * nothing but the markdown, so `skill-forge generate ... > s.md` produces a clean
 * file.
 */

interface Flags {
  files: string[];
  name?: string;
  domain?: string;
  goal?: string;
  tone?: string;
  constraints?: string;
  examples?: string;
  out?: string;
  quiet: boolean;
}

function parseGenerateArgs(args: string[]): Flags {
  const flags: Flags = { files: [], quiet: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    switch (a) {
      case '-f':
      case '--file':
        flags.files.push(next());
        break;
      case '--name':
        flags.name = next();
        break;
      case '--domain':
        flags.domain = next();
        break;
      case '--goal':
        flags.goal = next();
        break;
      case '--tone':
        flags.tone = next();
        break;
      case '--constraints':
        flags.constraints = next();
        break;
      case '--examples':
        flags.examples = next();
        break;
      case '-o':
      case '--out':
        flags.out = next();
        break;
      case '-q':
      case '--quiet':
        flags.quiet = true;
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
        flags.files.push(a);
    }
  }
  return flags;
}

/** Legge da stdin fino a EOF. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export const generateCommand: Command = {
  name: 'generate',
  usage: 'generate [-f <file>...] [-o <file>] | --name ... --domain ... --goal ...',
  summary: 'Generate a skill from material or from scratch',
  needsAuth: true,
  async run(args, ctx) {
    const flags = parseGenerateArgs(args);

    const fromScratch = Boolean(flags.name || flags.domain || flags.goal);
    let body: Record<string, unknown>;

    if (fromScratch) {
      if (!flags.name || !flags.domain || !flags.goal) {
        error('--name, --domain and --goal are required for from-scratch mode.');
        return 1;
      }
      body = {
        mode: 'from-scratch',
        name: flags.name,
        domain: flags.domain,
        goal: flags.goal,
        tone: flags.tone,
        constraints: flags.constraints,
        examples: flags.examples,
      };
    } else {
      const parts: string[] = [];
      for (const file of flags.files) {
        const text = readFileSync(file, 'utf8');
        parts.push(`## File: ${basename(file)}\n\n${text}`);
      }
      if (!process.stdin.isTTY && flags.files.length === 0) {
        const piped = (await readStdin()).trim();
        if (piped) parts.push(piped);
      }
      const sourceMaterial = parts.join('\n\n');
      if (!sourceMaterial.trim()) {
        error('No material. Pass files with -f, or text on stdin.');
        return 1;
      }
      body = { mode: 'from-skills', sourceMaterial };
    }

    const client = requireClient(ctx);
    let data;
    try {
      data = await client.generate(body);
    } catch (err) {
      error(err instanceof Error ? err.message : 'generation failed');
      return 1;
    }

    const markdown = stripFences(data.markdown ?? '');
    if (!markdown) {
      error('The server returned no skill.');
      return 1;
    }

    if (flags.out) {
      writeFileSync(flags.out, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
      if (!flags.quiet) {
        const name = readFrontmatterName(markdown) ?? basename(flags.out, extname(flags.out));
        success(`Skill generated: ${color.bold(name)} -> ${flags.out}`);
        if (data.model) info(color.dim(`Model: ${data.model}`));
        if (data.quota && !data.quota.unlimited) {
          info(color.dim(`Generations left today: ${data.quota.remaining}`));
        }
      }
      return 0;
    }

    // Without -o the markdown goes to stdout, clean: that is the pipe use.
    process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
    if (!flags.quiet) {
      if (data.quota && !data.quota.unlimited) {
        warn(`Generations left today: ${data.quota.remaining}`);
      }
    }
    return 0;
  },
};

/** Exported for the tests: the name derivation does not touch the network. */
export function suggestedSlug(name: string | undefined): string {
  return slugify(name ?? 'skill');
}
