/**
 * Minimal, dependency-free Markdown parser for the public skill pages.
 *
 * It returns a typed block model instead of an HTML string on purpose: the
 * React layer renders text nodes, so a malicious skill (published by anyone)
 * cannot inject markup. A raw HTML renderer would need sanitising; this one
 * cannot produce HTML at all.
 *
 * It covers what the generated skills actually contain: frontmatter, headings,
 * paragraphs, ordered/unordered lists and fenced code. Inline emphasis is kept
 * as plain text (the `**` markers are stripped) to keep the renderer honest.
 */

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string };

/** Removes the YAML frontmatter block, if present. */
export function stripFrontmatter(md: string): string {
  return md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

/** Strips inline emphasis markers, keeping the words. */
export function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function parseMarkdown(md: string): Block[] {
  const lines = stripFrontmatter(md).split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: stripInline(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
      list = null;
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (code) {
      if (line.trim().startsWith('```')) {
        blocks.push({ type: 'code', text: code.join('\n') });
        code = null;
      } else {
        code.push(raw);
      }
      continue;
    }

    if (line.trim().startsWith('```')) {
      flushAll();
      code = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: stripInline(heading[2]),
      });
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const text = stripInline((bullet ?? ordered)![1]);
      if (list && list.ordered === isOrdered) {
        list.items.push(text);
      } else {
        flushList();
        list = { ordered: isOrdered, items: [text] };
      }
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (code) blocks.push({ type: 'code', text: code.join('\n') });
  flushAll();

  return blocks;
}
