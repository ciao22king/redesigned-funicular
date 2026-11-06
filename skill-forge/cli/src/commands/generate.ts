import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { requireClient } from './helpers.js';
import { slugify, stripFences, readFrontmatterName } from '../skill.js';
import { info, error, success, color, warn } from '../output.js';
import type { Command } from './types.js';

/**
 * `generate` — produce una skill, in due modalita':
 *
 *   - da materiale: uno o piu' file, oppure testo da stdin
 *   - da zero: i sei campi del wizard
 *
 * Il risultato va su stdout (per le pipe) o su file con -o. Su stdout non
 * stampiamo nulla che non sia il markdown, cosi' `skill-forge generate ... > s.md`
 * produce un file pulito.
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
        if (a.startsWith('-')) throw new Error(`Opzione sconosciuta: ${a}`);
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
  summary: 'Genera una skill da materiale o da zero',
  needsAuth: true,
  async run(args, ctx) {
    const flags = parseGenerateArgs(args);

    const fromScratch = Boolean(flags.name || flags.domain || flags.goal);
    let body: Record<string, unknown>;

    if (fromScratch) {
      if (!flags.name || !flags.domain || !flags.goal) {
        error('Servono --name, --domain e --goal per la modalita da zero.');
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
        error('Nessun materiale. Passa dei file con -f, oppure del testo da stdin.');
        return 1;
      }
      body = { mode: 'from-skills', sourceMaterial };
    }

    const client = requireClient(ctx);
    let data;
    try {
      data = await client.generate(body);
    } catch (err) {
      error(err instanceof Error ? err.message : 'generazione fallita');
      return 1;
    }

    const markdown = stripFences(data.markdown ?? '');
    if (!markdown) {
      error('Il server non ha restituito alcuna skill.');
      return 1;
    }

    if (flags.out) {
      writeFileSync(flags.out, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
      if (!flags.quiet) {
        const name = readFrontmatterName(markdown) ?? basename(flags.out, extname(flags.out));
        success(`Skill generata: ${color.bold(name)} -> ${flags.out}`);
        if (data.model) info(color.dim(`Modello: ${data.model}`));
        if (data.quota && !data.quota.unlimited) {
          info(color.dim(`Generazioni rimaste oggi: ${data.quota.remaining}`));
        }
      }
      return 0;
    }

    // Senza -o il markdown va su stdout, pulito: e' l'uso in pipe.
    process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
    if (!flags.quiet) {
      if (data.quota && !data.quota.unlimited) {
        warn(`Generazioni rimaste oggi: ${data.quota.remaining}`);
      }
    }
    return 0;
  },
};

/** Esportato per i test: la derivazione del nome non tocca la rete. */
export function suggestedSlug(name: string | undefined): string {
  return slugify(name ?? 'skill');
}
