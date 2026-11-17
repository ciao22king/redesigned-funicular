/**
 * Device Flow di GitHub.
 *
 * The user sees a code, types it at github.com/login/device, authorizes, and the
 * CLI gets the token without anyone pasting it. The client ID is a public
 * identifier of the OAuth App (not a secret): the device flow does not use the
 * client secret, so it can live in the package.
 *
 * Riferimento: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

/** Client ID of the Skill Forge OAuth App. Public by definition. */
export const DEFAULT_CLIENT_ID = 'Ov23li3WNZ0SwllP72tP';

/** Minimal scope: read the profile. Nothing else is needed to use the API. */
export const DEFAULT_SCOPE = 'read:user';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  /** Seconds to wait between one attempt and the next. */
  interval: number;
}

export interface DeviceFlowOptions {
  clientId?: string;
  scope?: string;
  /** Injectable for tests: no network and no real wait. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Called when the code is ready, to show it to the user. */
  onPrompt?: (info: { userCode: string; verificationUri: string }) => void;
}

export interface PollOptions extends DeviceFlowOptions {
  /** Seconds of wait between attempts (comes from requestDeviceCode). */
  interval?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Asks GitHub for a code to show the user. */
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
    throw new Error(data.error_description ?? data.error ?? 'GitHub did not provide a device code.');
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
 * Waits for the user to authorize, then returns the token.
 *
 * GitHub answers `authorization_pending` until the user confirms, and
 * `slow_down` if we ask too often (in that case we lengthen the wait).
 * Any other error stops it.
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
        // GitHub asks us to slow down: we add 5 seconds, as the guide says.
        intervalMs += 5000;
        break;
      case 'expired_token':
        throw new Error('The code expired. Try again with `skill-forge login`.');
      case 'access_denied':
        throw new Error('Authorization denied.');
      default:
        throw new Error(data.error_description ?? data.error ?? 'Authorization failed.');
    }
  }
}

/** Full path: code, prompt to the user, wait for the token. */
export async function deviceFlowLogin(options: DeviceFlowOptions = {}): Promise<string> {
  const code = await requestDeviceCode(options);
  options.onPrompt?.({ userCode: code.user_code, verificationUri: code.verification_uri });
  return pollForToken(code.device_code, { ...options, interval: code.interval });
}
