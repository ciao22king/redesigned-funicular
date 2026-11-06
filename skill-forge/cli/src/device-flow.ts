/**
 * Device Flow di GitHub.
 *
 * L'utente vede un codice, lo digita su github.com/login/device, autorizza, e
 * la CLI ottiene il token senza che nessuno lo incolli. Il client ID e' un
 * identificatore pubblico della OAuth App (non un segreto): il device flow non
 * usa il client secret, quindi puo' stare nel pacchetto.
 *
 * Riferimento: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

/** Client ID della OAuth App di Skill Forge. Pubblico per definizione. */
export const DEFAULT_CLIENT_ID = 'Ov23li3WNZ0SwllP72tP';

/** Scope minimo: leggere il profilo. Non serve altro per usare l'API. */
export const DEFAULT_SCOPE = 'read:user';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  /** Secondi da attendere tra un tentativo e l'altro. */
  interval: number;
}

export interface DeviceFlowOptions {
  clientId?: string;
  scope?: string;
  /** Iniettabili per i test: nessuna rete e nessuna attesa reale. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Chiamata quando il codice e' pronto, per mostrarlo all'utente. */
  onPrompt?: (info: { userCode: string; verificationUri: string }) => void;
}

export interface PollOptions extends DeviceFlowOptions {
  /** Secondi di attesa tra i tentativi (arriva da requestDeviceCode). */
  interval?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Chiede a GitHub un codice da mostrare all'utente. */
export async function requestDeviceCode(options: DeviceFlowOptions = {}): Promise<DeviceCode> {
  const clientId = options.clientId ?? process.env.SKILL_FORGE_GITHUB_CLIENT_ID ?? DEFAULT_CLIENT_ID;
  const doFetch = options.fetchImpl ?? fetch;

  const res = await doFetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: options.scope ?? DEFAULT_SCOPE }),
  });

  const data = (await res.json()) as Partial<DeviceCode> & { error?: string; error_description?: string };
  if (!res.ok || data.error || !data.device_code) {
    throw new Error(data.error_description ?? data.error ?? 'GitHub non ha fornito un codice dispositivo.');
  }
  return {
    device_code: data.device_code,
    user_code: data.user_code ?? '',
    verification_uri: data.verification_uri ?? 'https://github.com/login/device',
    expires_in: data.expires_in ?? 900,
    interval: data.interval ?? 5,
  };
}

/**
 * Attende che l'utente autorizzi, poi restituisce il token.
 *
 * GitHub risponde `authorization_pending` finche' l'utente non conferma, e
 * `slow_down` se chiediamo troppo spesso (in quel caso allunghiamo l'attesa).
 * Ogni altro errore interrompe.
 */
export async function pollForToken(
  deviceCode: string,
  options: PollOptions = {},
): Promise<string> {
  const clientId = options.clientId ?? process.env.SKILL_FORGE_GITHUB_CLIENT_ID ?? DEFAULT_CLIENT_ID;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  let intervalMs = Math.max(1, options.interval ?? 5) * 1000;

  for (;;) {
    await sleep(intervalMs);

    const res = await doFetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.access_token) return data.access_token;

    switch (data.error) {
      case 'authorization_pending':
        break;
      case 'slow_down':
        // GitHub chiede di rallentare: aggiungiamo 5 secondi, come da guida.
        intervalMs += 5000;
        break;
      case 'expired_token':
        throw new Error('Il codice e\' scaduto. Riprova con `skill-forge login`.');
      case 'access_denied':
        throw new Error('Autorizzazione negata.');
      default:
        throw new Error(data.error_description ?? data.error ?? 'Autorizzazione non riuscita.');
    }
  }
}

/** Percorso completo: codice, prompt all'utente, attesa del token. */
export async function deviceFlowLogin(options: DeviceFlowOptions = {}): Promise<string> {
  const code = await requestDeviceCode(options);
  options.onPrompt?.({ userCode: code.user_code, verificationUri: code.verification_uri });
  return pollForToken(code.device_code, { ...options, interval: code.interval });
}
