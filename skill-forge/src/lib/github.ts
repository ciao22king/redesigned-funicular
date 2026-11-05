const GH = 'https://api.github.com';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export async function getUser(token: string) {
  const res = await fetch(`${GH}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub /user ha risposto ${res.status}`);
  return res.json() as Promise<{ login: string; name: string | null; avatar_url: string }>;
}

export async function repoExists(token: string, owner: string, repo: string) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}`, { headers: headers(token) });
  return res.status === 200;
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean,
  description: string,
) {
  const res = await fetch(`${GH}/user/repos`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      name,
      private: isPrivate,
      description,
      auto_init: true, // serve un branch iniziale per poter committare
    }),
  });
  if (!res.ok && res.status !== 422) {
    // 422 = esiste già, va bene, lo usiamo
    throw new Error(`Creazione repo fallita: ${res.status} ${await res.text()}`);
  }
  return res.json().catch(() => ({ name }));
}

/** Recupera lo SHA del file, se esiste. Serve per aggiornare invece di creare. */
async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | undefined> {
  const res = await fetch(
    `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers: headers(token) },
  );
  if (res.status !== 200) return undefined;
  const data = (await res.json()) as { sha?: string };
  return data.sha;
}

/**
 * Committa (crea o aggiorna) un file. Usa l'API Contents, che va bene
 * per file di testo di queste dimensioni.
 */
export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch = 'main',
) {
  const sha = await getFileSha(token, owner, repo, path, branch);

  const res = await fetch(
    `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Commit fallito: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    content?: { html_url?: string };
    commit?: { html_url?: string };
  };

  return {
    fileUrl: data.content?.html_url,
    commitUrl: data.commit?.html_url,
  };
}
