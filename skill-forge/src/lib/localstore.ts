/**
 * Archivio locale delle skill generate.
 *
 * Ogni skill che l'utente genera finisce qui, anche se non la scarica e non la
 * committa: il browser e' il posto piu' immediato in cui ritrovarla. Le skill
 * pubblicate sul marketplace restano anche su D1, ma questa copia locale e'
 * indipendente e funziona senza login.
 *
 * La logica di serializzazione e' pura, cosi' e' testabile senza un browser:
 * le funzioni che leggono e scrivono davvero accettano uno `Storage` iniettabile.
 */

import { slugify } from './skill';

const KEY = 'skillforge:skills:v1';
/** Tetto di sicurezza: localStorage ha un limite di pochi MB per origine. */
export const MAX_LOCAL_SKILLS = 200;

export interface LocalSkill {
  /** Id locale: slug del nome. Le skill con lo stesso nome si aggiornano. */
  id: string;
  name: string;
  description: string;
  markdown: string;
  /** Da dove viene: generata dai campi, dal materiale, o importata. */
  source: 'from-scratch' | 'from-skills' | 'imported';
  createdAt: string;
  updatedAt: string;
  /** Id sul marketplace, se e' stata pubblicata. */
  publishedId?: string;
}

/** Sottoinsieme di `Storage` che ci serve: cosi' i test passano un finto. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    // Safari in modalita' privata lancia all'accesso: meglio degradare che
    // far cadere la pagina.
    return undefined;
  }
}

/** Legge l'elenco, scartando le voci corrotte invece di far cadere la pagina. */
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
    // Quota piena: non e' un errore fatale per l'utente.
  }
}

export interface SaveInput {
  markdown: string;
  name?: string;
  description?: string;
  source?: LocalSkill['source'];
}

/**
 * Salva (o aggiorna) una skill in locale e restituisce l'elenco aggiornato.
 * Le skill con lo stesso slug si sovrascrivono, cosi' rigenerare la stessa
 * skill non riempie l'archivio di doppioni.
 */
export function saveLocalSkill(
  input: SaveInput,
  storage?: StorageLike,
): { skill: LocalSkill; skills: LocalSkill[] } {
  const store = storage ?? browserStorage();
  const now = new Date().toISOString();
  const name = (input.name ?? '').trim() || 'Skill senza nome';
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
    // Conserviamo il riferimento alla pubblicazione, se c'era.
    publishedId: previous?.publishedId,
  };

  const skills = [skill, ...existing.filter((s) => s.id !== id)].slice(
    0,
    MAX_LOCAL_SKILLS,
  );
  writeLocalSkills(skills, store);
  return { skill, skills };
}

/** Segna una skill locale come pubblicata, salvando l'id sul marketplace. */
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

/** Rimuove una skill locale. */
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
