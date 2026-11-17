/**
 * Fetching a skill for download, in one place.
 *
 * Two components download a skill (`SkillActions` on the skill page and the
 * marketplace list), and both must react the same way when the server answers
 * 401: the API requires a GitHub account, so the UI has to offer the sign-in
 * instead of showing a raw error. Keeping the rule here means the two cannot
 * drift.
 */

export interface DownloadedSkill {
  id: string;
  name: string;
  description: string;
  markdown: string;
}

/** Thrown when the API refuses because the visitor is not signed in. */
export class SignInRequiredError extends Error {
  constructor() {
    super('Sign in with GitHub to download a skill.');
    this.name = 'SignInRequiredError';
  }
}

/**
 * Fetches the markdown of a published skill.
 *
 * `token`, when given, is sent as a bearer token: the skill page is a server
 * component and can read the session, but the browser cannot always attach the
 * NextAuth cookie to a cross-context fetch, so passing the token explicitly is
 * the reliable path.
 */
export async function fetchSkillForDownload(
  id: string,
  token?: string,
): Promise<DownloadedSkill> {
  const res = await fetch(`/api/marketplace/detail?id=${encodeURIComponent(id)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.status === 401) throw new SignInRequiredError();

  const data = (await res.json()) as { skill?: DownloadedSkill; error?: string };
  if (!res.ok || !data.skill) throw new Error(data.error ?? 'Download failed');
  return data.skill;
}

/** Saves markdown as a `.md` file, the browser way. */
export function saveMarkdownFile(name: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
