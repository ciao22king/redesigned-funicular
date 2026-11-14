/**
 * Fetching material from a source the user named: a public URL, a GitHub
 * repository, a Google Doc, a Notion page.
 *
 * SECURITY: this runs on the server and fetches a URL chosen by an anonymous
 * visitor, so every fetch is an SSRF risk. The rules below are the whole point
 * of this file:
 *   - only http/https, and only on a public host (no loopback, no private
 *     ranges, no link-local, no cloud metadata);
 *   - redirects are followed by hand, and each hop is validated again, so a
 *     public URL cannot bounce into the internal network;
 *   - a hard cap on the body size and on the time, so a huge or slow response
 *     cannot exhaust the Worker;
 *   - HTML is reduced to text, so we never feed a page's scripts to the model.
 */

export interface FetchOk {
  ok: true;
  text: string;
  /** Where the content finally came from, after redirects. */
  finalUrl: string;
  truncated: boolean;
}

export interface FetchErr {
  ok: false;
  error: string;
}

export type FetchResult = FetchOk | FetchErr;

export const MAX_FETCH_BYTES = 400_000;
export const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;

/** Hosts that must never be reachable from a user-supplied URL. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

/**
 * True when the host is a literal IP in a range that is not public.
 * Hostnames are not resolved here: resolving would let DNS rebinding bypass the
 * check, and Cloudflare's fetch already refuses most internal targets. The
 * literal-IP case is the one we can decide reliably, so we do.
 */
export function isPrivateIp(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  const v6 = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (v6.includes(':')) {
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fe80')) return true; // link-local
    if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // unique local
    if (v6.startsWith('::ffff:')) {
      // IPv4-mapped: validate the embedded address instead of the wrapper.
      return isPrivateIp(v6.replace('::ffff:', ''));
    }
    return false;
  }

  return false;
}

/** Validates a URL before any request is made. Returns an error message or null. */
export function validatePublicUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Not a valid URL.';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Only http and https URLs are accepted.';
  }
  const host = normalizeHost(url.hostname);
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'That host is not reachable from here.';
  }
  if (isPrivateIp(host)) {
    return 'Private and internal addresses are not accepted.';
  }
  return null;
}

/**
 * Normalises a hostname so equivalent spellings cannot slip past the checks:
 * a fully-qualified name may carry a trailing dot (`localhost.` == `localhost`),
 * and the URL parser canonicalises an IPv4-mapped IPv6 literal to hex
 * (`[::ffff:7f00:1]`), which `isPrivateIp` would not recognise as `127.0.0.1`.
 */
export function normalizeHost(host: string): string {
  const h = host.toLowerCase().replace(/\.+$/, '');
  const mapped = h.replace(/^\[|\]$/g, '').match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
  }
  return h;
}

/** Strips tags, scripts and styles, and collapses whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fetches a public URL as text.
 *
 * Redirects are followed manually so every hop passes `validatePublicUrl`: the
 * default `redirect: 'follow'` would let an attacker point a public URL at an
 * internal one and have the runtime follow it for us.
 */
export async function fetchPublicText(raw: string): Promise<FetchResult> {
  let current = raw;
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const invalid = validatePublicUrl(current);
    if (invalid) return { ok: false, error: invalid };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SkillForgeBot/1.0 (+https://skillforge.cc.cd)',
          Accept: 'text/html,text/plain,text/markdown,application/json;q=0.9,*/*;q=0.5',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : 'network error';
      return { ok: false, error: `Could not reach the URL: ${message}` };
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: false, error: 'The URL redirected without a destination.' };
      current = new URL(location, current).toString();
      continue;
    }
    break;
  }

  if (!response) return { ok: false, error: 'The URL could not be fetched.' };
  if (!response.ok) {
    return { ok: false, error: `The source answered ${response.status}.` };
  }

  const type = (response.headers.get('content-type') ?? '').toLowerCase();
  const binary = ['image/', 'video/', 'audio/', 'application/pdf', 'application/zip', 'application/octet-stream'];
  if (binary.some((b) => type.startsWith(b))) {
    return { ok: false, error: `That URL is not text (${type.split(';')[0]}).` };
  }

  const buffer = await response.arrayBuffer();
  const truncated = buffer.byteLength > MAX_FETCH_BYTES;
  const slice = truncated ? buffer.slice(0, MAX_FETCH_BYTES) : buffer;
  const body = new TextDecoder('utf-8').decode(slice);

  const isHtml = type.includes('html') || /^\s*<(!doctype|html)/i.test(body);
  const text = isHtml ? htmlToText(body) : body.trim();

  if (text.length < 40) {
    return { ok: false, error: 'The source returned almost no readable text.' };
  }
  return { ok: true, text, finalUrl: current, truncated };
}

