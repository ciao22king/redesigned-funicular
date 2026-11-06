import type { Config } from './config.js';
import type {
  GenerateResponse,
  ListResponse,
  Quota,
  SkillDetail,
} from './types.js';

/**
 * Client HTTP verso il servizio Skill Forge.
 *
 * La CLI non tocca il database: parla solo con l'API pubblica, come farebbe il
 * browser. Il token GitHub va in `Authorization: Bearer`, che il server
 * verifica contro l'API di GitHub.
 */

/** Errore HTTP con lo stato, per distinguere 401/404/429 dai guasti di rete. */
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
  /** Iniettabile nei test per non toccare la rete. */
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

  /** Vero se c'e' un token: i comandi che scrivono lo pretendono. */
  get authenticated(): boolean {
    return Boolean(this.token);
  }

  /** URL base, per comporre i link mostrati all'utente. */
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
      const reason = err instanceof Error ? err.message : 'errore di rete';
      throw new ApiError(`Impossibile contattare ${this.url}: ${reason}`, 0);
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
        `Richiesta fallita (HTTP ${res.status})`;
      throw new ApiError(message, res.status);
    }
    return data as T;
  }

  /** Cerca nel marketplace. Senza autenticazione mostra solo i dati pubblici. */
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

  /** Genera una skill. La quota si consuma solo se la richiesta va a buon fine. */
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

  /** Identita' dell'utente autenticato, con la sua quota. */
  async me(): Promise<{ login: string; quota: Quota }> {
    return this.request<{ login: string; quota: Quota }>('/api/me');
  }
}
