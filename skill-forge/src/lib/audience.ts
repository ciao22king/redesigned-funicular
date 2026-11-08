/**
 * Audience and tone: the two knobs that change how a skill is written.
 *
 * They live here, away from the UI, so the CLI and the tests use the same
 * vocabulary. The label is what the model receives, so it is stable English:
 * translating it would change the generated output.
 */

export interface Audience {
  id: AudienceId;
  label: string;
  hint: string;
}

export type AudienceId = 'claude-code' | 'codex' | 'generic-agent' | 'human';

export const AUDIENCES: Audience[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    hint: 'Uses tools, reads files, runs commands. Wants exact paths and commands.',
  },
  {
    id: 'codex',
    label: 'Codex',
    hint: 'Autonomous coding agent. Wants a clear task and explicit acceptance criteria.',
  },
  {
    id: 'generic-agent',
    label: 'Another AI agent',
    hint: 'A generic agent: keep the instructions tool-agnostic and self-contained.',
  },
  {
    id: 'human',
    label: 'Human use',
    hint: 'Written for a person: explain the why, not only the steps.',
  },
];

/** Default target: the agent most people use today. */
export const DEFAULT_AUDIENCE: AudienceId = 'claude-code';

export function findAudience(id: string | undefined): Audience {
  return AUDIENCES.find((a) => a.id === id) ?? AUDIENCES[0];
}

export type ToneId = 'concise' | 'technical' | 'didactic';

export interface Tone {
  id: ToneId;
  label: string;
  hint: string;
}

export const TONES: Tone[] = [
  {
    id: 'concise',
    label: 'Concise',
    hint: 'Short sentences, no preamble. Every line carries a decision.',
  },
  {
    id: 'technical',
    label: 'Technical',
    hint: 'Precise terms, exact versions and paths, no simplifications.',
  },
  {
    id: 'didactic',
    label: 'Didactic',
    hint: 'Explains the reasoning behind each step, for someone learning.',
  },
];

export const DEFAULT_TONE: ToneId = 'technical';

export function findTone(id: string | undefined): Tone {
  return TONES.find((t) => t.id === id) ?? TONES.find((t) => t.id === DEFAULT_TONE) ?? TONES[0];
}

/** Instruction block injected into the prompt for the chosen audience. */
export function audienceInstruction(id: string | undefined): string {
  const a = findAudience(id);
  switch (a.id) {
    case 'claude-code':
      return `The skill is read by Claude Code. It has file access and a shell. Give exact file paths, exact commands, and the order to run them. Where a check needs a tool, name the tool.`;
    case 'codex':
      return `The skill is read by Codex, an autonomous coding agent. State the task, the files it may touch, and the acceptance criteria it must satisfy before stopping.`;
    case 'generic-agent':
      return `The skill is read by a generic AI agent whose tools you do not know. Stay tool-agnostic, describe each action in plain terms, and do not assume a specific shell or editor.`;
    case 'human':
      return `The skill is read by a person. Explain why each step matters, not only what to do, and define any term that is not common knowledge.`;
  }
}

/** Instruction block injected into the prompt for the chosen tone. */
export function toneInstruction(id: string | undefined): string {
  const t = findTone(id);
  switch (t.id) {
    case 'concise':
      return `Tone: concise. Short sentences. No preamble, no restating the obvious. Cut every word that does not carry a decision.`;
    case 'technical':
      return `Tone: technical. Use precise terms, exact versions, exact paths and exact commands. Do not simplify.`;
    case 'didactic':
      return `Tone: didactic. After each step, add one short line explaining why it is done that way, so a beginner understands the reasoning.`;
  }
}
