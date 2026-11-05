/** Estrae uno slug kebab-case valido da un titolo qualsiasi. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'skill-senza-nome';
}

/** Rimuove un eventuale blocco di code fence che alcuni modelli aggiungono. */
export function stripFences(md: string): string {
  const trimmed = md.trim();
  const fence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/;
  const match = trimmed.match(fence);
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

/** Estrae il campo `name:` dal frontmatter, se presente. */
export function readFrontmatterName(md: string): string | undefined {
  return readFrontmatterField(md, 'name');
}

/** Estrae il campo `description:` dal frontmatter, se presente. */
export function readFrontmatterDescription(md: string): string | undefined {
  return readFrontmatterField(md, 'description');
}

export function countWords(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}
