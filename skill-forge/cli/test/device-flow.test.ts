import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { requestDeviceCode, pollForToken, deviceFlowLogin } from '../src/device-flow.js';

/**
 * Il Device Flow si prova con `fetch` e `sleep` finti: la sequenza reale
 * (pending -> pending -> token) viene esercitata senza rete e senza attese.
 */

/** fetch che risponde in sequenza con le risposte fornite. */
function sequenceFetch(responses: { status?: number; body: unknown }[], capture?: { bodies: string[] }) {
  let i = 0;
  return (async (_url: string | URL, init?: RequestInit) => {
    capture?.bodies.push(String(init?.body ?? ''));
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

const noSleep = async () => {};

describe('device flow', () => {
  test('requestDeviceCode legge il codice e i parametri', async () => {
    const fetchImpl = sequenceFetch([
      { body: { device_code: 'DC', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
    ]);
    const code = await requestDeviceCode({ fetchImpl });
    assert.equal(code.device_code, 'DC');
    assert.equal(code.user_code, 'ABCD-1234');
    assert.equal(code.interval, 5);
  });

  test('requestDeviceCode segnala un errore di GitHub', async () => {
    const fetchImpl = sequenceFetch([
      { status: 400, body: { error: 'device_flow_disabled', error_description: 'Device Flow must be explicitly enabled' } },
    ]);
    await assert.rejects(() => requestDeviceCode({ fetchImpl }), /Device Flow must be explicitly enabled/);
  });

  test('pollForToken attende finche\' arriva il token', async () => {
    const fetchImpl = sequenceFetch([
      { body: { error: 'authorization_pending' } },
      { body: { error: 'authorization_pending' } },
      { body: { access_token: 'gho_abc' } },
    ]);
    const token = await pollForToken('DC', { fetchImpl, sleep: noSleep, interval: 0 });
    assert.equal(token, 'gho_abc');
  });

  test('pollForToken allunga l\'attesa su slow_down e poi riesce', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number) => {
      sleeps.push(ms);
    };
    const fetchImpl = sequenceFetch([
      { body: { error: 'slow_down' } },
      { body: { access_token: 'gho_ok' } },
    ]);
    const token = await pollForToken('DC', { fetchImpl, sleep, interval: 1 });
    assert.equal(token, 'gho_ok');
    // Primo giro 1000 ms, poi +5000 per slow_down.
    assert.deepEqual(sleeps, [1000, 6000]);
  });

  test('pollForToken interrompe su codice scaduto', async () => {
    const fetchImpl = sequenceFetch([{ body: { error: 'expired_token' } }]);
    await assert.rejects(() => pollForToken('DC', { fetchImpl, sleep: noSleep, interval: 0 }), /scaduto/);
  });

  test('pollForToken interrompe su autorizzazione negata', async () => {
    const fetchImpl = sequenceFetch([{ body: { error: 'access_denied' } }]);
    await assert.rejects(() => pollForToken('DC', { fetchImpl, sleep: noSleep, interval: 0 }), /negata/);
  });

  test('deviceFlowLogin chiama onPrompt col codice utente', async () => {
    const fetchImpl = sequenceFetch([
      { body: { device_code: 'DC', user_code: 'WXYZ-9876', verification_uri: 'https://github.com/login/device', interval: 0, expires_in: 900 } },
      { body: { access_token: 'gho_final' } },
    ]);
    let seen = '';
    const token = await deviceFlowLogin({
      fetchImpl,
      sleep: noSleep,
      onPrompt: ({ userCode }) => {
        seen = userCode;
      },
    });
    assert.equal(seen, 'WXYZ-9876');
    assert.equal(token, 'gho_final');
  });

  test('manda il client_id e il grant_type corretti', async () => {
    const capture = { bodies: [] as string[] };
    const fetchImpl = sequenceFetch(
      [
        { body: { device_code: 'DC', user_code: 'A', verification_uri: 'u', interval: 0, expires_in: 900 } },
        { body: { access_token: 't' } },
      ],
      capture,
    );
    await deviceFlowLogin({ fetchImpl, sleep: noSleep, clientId: 'CLIENT123' });
    const first = JSON.parse(capture.bodies[0]);
    assert.equal(first.client_id, 'CLIENT123');
    assert.equal(first.scope, 'read:user');
    const second = JSON.parse(capture.bodies[1]);
    assert.equal(second.device_code, 'DC');
    assert.equal(second.grant_type, 'urn:ietf:params:oauth:grant-type:device_code');
  });
});
