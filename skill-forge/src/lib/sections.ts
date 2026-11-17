/**
 * Section-level editing of a skill.
 *
 * A generated skill is a fixed list of `##` sections. Keeping the parsing here
 * means the "regenerate this section" feature can replace exactly one block
 * without touching the frontmatter or the other sections.
 */

export interface SkillSection {
  /** Heading text, without the `##`. */
  title: string;
  /** Body, without the heading line. */
  body: string;
}

export interface ParsedSkill {
  /** Everything before the first `##`: frontmatter and the `#` title. */
  head: string;
  sections: SkillSection[];
}

/** Splits a skill into its head and its `##` sections. */
export function parseSkill(md: string): ParsedSkill {
  const lines = md.split('\n');
  const head: string[] = [];
  const sections: SkillSection[] = [];
  let current: SkillSection | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), body: '' };
      continue;
    }
    if (current) current.body += `${line}\n`;
    else head.push(line);
  }
  if (current) sections.push(current);

  return {
    head: head.join('\n').replace(/\n+$/, ''),
    sections: sections.map((s) => ({ ...s, body: s.body.replace(/\n+$/, '') })),
  };
}

/** Rebuilds the markdown from a parsed skill. */
export function serializeSkill(parsed: ParsedSkill): string {
  const blocks = parsed.sections.map((s) => `## ${s.title}\n\n${s.body.trim()}`);
  return `${parsed.head.trim()}\n\n${blocks.join('\n\n')}\n`;
}

/**
 * Replaces one section by title, case-insensitively.
 * Returns the markdown unchanged when the title is not found, so a stale UI
 * cannot corrupt the document.
 */
export function replaceSection(md: string, title: string, newBody: string): string {
  const parsed = parseSkill(md);
  const wanted = title.trim().toLowerCase();
  const index = parsed.sections.findIndex((s) => s.title.toLowerCase() === wanted);
  if (index === -1) return md;
  parsed.sections[index] = { title: parsed.sections[index].title, body: newBody };
  return serializeSkill(parsed);
}

/** The sections a user can regenerate on their own. */
export function regenerableSections(md: string): string[] {
  return parseSkill(md).sections.map((s) => s.title);
}
