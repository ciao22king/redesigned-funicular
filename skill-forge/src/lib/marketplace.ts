import { readFrontmatterDescription, readFrontmatterName, slugify } from './skill';
import { MAX_OUTPUT_CHARS } from './guardrails';

/**
 * Marketplace: logica pura, senza accesso al database.
 *
 * Tutto cio' che si puo' decidere senza toccare D1 vive qui (validazione,
 * normalizzazione, composizione degli id), cosi' e' verificabile con test
 * unitari. Le query stanno in `marketplace-db.ts`.
 */

/** Tetto dei tag per skill. */
export const MAX_TAGS = 6;
/** Lunghezza massima di un tag. */
export const MAX_TAG_CHARS = 24;
/** Lunghezza massima di nome e descrizione. */
export const MAX_NAME_CHARS = 120;
export const MAX_DESCRIPTION_CHARS = 400;

export type SortKey = 'recent' | 'stars' | 'name';

export interface SkillInput {
  name?: string;
  description?: string;
  markdown?: string;
  tags?: string[] | string;
}

export interface NormalizedSkill {
  slug: string;
  name: string;
  description: string;
  markdown: string;
  tags: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: NormalizedSkill;
}

/**
 * Id pubblico di una skill: `owner/slug`. Lo slug da solo non e' univoco,
 * perche' due autori diversi possono avere una skill con lo stesso nome.
 */
export function skillId(owner: string, slug: string): string {
  return `${owner}/${slug}`;
}

/** Scompone un id pubblico. Restituisce undefined se il formato non e' valido. */
export function parseSkillId(id: string): { owner: string; slug: string } | undefined {
  const idx = id.indexOf('/');
  if (idx <= 0 || idx === id.length - 1) return undefined;
  return { owner: id.slice(0, idx), slug: id.slice(idx + 1) };
}

/**
 * Normalizza i tag: separatore virgola o spazio, slug kebab-case, dedup,
 * tetto di quantita' e lunghezza. Restituisce la stringa salvata su D1.
 */
export function parseTags(input: string[] | string | undefined): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : input.split(/[,\s]+/);
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = slugify(String(item)).slice(0, MAX_TAG_CHARS);
    if (tag && tag !== 'skill-senza-nome') seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

/** Ricompone la stringa dei tag salvata su D1. */
export function serializeTags(tags: string[]): string {
  return tags.join(',');
}

/** Legge la stringa dei tag salvata su D1. */
export function deserializeTags(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Valida e normalizza una skill in arrivo dal client.
 *
 * Nome e descrizione, se assenti, si ricavano dal frontmatter: cosi' una skill
 * generata dall'app si pubblica cosi' com'e', senza che il client debba
 * riestrarre i campi.
 */
export function validateSkillInput(input: SkillInput): ValidationResult {
  const markdown = (input.markdown ?? '').trim();

  if (!markdown) {
    return { ok: false, error: 'La skill e\' vuota.' };
  }
  if (markdown.length > MAX_OUTPUT_CHARS) {
    return { ok: false, error: 'La skill e\' troppo lunga.' };
  }

  const name = (input.name ?? readFrontmatterName(markdown) ?? '').trim();
  if (!name) {
    return { ok: false, error: 'La skill non ha un nome (campo `name`).' };
  }
  if (name.length > MAX_NAME_CHARS) {
    return { ok: false, error: 'Il nome della skill e\' troppo lungo.' };
  }

  const description = (
    input.description ??
    readFrontmatterDescription(markdown) ??
    ''
  ).trim();
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return { ok: false, error: 'La descrizione e\' troppo lunga.' };
  }

  return {
    ok: true,
    value: {
      slug: slugify(name),
      name,
      description,
      markdown,
      tags: serializeTags(parseTags(input.tags)),
    },
  };
}

export interface SkillRow {
  id: string;
  slug: string;
  owner: string;
  name: string;
  description: string;
  markdown: string;
  tags: string;
  stars: number;
  created_at: string;
  updated_at: string;
}

/** Versione per la vetrina: senza il corpo markdown, che pesa. */
export interface SkillSummary {
  id: string;
  owner: string;
  name: string;
  description: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

/** Versione completa, con il markdown, per il download e la modifica. */
export interface SkillDetail extends SkillSummary {
  markdown: string;
}

export function toSummary(row: SkillRow, starred = false): SkillSummary & { starred: boolean } {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    description: row.description,
    tags: deserializeTags(row.tags),
    stars: Number(row.stars) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    starred,
  };
}

export function toDetail(row: SkillRow, starred = false): SkillDetail & { starred: boolean } {
  return { ...toSummary(row, starred), markdown: row.markdown };
}

/** Query di ricerca ripulita: stringa vuota significa "nessun filtro". */
export function normalizeQuery(q: string | null | undefined): string {
  return (q ?? '').trim().slice(0, 80);
}

/**
 * Aggiunge le clausole di ricerca a una query SQL.
 * I termini sono legati come parametri: nessuna interpolazione di stringhe.
 */
export function searchClause(query: string): { sql: string; params: string[] } {
  if (!query) return { sql: '', params: [] };
  const like = `%${query.toLowerCase()}%`;
  return {
    sql: ' AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? OR lower(owner) LIKE ?)',
    params: [like, like, like, like],
  };
}

/** Clausola ORDER BY per le tre modalita' di ordinamento. */
export function orderClause(sort: SortKey): string {
  switch (sort) {
    case 'stars':
      return 'stars DESC, created_at DESC';
    case 'name':
      return 'name COLLATE NOCASE ASC';
    default:
      return 'created_at DESC';
  }
}

/** Converte il parametro di query `sort` in una chiave nota. */
export function parseSort(value: string | null | undefined): SortKey {
  return value === 'stars' || value === 'name' ? value : 'recent';
}
