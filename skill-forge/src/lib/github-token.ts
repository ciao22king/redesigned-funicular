import type { NextRequest } from 'next/server';

const GH = 'https://api.github.com';

/**
 * Autenticazione per la CLI.
 *
 * La CLI non puo' usare il cookie di sessione del browser, quindi manda un
 * token GitHub come `Authorization: Bearer <token>`. Qui lo leggiamo e lo
 * verifichiamo contro l'API di GitHub: l'identita' resta quella del
 * proprietario del token, mai quella dichiarata dal client.
 *
 * Un token viene verificato a ogni richiesta. Non e' un problema: la chiamata
 * e' autenticata, quindi consuma la quota GitHub dell'utente, non la nostra,
 * e un token non valido risponde 401 subito.
 */
export function readBearer(req: NextRequest): string | undefined {
  const header = req.headers.get('authorization');
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}

/** Restituisce il login GitHub del proprietario del token, o undefined se non valido. */
export async function loginForToken(token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GH}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // La CLI non manda User-Agent, quindi lo impostiamo esplicitamente:
        // senza, l'API GitHub rifiuta la richiesta.
        'User-Agent': 'skill-forge-cli',
      },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { login?: unknown };
    return typeof data.login === 'string' ? data.login : undefined;
  } catch {
    return undefined;
  }
}
