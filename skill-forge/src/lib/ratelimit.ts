import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Limite giornaliero di generazioni per utente, contato su Cloudflare KV.
 *
 * La chiave e' il login GitHub, quindi il limite segue la persona e non
 * l'indirizzo IP: cambiare rete o dispositivo non azzera la quota.
 *
 * La finestra e' il giorno UTC, non 24 ore scorrevoli: la chiave contiene la
 * data e scade a fine giornata, quindi la quota torna piena a mezzanotte UTC.
 */

export const DAILY_LIMIT = 3;

export interface Quota {
  used: number;
  remaining: number;
  limit: number;
  /** ISO: quando il contatore scade e la quota torna piena. */
  resetsAt: string;
}

interface Counter {
  count: number;
}

/** Chiave e scadenza del giorno UTC corrente. */
export function dayKey(date = new Date()): { key: string; resetsAt: string } {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const next = start + 24 * 60 * 60 * 1000;
  return {
    key: new Date(start).toISOString().slice(0, 10),
    resetsAt: new Date(next).toISOString(),
  };
}

async function store(): Promise<KVNamespace | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.RATE_LIMIT;
  } catch {
    // In `next dev` senza binding il limite non e' applicabile: non blocchiamo
    // lo sviluppo locale, ma in produzione il binding c'e' sempre.
    return undefined;
  }
}

/** Legge la quota senza consumarla. */
export async function readQuota(login: string, kv?: KVNamespace): Promise<Quota> {
  const { key, resetsAt } = dayKey();
  const ns = kv ?? (await store());
  const used = ns ? Number((await ns.get<Counter>(`rl:${login}:${key}`, 'json'))?.count ?? 0) : 0;
  return { used, remaining: Math.max(0, DAILY_LIMIT - used), limit: DAILY_LIMIT, resetsAt };
}

/**
 * Consuma una generazione se disponibile.
 * Restituisce `allowed: false` con la quota invariata quando il limite e' raggiunto.
 */
export async function consumeQuota(
  login: string,
  kv?: KVNamespace,
): Promise<{ allowed: boolean; quota: Quota }> {
  const { key, resetsAt } = dayKey();
  const ns = kv ?? (await store());

  if (!ns) {
    return {
      allowed: true,
      quota: { used: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT, resetsAt },
    };
  }

  const storageKey = `rl:${login}:${key}`;
  const current = Number((await ns.get<Counter>(storageKey, 'json'))?.count ?? 0);

  if (current >= DAILY_LIMIT) {
    return {
      allowed: false,
      quota: { used: current, remaining: 0, limit: DAILY_LIMIT, resetsAt },
    };
  }

  const count = current + 1;
  // TTL di 48 ore: copre sempre la giornata UTC in corso con margine, cosi' un
  // contatore scritto poco prima di mezzanotte non scade in anticipo.
  await ns.put(storageKey, JSON.stringify({ count }), { expirationTtl: 60 * 60 * 48 });

  return {
    allowed: true,
    quota: { used: count, remaining: Math.max(0, DAILY_LIMIT - count), limit: DAILY_LIMIT, resetsAt },
  };
}
