/**
 * Local archive of the generated skills.
 *
 * Every skill the user generates ends up here, even if they do not download or
 * commit it: the browser is the most immediate place to find it again. Skills
 * published to the marketplace also stay on D1, but this local copy is
 * independent and works without login.
 *
 * The serialization logic is pure, so it is testable without a browser: the
 * functions that actually read and write accept an injectable `Storage`.
 */

import { slugify } from './skill';

const KEY = 'skillforge:skills:v1';
/** Safety cap: localStorage has a limit of a few MB per origin. */
export const MAX_LOCAL_SKILLS = 200;

export interface LocalSkill {
  /** Local id: slug of the name. Skills with the same name get updated. */
  id: string;
  name: string;
  description: string;
  markdown: string;
  /** Where it comes from: generated from the fields, from material, or imported. */
  source: 'from-scratch' | 'from-skills' | 'imported';
  createdAt: string;
  updatedAt: string;
  /** Marketplace id, if it was published. */
  publishedId?: string;
}

/** Subset of `Storage` that we need: so the tests pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    // Safari in private mode throws on access: better to degrade than to
    // bring the page down.
    return undefined;
  }
}

/** Reads the list, dropping corrupt entries instead of bringing the page down. */
export function readLocalSkills(storage?: StorageLike): LocalSkill[] {
  const store = storage ?? browserStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalSkill);
  } catch {
    return [];
  }
}

function isLocalSkill(value: unknown): value is LocalSkill {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.markdown === 'string'
  );
}

/** Riscrive l'intero elenco. */
export function writeLocalSkills(
  skills: LocalSkill[],
  storage?: StorageLike,
): void {
  const store = storage ?? browserStorage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(skills.slice(0, MAX_LOCAL_SKILLS)));
  } catch {
    // Quota full: not a fatal error for the user.
  }
}

export interface SaveInput {
  markdown: string;
  name?: string;
  description?: string;
  source?: LocalSkill['source'];
}

/**
 * Saves (or updates) a skill locally and returns the updated list.
 * Skills with the same slug overwrite each other, so regenerating the same
 * skill does not fill the archive with duplicates.
 */
export function saveLocalSkill(
  input: SaveInput,
  storage?: StorageLike,
): { skill: LocalSkill; skills: LocalSkill[] } {
  const store = storage ?? browserStorage();
  const now = new Date().toISOString();
  const name = (input.name ?? '').trim() || 'Untitled skill';
  const id = slugify(name);

  const existing = readLocalSkills(store);
  const previous = existing.find((s) => s.id === id);

  const skill: LocalSkill = {
    id,
    name,
    description: (input.description ?? '').trim(),
    markdown: input.markdown,
    source: input.source ?? 'from-scratch',
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    // Keep the publication reference, if there was one.
    publishedId: previous?.publishedId,
  };

  const skills = [skill, ...existing.filter((s) => s.id !== id)].slice(
    0,
    MAX_LOCAL_SKILLS,
  );
  writeLocalSkills(skills, store);
  return { skill, skills };
}

/** Marks a local skill as published, saving the marketplace id. */
export function markPublished(
  id: string,
  publishedId: string,
  storage?: StorageLike,
): LocalSkill[] {
  const store = storage ?? browserStorage();
  const skills = readLocalSkills(store).map((s) =>
    s.id === id ? { ...s, publishedId } : s,
  );
  writeLocalSkills(skills, store);
  return skills;
}

/** Removes a local skill. */
export function removeLocalSkill(
  id: string,
  storage?: StorageLike,
): LocalSkill[] {
  const store = storage ?? browserStorage();
  const skills = readLocalSkills(store).filter((s) => s.id !== id);
  writeLocalSkills(skills, store);
  return skills;
}

/** Svuota l'archivio locale. */
export function clearLocalSkills(storage?: StorageLike): void {
  const store = storage ?? browserStorage();
  store?.removeItem(KEY);
}
