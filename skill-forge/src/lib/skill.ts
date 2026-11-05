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

/** Estrae il campo `name:` dal frontmatter, se presente. */
export function readFrontmatterName(md: string): string | undefined {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const nameLine = match[1].split('\n').find((l) => l.trim().startsWith('name:'));
  return nameLine?.split(':').slice(1).join(':').trim().replace(/^["']|["']$/g, '');
}

export function countWords(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}
