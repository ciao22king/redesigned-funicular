import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import {
  commitFile,
  createRepo,
  getUser,
  repoExists,
} from '@/lib/github';
import { readFrontmatterName, slugify } from '@/lib/skill';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  markdown: string;
  /** Nome del repository di destinazione. Se assente ne crea uno nuovo. */
  repo?: string;
  /** Percorso del file nel repo. Default: skills/<slug>.md */
  path?: string;
  isPrivate?: boolean;
  createIfMissing?: boolean;
}

export async function POST(req: NextRequest) {
  const { token } = await getServerAuth(req);

  if (!token) {
    return NextResponse.json({ error: 'Devi accedere con GitHub.' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido.' }, { status: 400 });
  }

  if (!body.markdown?.trim()) {
    return NextResponse.json({ error: 'Nessuna skill da pubblicare.' }, { status: 400 });
  }

  try {
    const user = await getUser(token);
    const owner = user.login;

    const skillName =
      readFrontmatterName(body.markdown) ?? 'skill-senza-nome';
    const slug = slugify(skillName);

    const repo = body.repo?.trim() || 'my-skills';
    const filePath = body.path?.trim() || `skills/${slug}.md`;

    const exists = await repoExists(token, owner, repo);
    if (!exists) {
      if (body.createIfMissing === false) {
        return NextResponse.json(
          { error: `Il repository ${owner}/${repo} non esiste.` },
          { status: 404 },
        );
      }
      await createRepo(
        token,
        repo,
        body.isPrivate ?? false,
        'Skill generate con Skill Forge',
      );
      // GitHub ha bisogno di un istante per inizializzare il branch
      await new Promise((r) => setTimeout(r, 1200));
    }

    const result = await commitFile(
      token,
      owner,
      repo,
      filePath,
      body.markdown,
      `feat(skill): aggiungi ${slug}`,
    );

    return NextResponse.json({
      ok: true,
      owner,
      repo,
      path: filePath,
      fileUrl: result.fileUrl,
      commitUrl: result.commitUrl,
      repoUrl: `https://github.com/${owner}/${repo}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: `Pubblicazione fallita: ${message}` }, { status: 502 });
  }
}
