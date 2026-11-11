/**
 * Splits a skill's markdown into its navigable parts.
 *
 * The interactive view lets the user open and close one section at a time, so
 * the document has to be cut at its `##` headings. The frontmatter and the `#`
 * title stay in `head`, and are shown separately.
 */

export interface Section {
  title: string;
  body: string;
  /** Level of the heading: 2 for `##`, 3 for `###`. */
  level: number;
}

export interface ParsedDocument {
  head: string;
  sections: Section[];
}

/**
 * Parses the document. Only `##` and `###` headings open a section: a deeper
 * heading stays inside the section that contains it, as a normal line.
 */
export function parseDocument(markdown: string): ParsedDocument {
  const lines = markdown.split('\n');
  const head: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[2].trim(), body: '', level: heading[1].length };
      continue;
    }
    if (current) current.body += `${line}\n`;
    else head.push(line);
  }
  if (current) sections.push(current);

  return {
    head: head.join('\n').replace(/\n+$/, ''),
    sections: sections.map((s) => ({ ...s, body: s.body.replace(/^\n+|\n+$/g, '') })),
  };
}