/**
 * Turns a GitHub repository URL into raw material: the README plus the file
 * tree. Uses the public API, so it works with no token and never clones.
 */
export async function fetchGitHubRepo(raw: string): Promise<FetchResult> {
  const match = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!match) return { ok: false, error: 'Not a GitHub repository URL.' };

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  // GitHub logins and repository names are a bounded character set. Without this
  // check, `..` would collapse the API path (`/repos/../..` -> `/`) and the
  // request would leave `/repos/` carrying the server token.
  if (!isGitHubName(owner) || !isGitHubName(repo)) {
    return { ok: false, error: 'Not a GitHub repository URL.' };
  }
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SkillForgeBot/1.0 (+https://skillforge.cc.cd)',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const [metaRes, treeRes] = await Promise.all([
      fetch(api, { headers, signal: controller.signal }),
      fetch(`${api}/contents`, { headers, signal: controller.signal }),
    ]);
    clearTimeout(timer);

    if (metaRes.status === 404) return { ok: false, error: 'That repository is private or does not exist.' };
    if (!metaRes.ok) return { ok: false, error: `GitHub answered ${metaRes.status}.` };

    const meta = (await metaRes.json()) as {
      full_name?: string;
      description?: string;
      language?: string;
      topics?: string[];
      default_branch?: string;
    };

    let files: string[] = [];
    if (treeRes.ok) {
      const entries = (await treeRes.json()) as Array<{ name?: string; type?: string }>;
      files = entries
        .filter((e) => e.name)
        .slice(0, 200)
        .map((e) => `${e.type === 'dir' ? 'dir ' : 'file'} ${e.name}`);
    }

    let readme = '';
    const readmeRes = await fetch(`${api}/readme`, { headers });
    if (readmeRes.ok) {
      const data = (await readmeRes.json()) as { content?: string; encoding?: string };
      if (data.content) {
        readme =
          data.encoding === 'base64'
            ? new TextDecoder('utf-8').decode(
                Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)),
              )
            : data.content;
      }
    }

    const parts = [
      `Repository: ${meta.full_name ?? `${owner}/${repo}`}`,
      meta.description ? `Description: ${meta.description}` : '',
      meta.language ? `Main language: ${meta.language}` : '',
      meta.topics?.length ? `Topics: ${meta.topics.join(', ')}` : '',
      files.length ? `\nTop-level files:\n${files.join('\n')}` : '',
      readme ? `\nREADME:\n${readme.slice(0, MAX_FETCH_BYTES)}` : '',
    ].filter(Boolean);

    return { ok: true, text: parts.join('\n'), finalUrl: `https://github.com/${owner}/${repo}`, truncated: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    return { ok: false, error: `GitHub could not be reached: ${message}` };
  }
}

/**
 * Converts a Google Docs / Sheets / Slides link into its public export URL.
 * A shared document exports as plain text with no authentication.
 */
export function googleExportUrl(raw: string): string | null {
  const docs = raw.match(/^https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docs) return `https://docs.google.com/document/d/${docs[1]}/export?format=txt`;

  const sheets = raw.match(/^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheets) return `https://docs.google.com/spreadsheets/d/${sheets[1]}/export?format=csv`;

  const slides = raw.match(/^https?:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slides) return `https://docs.google.com/presentation/d/${slides[1]}/export?format=txt`;

  return null;
}

/** Extracts the id from a Notion page URL. */
export function notionPageId(raw: string): string | null {
  const m = raw.match(/notion\.so\/(?:[^/]+\/)?([0-9a-fA-F]{32}|[0-9a-fA-F-]{36})/);
  if (!m) return null;
  return m[1].replace(/-/g, '');
}

/** True when the source is a Notion link. */
export function isNotionUrl(raw: string): boolean {
  return /notion\.so/i.test(raw);
}

/** True when the source is a Google Docs link. */
export function isGoogleUrl(raw: string): boolean {
  return /docs\.google\.com/i.test(raw);
}

/** True when the source is a GitHub repository link. */
export function isGitHubUrl(raw: string): boolean {
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+/i.test(raw);
}

/**
 * A GitHub owner or repository name. Owner: alphanumeric or hyphen, no leading
 * or trailing hyphen, up to 39 chars. Repository: those plus `_` and `.`, up to
 * 100. Deliberately excludes `.` and `..`, which would escape the API path.
 */
export function isGitHubName(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/.test(value) && !value.includes('..');
}
