/**
 * Automatic quality check on a generated skill.
 *
 * It runs after generation and returns findings the user can act on, rather
 * than a silent pass/fail. The rules are deliberately conservative: a false
 * warning is worse than no warning, because it teaches people to ignore them.
 */

export type FindingLevel = 'error' | 'warning';

export interface Finding {
  level: FindingLevel;
  /** Machine-readable id, stable across languages and wording changes. */
  code: string;
  message: string;
}

export interface QualityReport {
  findings: Finding[];
  score: number;
  ok: boolean;
  stats: {
    words: number;
    sections: number;
    steps: number;
    examples: number;
    checklistItems: number;
  };
}

/** Sections every skill must have, in the order the prompt asks for. */
export const REQUIRED_SECTIONS = [
  'When to use it',
  'When NOT to use it',
  'Prerequisites',
  'Procedure',
  'Rules and constraints',
  'Examples',
  'Common mistakes',
  'Final checklist',
];

/** Words that make an instruction look optional when it must be firm. */
const HEDGES = [
  'consider',
  'maybe',
  'if possible',
  'try to',
  'you might',
  'it could be',
  'perhaps',
  'ideally',
  'as needed',
];

/** Longest a single procedure step should reasonably be, in words. */
const MAX_STEP_WORDS = 60;
/** Below this, the document is too thin to be executed without context. */
const MIN_WORDS = 200;

interface Section {
  title: string;
  body: string;
}

/** Splits the markdown into `##` sections, keeping the heading text. */
export function splitSections(md: string): Section[] {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), body: '' };
      continue;
    }
    if (current) current.body += `${line}\n`;
  }
  if (current) sections.push(current);
  return sections;
}

function countSteps(procedure: string): number {
  return procedure
    .split('\n')
    .filter((l) => /^\s*\d+[.)]\s+\S/.test(l)).length;
}

function countChecklistItems(md: string): number {
  return md.split('\n').filter((l) => /^\s*-\s*\[\s*[x ]?\s*\]/.test(l)).length;
}

function countExamples(sections: Section[]): number {
  const examples = sections.find((s) => s.title.toLowerCase() === 'examples');
  if (!examples) return 0;
  return examples.body.split('\n').filter((l) => /^###\s+\S/.test(l)).length;
}

/**
 * Checks the document against the structure the generator promises, and flags
 * the two content problems that matter most: steps that are not actionable, and
 * facts that were invented instead of asked for.
 */
export function checkQuality(md: string): QualityReport {
  const findings: Finding[] = [];
  const sections = splitSections(md);
  const titles = sections.map((s) => s.title);
  const lowerTitles = titles.map((t) => t.toLowerCase());

  for (const required of REQUIRED_SECTIONS) {
    if (!lowerTitles.includes(required.toLowerCase())) {
      findings.push({
        level: 'error',
        code: `missing-section:${required}`,
        message: `Missing section: "${required}".`,
      });
    }
  }

  const words = md.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS) {
    findings.push({
      level: 'error',
      code: 'too-short',
      message: `Only ${words} words. Too short to be executed without external context.`,
    });
  }

  const procedure = sections.find((s) => s.title.toLowerCase() === 'procedure');
  const steps = procedure ? countSteps(procedure.body) : 0;
  if (procedure && steps < 3) {
    findings.push({
      level: 'error',
      code: 'few-steps',
      message: `The procedure has ${steps} numbered steps. It needs at least 3.`,
    });
  }

  if (procedure) {
    const long = procedure.body
      .split('\n')
      .filter((l) => /^\s*\d+[.)]\s+\S/.test(l))
      .filter((l) => l.split(/\s+/).filter(Boolean).length > MAX_STEP_WORDS);
    if (long.length > 0) {
      findings.push({
        level: 'warning',
        code: 'long-step',
        message: `${long.length} step(s) longer than ${MAX_STEP_WORDS} words: split them so each step is one action.`,
      });
    }
  }

  const examples = countExamples(sections);
  if (examples === 0) {
    findings.push({
      level: 'error',
      code: 'no-examples',
      message: 'No examples. The "Examples" section must contain at least one input and one expected output.',
    });
  }

  const checklist = countChecklistItems(md);
  if (checklist < 2) {
    findings.push({
      level: 'warning',
      code: 'thin-checklist',
      message: `The final checklist has ${checklist} item(s). It needs at least 2 verifiable items.`,
    });
  }

  const hedges = HEDGES.filter((h) => new RegExp(`\\b${h}\\b`, 'i').test(md));
  if (hedges.length > 0) {
    findings.push({
      level: 'warning',
      code: 'hedging',
      message: `Ambiguous terms make the instructions optional: ${hedges.join(', ')}. Replace them with a decision.`,
    });
  }

  // Contradiction heuristic: the same section both requires and forbids a thing
  // is rare, but "must" and "must not" in one document usually means the model
  // changed its mind halfway.
  const rules = sections.find((s) => s.title.toLowerCase() === 'rules and constraints');
  if (rules) {
    const must = (rules.body.match(/\bmust\b/gi) ?? []).length;
    const mustNot = (rules.body.match(/\bmust not\b/gi) ?? []).length;
    if (must > 0 && mustNot > 0 && mustNot > must) {
      findings.push({
        level: 'warning',
        code: 'many-prohibitions',
        message: `The rules are mostly prohibitions (${mustNot} "must not" against ${must} "must"): state what to do, not only what to avoid.`,
      });
    }
  }

  const errors = findings.filter((f) => f.level === 'error').length;
  const warnings = findings.filter((f) => f.level === 'warning').length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 5);

  return {
    findings,
    score,
    ok: errors === 0,
    stats: {
      words,
      sections: sections.length,
      steps,
      examples,
      checklistItems: checklist,
    },
  };
}
