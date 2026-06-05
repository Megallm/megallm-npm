// OAuth 2.0 device authorization grant (RFC 8628) client for the MegaLLM web app.
// Endpoints documented at <megallm.io>/dashboard/developers/docs.
import { exec } from 'child_process';
import {
  MEGALLM_WEB_URL,
  OAUTH_CLIENT_ID,
  OAUTH_SCOPES,
} from '../constants.js';

const DEVICE_CODE_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/device/code`;
const TOKEN_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/token`;
const USERINFO_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/userinfo`;
const REVOKE_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/revoke`;

const USER_AGENT = `megallm-cli/${process.env.npm_package_version || '0.0.0'} (${process.platform})`;

/** Open `url` in the user's default browser (best-effort, never throws). */
export function openInBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32'  ? 'start ""' :
                                    'xdg-open';
  try {
    exec(`${cmd} "${url}"`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Step 1 — request a device code + user code.
 * Returns: { device_code, user_code, verification_uri, verification_uri_complete,
 *            expires_in, interval }
 */
export async function startDeviceFlow({
  clientId = OAUTH_CLIENT_ID,
  scopes = OAUTH_SCOPES,
} = {}) {
  const body = new URLSearchParams({
    client_id: clientId,
    scope: scopes.join(' '),
  });

  const res = await fetch(DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Could not start login flow: ${msg}`);
  }
  return json;
}

/**
 * Step 2 — poll the token endpoint until approved/denied/expired.
 * Honors the server-supplied `interval` and RFC 8628 `slow_down`.
 *
 * @param {{ device_code: string, interval: number, expires_in: number, clientId?: string,
 *           onTick?: (state: { secondsLeft: number }) => void,
 *           signal?: AbortSignal }} opts
 * Returns the token payload: { api_key, token_type, scopes, key_prefix }
 */
export async function pollForToken({
  device_code,
  interval,
  expires_in,
  clientId = OAUTH_CLIENT_ID,
  onTick,
  signal,
}) {
  const deadline = Date.now() + expires_in * 1000;
  let waitMs = Math.max(1, interval) * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Login cancelled');

    if (onTick) {
      onTick({ secondsLeft: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) });
    }

    await sleep(waitMs, signal);

    const body = new URLSearchParams({
      grant_type: 'device_code',
      device_code,
      client_id: clientId,
    });

    let res;
    try {
      res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: body.toString(),
        signal,
      });
    } catch (err) {
      // Network blip — keep trying within deadline.
      if (signal?.aborted) throw err;
      continue;
    }

    const json = await res.json().catch(() => ({}));

    if (res.ok) return json;

    const code = json.error;
    if (code === 'authorization_pending') {
      // Keep waiting at the current interval.
      continue;
    }
    if (code === 'slow_down') {
      waitMs += 5000;
      continue;
    }
    if (code === 'expired_token') {
      throw new Error('Login code expired. Please run `megallm login` again.');
    }
    if (code === 'access_denied') {
      throw new Error('Login was denied in the browser.');
    }
    // Anything else is a hard failure.
    throw new Error(json.error_description || code || `HTTP ${res.status}`);
  }
  throw new Error('Login timed out. Please run `megallm login` again.');
}

/** GET /api/oauth/userinfo — confirms a stored key still works + returns identity. */
export async function fetchUserInfo(apiKey) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    if (res.status === 401) return null; // key invalid/revoked
    const text = await res.text().catch(() => '');
    throw new Error(`userinfo failed: HTTP ${res.status} ${text}`);
  }
  return res.json();
}

/** App-initiated revoke — best-effort; we always wipe local state regardless. */
export async function revokeApiKey(apiKey, clientId = OAUTH_CLIENT_ID) {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        client_id: clientId,
        token: apiKey,
      }).toString(),
    });
  } catch {
    /* ignore */
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Login cancelled'));
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('Login cancelled'));
      }, { once: true });
    }
  });
}
