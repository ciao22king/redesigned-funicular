import type { Config } from './config.js';
import type {
  GenerateResponse,
  ListResponse,
  Quota,
  SkillDetail,
} from './types.js';

/**
 * HTTP client towards the Skill Forge service.
 *
 * The CLI does not touch the database: it talks only to the public API, as the
 * browser would. The GitHub token goes in `Authorization: Bearer`, which the
 * server verifies against the GitHub API.
 */

/** HTTP error with the status, to tell 401/404/429 from network failures. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ClientOptions {
  url: string;
  token?: string;
  /** Injectable in tests to avoid touching the network. */
  fetchImpl?: typeof fetch;
}

export class Client {
  private readonly url: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    this.url = options.url.replace(/\/+$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromConfig(config: Config, fetchImpl?: typeof fetch): Client {
    return new Client({ url: config.url, token: config.token, fetchImpl });
  }

  /** True if there is a token: the commands that write require it. */
  get authenticated(): boolean {
    return Boolean(this.token);
  }

  /** Base URL, to build the links shown to the user. */
  get baseUrl(): string {
    return this.url;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.url}${path}`, {
        ...init,
        headers: this.headers(init?.headers as Record<string, string> | undefined),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'network error';
      throw new ApiError(`Cannot reach ${this.url}: ${reason}`, 0);
    }

    const text = await res.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (!res.ok) throw new ApiError(text.slice(0, 200), res.status);
      }
    }

    if (!res.ok) {
      const message =
        (data as { error?: string } | undefined)?.error ??
        `Request failed (HTTP ${res.status})`;
      throw new ApiError(message, res.status);
    }
    return data as T;
  }

  /** Searches the marketplace. Without authentication it shows only public data. */
  async list(params: {
    q?: string;
    sort?: string;
    owner?: string;
    page?: number;
  } = {}): Promise<ListResponse> {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.sort) search.set('sort', params.sort);
    if (params.owner) search.set('owner', params.owner);
    if (params.page && params.page > 1) search.set('page', String(params.page));
    const qs = search.toString();
    return this.request<ListResponse>(`/api/marketplace${qs ? `?${qs}` : ''}`);
  }

  async detail(id: string): Promise<SkillDetail> {
    const data = await this.request<{ skill: SkillDetail }>(
      `/api/marketplace/detail?id=${encodeURIComponent(id)}`,
    );
    return data.skill;
  }

  async star(id: string): Promise<{ starred: boolean; stars: number }> {
    return this.request<{ starred: boolean; stars: number }>('/api/marketplace/star', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async publish(input: {
    markdown: string;
    name?: string;
    description?: string;
    tags?: string[];
  }): Promise<SkillDetail> {
    const data = await this.request<{ skill: SkillDetail }>('/api/marketplace/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return data.skill;
  }

  async remove(slug: string): Promise<void> {
    await this.request<{ ok: boolean }>(
      `/api/marketplace/publish?slug=${encodeURIComponent(slug)}`,
      { method: 'DELETE' },
    );
  }

  /** Generates a skill. The quota is consumed only if the request succeeds. */
  async generate(body: Record<string, unknown>): Promise<GenerateResponse> {
    return this.request<GenerateResponse>('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async quota(): Promise<Quota> {
    return this.request<Quota>('/api/generate');
  }

  /** Identity of the authenticated user, with their quota. */
  async me(): Promise<{ login: string; quota: Quota }> {
    return this.request<{ login: string; quota: Quota }>('/api/me');
  }
}
