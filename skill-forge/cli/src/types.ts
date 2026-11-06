/**
 * Types of the Skill Forge API responses.
 * Rispecchiano `src/lib/marketplace.ts` lato server.
 */

export interface SkillSummary {
  id: string;
  owner: string;
  name: string;
  description: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
}

export interface SkillDetail extends SkillSummary {
  markdown: string;
}

export interface Quota {
  used: number;
  remaining: number;
  limit: number;
  resetsAt: string;
  unlimited?: boolean;
}

export interface ListResponse {
  skills: SkillSummary[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface GenerateResponse {
  markdown?: string;
  model?: string;
  error?: string;
  quota?: Quota;
}
