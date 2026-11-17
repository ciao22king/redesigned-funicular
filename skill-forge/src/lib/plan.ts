/**
 * Pre-generation summary: what the system understood before it writes anything.
 *
 * It is deliberately computed from the material alone, with no model call, so
 * it is instant and free. The point is to show the user what was detected and
 * what is missing, and to let them correct it before spending a generation.
 */

import { findAudience, type AudienceId } from './audience';

export interface PlanMaterial {
  kind: 'file' | 'url' | 'text';
  label: string;
  /** Characters contributed, after fetching and trimming. */
  chars: number;
}

export interface Plan {
  title: string;
  objective: string;
  audience: AudienceId;
  constraints: string[];
  materials: PlanMaterial[];
  /** Things the material does not say, which the model must ask about. */
  missing: string[];
}

/** Markers that a piece of information was never filled in. */
const UNKNOWN_MARKERS = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /\bXXX\b/i,
  /\?\?\?/,
  /\bnot sure\b/i,
  /\bnon so\b/i,
  /\bda definire\b/i,
  /<\s*[a-z _-]+\s*>/i,
  /\[\s*[a-z _-]+\s*\]/i,
];

/** Phrases that state a rule, a limit or a prohibition. */
const CONSTRAINT_HINTS = [
  /\bmust\b/i,
  /\bnever\b/i,
  /\balways\b/i,
  /\bonly\b/i,
  /\bdo not\b/i,
  /\bdon't\b/i,
  /\bnon\s+(?:deve|si deve|va)\b/i,
  /\bsempre\b/i,
  /\bmai\b/i,
  /\bsolo\b/i,
];

/** Terms that suggest who will read the result. */
const AUDIENCE_HINTS: Array<{ id: AudienceId; re: RegExp }> = [
  { id: 'claude-code', re: /\bclaude code\b|\bCLAUDE\.md\b/i },
  { id: 'codex', re: /\bcodex\b/i },
  { id: 'human', re: /\bfor (?:a )?(?:person|human|teammate|colleague)\b|\bfor people\b|\bfor the team\b/i },
  { id: 'generic-agent', re: /\bagent\b|\bassistant\b/i },
];

function firstSentence(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const end = clean.search(/[.!?\n]/);
  const sentence = end === -1 ? clean : clean.slice(0, end + 1);
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}...` : sentence;
}

/** A short title from the first heading, or the first line, or a fallback. */
export function deriveTitle(text: string): string {
  const heading = text.match(/^#{1,3}\s+(.+)$/m);
  if (heading) return heading[1].trim().slice(0, 80);
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 3);
  if (line) return line.replace(/^[-*]\s*/, '').slice(0, 80);
  return 'Untitled skill';
}

function deriveObjective(text: string): string {
  const purpose = text.match(/(?:goal|objective|purpose|scopo|obiettivo)\s*[:\-]\s*(.+)/i);
  if (purpose) return firstSentence(purpose[1]);
  return firstSentence(text);
}

/** Picks the audience the material hints at, or the default. */
export function detectAudience(text: string, fallback: AudienceId): AudienceId {
  for (const hint of AUDIENCE_HINTS) {
    if (hint.re.test(text)) return hint.id;
  }
  return fallback;
}

function detectConstraints(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const found: string[] = [];
  for (const line of lines) {
    if (line.length < 8 || line.length > 200) continue;
    if (CONSTRAINT_HINTS.some((re) => re.test(line))) {
      found.push(line.replace(/^[-*]\s*/, '').slice(0, 140));
    }
    if (found.length >= 6) break;
  }
  return found;
}

function detectMissing(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (UNKNOWN_MARKERS.some((re) => re.test(trimmed))) {
      found.push(trimmed.replace(/^[-*]\s*/, '').slice(0, 140));
    }
    if (found.length >= 8) break;
  }
  return found;
}

/** Builds the summary shown before generation. */
export function buildPlan(input: {
  text: string;
  materials: PlanMaterial[];
  audience: AudienceId;
}): Plan {
  const { text, materials, audience } = input;
  const detected = detectAudience(text, audience);
  const missing = detectMissing(text);

  // The material often says nothing explicit about what is unknown, so a short
  // list of structural questions is added, phrased for the reader to confirm.
  const structural: string[] = [];
  if (!/\bwhen\b.*\bnot\b/i.test(text)) structural.push('When should this NOT be used?');
  if (!/\bprerequisit|\brequire/i.test(text)) structural.push('What must be available before starting?');
  if (!/\bverif|\bchecklist|\bcheck\b/i.test(text)) structural.push('How is success verified at the end?');

  return {
    title: deriveTitle(text),
    objective: deriveObjective(text),
    audience: detected,
    constraints: detectConstraints(text),
    materials,
    missing: [...missing, ...structural].slice(0, 8),
  };
}

/** One-line audience name, for the summary line. */
export function audienceLabel(id: AudienceId): string {
  return findAudience(id).label;
}
