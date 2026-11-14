/**
 * Deterministic normalisation of a generated skill.
 *
 * The model writes the content; this layer guarantees the *shape*. It runs on
 * every draft before the result reaches the user, so the output is usable as it
 * arrives: canonical frontmatter, the required sections in the required order,
 * no em dashes, and a final checklist synthesised from the procedure when the
 * model forgot it.
 *
 * Everything here is pure and idempotent: normalising twice changes nothing the
 * second time. That property is what lets the caller run it after both the
 * draft and the refine pass without accumulating noise.
 */

import { REQUIRED_SECTIONS } from './quality';
import { parseSkill, serializeSkill } from './sections';
import { slugify, stripFences } from './skill';

export interface NormalizeResult {
  markdown: string;
  /** Human-readable list of what was changed. */
  applied: string[];
  /** Required sections that were still absent and had to be left empty. */
  unresolved: string[];
}

const CANONICAL = REQUIRED_SECTIONS;
const CANONICAL_BY_LOWER = new Map(CANONICAL.map((t) => [t.toLowerCase(), t]));
const ORDER = new Map(CANONICAL.map((t, i) => [t, i]));

/** Sections we can stub with an honest "nothing to report" when absent. */
const STUBS: Record<string, string> = {
  'Prerequisites': 'None.',
  'When NOT to use it': 'None stated by the source material.',
  'Rules and constraints': 'None stated by the source material.',
  'Common mistakes': 'None stated by the source material.',
  'Missing information': 'None.',
};

/** The sections whose absence cannot be papered over: they carry the content. */
const ESSENTIAL = new Set(['When to use it', 'Procedure', 'Examples']);

/** Replaces em and en dashes, which the prompt forbids. */
export function stripDashes(md: string): string {
  return md
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\u2013/g, '-')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]+,/g, ',');
}

/** Numbered steps of a procedure body, without their leading marker. */
export function procedureSteps(body: string): string[] {
  return body
    .split('\n')
    .filter((l) => /^\s*\d+[.)]\s+\S/.test(l))
    .map((l) => l.replace(/^\s*\d+[.)]\s+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Checklist items derived from the procedure, so it is verifiable by itself. */
export function synthesizeChecklist(body: string): string[] {
  return procedureSteps(body)
    .slice(0, 8)
    .map((s) => `- [ ] ${s.length > 120 ? `${s.slice(0, 117).trimEnd()}...` : s}`);
}

function countChecklistItems(md: string): number {
  return md.split('\n').filter((l) => /^\s*-\s*\[\s*[x ]?\s*\]/.test(l)).length;
}

function splitHead(head: string): { fm: string; body: string } {
  const match = head.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { fm: '', body: head };
  return { fm: match[1], body: head.slice(match[0].length) };
}

function fmField(fm: string, field: string): string {
  const line = fm.split('\n').find((l) => l.trim().startsWith(`${field}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

/** First sentence of a section body, capped to a description-sized length. */
function firstSentence(body: string, maxWords = 30): string {
  const clean = body.replace(/\s+/g, ' ').replace(/^[-*\d.)\s]+/, '').trim();
  if (!clean) return '';
  const end = clean.search(/[.!?]/);
  const sentence = end === -1 ? clean : clean.slice(0, end + 1);
  return sentence.split(/\s+/).slice(0, maxWords).join(' ');
}

/**
 * Rebuilds the head (frontmatter plus `#` title) so `name`, `description` and a
 * title always exist and the slug is stable.
 */
function normalizeHead(
  head: string,
  sections: { title: string; body: string }[],
): { head: string; applied: string[] } {
  const applied: string[] = [];
  const { fm, body } = splitHead(head);

  const existingName = fmField(fm, 'name');
  const existingDesc = fmField(fm, 'description');
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const nameSource = existingName || title || 'untitled-skill';
  const name = slugify(nameSource);
  if (!existingName) applied.push('added the `name` field');
  else if (name !== existingName) applied.push('normalised `name` to a kebab-case slug');

  let description = existingDesc;
  if (!description) {
    const whenToUse = sections.find((s) => s.title.toLowerCase() === 'when to use it');
    description = firstSentence(whenToUse?.body ?? '');
    if (description) applied.push('added a `description` derived from "When to use it"');
    else description = `A skill named ${name.replace(/-/g, ' ')}.`;
  }

  const cleanTitle = title || name.replace(/-/g, ' ');
  if (!title) applied.push('added the document title');

  return {
    head: `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${cleanTitle}`,
    applied,
  };
}

/** Collapses runs of blank lines and trims trailing spaces on every line. */
function tidy(md: string): string {
  return md
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalises a whole skill document. See the file header for the guarantees.
 */
export function normalizeSkill(input: string): NormalizeResult {
  const applied: string[] = [];
  let md = stripFences(input);

  const dashed = stripDashes(md);
  if (dashed !== md) {
    applied.push('replaced em/en dashes with commas and hyphens');
    md = dashed;
  }

  const parsed = parseSkill(md);
  let sections = parsed.sections.map((s) => ({ title: s.title, body: s.body }));

  // Canonicalise the heading text of the sections we know.
  let retitled = false;
  sections = sections.map((s) => {
    const canon = CANONICAL_BY_LOWER.get(s.title.trim().toLowerCase());
    if (canon && canon !== s.title) {
      retitled = true;
      return { title: canon, body: s.body };
    }
    return s;
  });
  if (retitled) applied.push('canonicalised the section headings');

  // Put the known sections in the canonical order; unknown ones stay, at the end.
  const ordered = [...sections].sort(
    (a, b) => (ORDER.get(a.title) ?? 1000) - (ORDER.get(b.title) ?? 1000),
  );
  if (ordered.some((s, i) => s !== sections[i])) {
    applied.push('reordered the sections into the canonical order');
    sections = ordered;
  }

  // Add the stubs for the sections whose absence has an honest default.
  for (const [title, body] of Object.entries(STUBS)) {
    if (!sections.some((s) => s.title === title)) {
      sections.push({ title, body });
      applied.push(`added the "${title}" section`);
    }
  }

  // Synthesise the final checklist from the procedure when it is thin.
  const checklistIndex = () => sections.findIndex((s) => s.title === 'Final checklist');
  const procedure = sections.find((s) => s.title === 'Procedure');
  if (checklistIndex() === -1) {
    if (procedure) {
      sections.push({ title: 'Final checklist', body: synthesizeChecklist(procedure.body).join('\n') });
      applied.push('synthesised the final checklist from the procedure');
    }
  } else {
    const existing = countChecklistItems(sections[checklistIndex()].body);
    if (existing < 2 && procedure) {
      const extra = synthesizeChecklist(procedure.body);
      sections[checklistIndex()] = {
        title: 'Final checklist',
        body: `${sections[checklistIndex()].body.trim()}\n${extra.join('\n')}`.trim(),
      };
      applied.push('extended the final checklist from the procedure');
    }
  }

  // Re-sort once more: stubs and the synthesised checklist must land in order.
  sections.sort((a, b) => (ORDER.get(a.title) ?? 1000) - (ORDER.get(b.title) ?? 1000));

  const headResult = normalizeHead(parsed.head, sections);
  applied.push(...headResult.applied);

  const present = new Set(sections.map((s) => s.title));
  const unresolved = CANONICAL.filter((t) => ESSENTIAL.has(t) && !present.has(t));

  const markdown = tidy(serializeSkill({ head: headResult.head, sections }));
  return { markdown, applied, unresolved };
}
