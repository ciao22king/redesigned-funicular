/**
 * Helper sulle skill, allineati a `src/lib/skill.ts` lato server.
 * Duplicati qui perche' la CLI e' un pacchetto a se', senza dipendenze dal web.
 */

/** Estrae uno slug kebab-case valido da un titolo qualsiasi. */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'skill-senza-nome'
  );
}

/** Rimuove un eventuale blocco di code fence attorno al markdown. */
export function stripFences(md: string): string {
  const trimmed = md.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
}

/** Legge un campo scalare dal frontmatter YAML, se presente. */
export function readFrontmatterField(md: string, field: string): string | undefined {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const prefix = `${field}:`;
  const line = match[1].split('\n').find((l) => l.trim().startsWith(prefix));
  return line
    ?.slice(line.indexOf(prefix) + prefix.length)
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function readFrontmatterName(md: string): string | undefined {
  return readFrontmatterField(md, 'name');
}

export function readFrontmatterDescription(md: string): string | undefined {
  return readFrontmatterField(md, 'description');
}

export function countWords(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}
