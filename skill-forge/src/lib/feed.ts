import type { SkillSummary } from './marketplace';

/**
 * RSS feed building, kept pure and separate from the route so the escaping can
 * be tested: the titles and descriptions come from skills anyone can publish,
 * and a stray `&` or `<` would otherwise produce invalid XML (or worse).
 */

/** Escapes text for an XML text node or attribute value. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface FeedMeta {
  base: string;
  title: string;
  description: string;
}

/** One `<item>` per skill, linking to its public page. */
function item(s: SkillSummary, base: string): string {
  const url = `${base}/s/${s.id}`;
  const pub = new Date(s.createdAt).toUTCString();
  const categories = s.tags
    .map((t) => `      <category>${escapeXml(t)}</category>`)
    .join('\n');
  const lines = [
    '    <item>',
    `      <title>${escapeXml(s.name)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `      <pubDate>${pub}</pubDate>`,
    `      <author>${escapeXml(s.owner)}</author>`,
    `      <description>${escapeXml(s.description || `A skill published by @${s.owner}.`)}</description>`,
    categories,
    '    </item>',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Builds the full RSS 2.0 document. */
export function buildFeed(skills: SkillSummary[], meta: FeedMeta): string {
  const items = skills.map((s) => item(s, meta.base)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.base)}</link>
    <description>${escapeXml(meta.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(`${meta.base}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
