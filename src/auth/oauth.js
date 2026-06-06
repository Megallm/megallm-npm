// OAuth 2.0 device authorization grant (RFC 8628) client for the MegaLLM web app.
// Endpoints documented at <megallm.io>/dashboard/developers/docs.
import { exec } from 'child_process';
import http from 'http';
import crypto from 'crypto';
import {
  MEGALLM_WEB_URL,
  OAUTH_CLIENT_ID,
  OAUTH_SCOPES,
} from '../constants.js';

const DEVICE_CODE_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/device/code`;
const TOKEN_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/token`;
const USERINFO_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/userinfo`;
const REVOKE_ENDPOINT = `${MEGALLM_WEB_URL}/api/oauth/revoke`;
const AUTHORIZE_ENDPOINT = `${MEGALLM_WEB_URL}/oauth/authorize`;

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

// ── Authorization Code + PKCE via loopback redirect (RFC 8252 §7.3) ─────────
//
// Preferred login flow when a desktop browser is reachable. The CLI binds an
// ephemeral HTTP server on 127.0.0.1, opens the consent screen with a
// `redirect_uri` pointing at it, and exchanges the resulting auth code for
// an sk-mega key — no polling, instant handoff.

const PKCE_VERIFIER_BYTES = 32;       // → 43-char base64url string
const CALLBACK_PATH = '/cb';
const DEFAULT_LOOPBACK_TIMEOUT_MS = 5 * 60_000;

function base64url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(PKCE_VERIFIER_BYTES));
  const challenge = base64url(
    crypto.createHash('sha256').update(verifier).digest(),
  );
  return { verifier, challenge };
}

const SUCCESS_HTML = `<!doctype html><meta charset="utf-8"><title>MegaLLM CLI</title>
<style>body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{max-width:420px;text-align:center;padding:32px;border:1px solid #1f1f1f;border-radius:14px;background:#111}.ok{color:#4ade80;font-size:48px;margin-bottom:8px}h1{margin:0 0 8px;font-size:18px}p{margin:0;color:#a3a3a3;font-size:13px}</style>
<div class="card"><div class="ok">✓</div><h1>You're signed in.</h1><p>Return to your terminal — you can close this tab.</p></div>`;

const ERROR_HTML = (msg) => `<!doctype html><meta charset="utf-8"><title>MegaLLM CLI</title>
<style>body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{max-width:420px;text-align:center;padding:32px;border:1px solid #1f1f1f;border-radius:14px;background:#111}.bad{color:#f87171;font-size:48px;margin-bottom:8px}h1{margin:0 0 8px;font-size:18px}p{margin:0;color:#a3a3a3;font-size:13px}code{color:#e5e5e5}</style>
<div class="card"><div class="bad">✕</div><h1>Login failed</h1><p><code>${msg}</code></p><p style="margin-top:12px">You can close this tab and try again from the terminal.</p></div>`;

/**
 * Runs the full authorization-code + PKCE login flow over a loopback redirect.
 *
 * @param {{
 *   clientId?: string,
 *   scopes?: string[],
 *   timeoutMs?: number,
 *   signal?: AbortSignal,
 *   onAuthorizeUrl?: (url: string) => void,   // called once with the URL the
 *                                              // CLI is about to open in a
 *                                              // browser. Use this to print
 *                                              // the URL for the user.
 *   openBrowser?: boolean,                    // default true
 * }} opts
 * @returns {Promise<{ api_key: string, token_type: string, scopes: string[],
 *                     key_prefix: string }>}
 */
export async function loopbackLogin({
  clientId = OAUTH_CLIENT_ID,
  scopes = OAUTH_SCOPES,
  timeoutMs = DEFAULT_LOOPBACK_TIMEOUT_MS,
  signal,
  onAuthorizeUrl,
  openBrowser = true,
} = {}) {
  if (signal?.aborted) throw new Error('Login cancelled');

  const { verifier, challenge } = generatePkcePair();
  const state = base64url(crypto.randomBytes(16));

  // 1. Stand up the loopback callback server before we open the browser, so
  //    the redirect can never beat us.
  const { server, port, callback } = await startLoopbackServer({
    state,
    timeoutMs,
    signal,
  });
  const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;

  // 2. Open the consent screen.
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    scopes,
    redirectUri,
    state,
    challenge,
  });
  onAuthorizeUrl?.(authorizeUrl);
  if (openBrowser) openInBrowser(authorizeUrl);

  // 3. Wait for the redirect → grab the auth code.
  let code;
  try {
    code = await callback;
  } finally {
    server.close();
  }

  // 4. Exchange the code for an sk-mega key.
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Could not exchange auth code: ${msg}`);
  }
  return json;
}

function buildAuthorizeUrl({ clientId, scopes, redirectUri, state, challenge }) {
  const qs = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_ENDPOINT}?${qs.toString()}`;
}

/**
 * Start an HTTP server on 127.0.0.1:0 that resolves with the auth code on
 * the first matching `/cb?code=...&state=...` hit. Rejects on
 * `?error=...`, on state mismatch, on timeout, or on signal abort.
 */
function startLoopbackServer({ state, timeoutMs, signal }) {
  return new Promise((resolveOuter, rejectOuter) => {
    let timer;
    let onAbort;
    const callback = new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // Only handle the callback path; any other URL is a stray request.
        const u = new URL(req.url || '', 'http://127.0.0.1');
        if (u.pathname !== CALLBACK_PATH) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const params = u.searchParams;
        const gotState = params.get('state');
        const gotCode = params.get('code');
        const gotError = params.get('error');

        if (gotError) {
          const desc = params.get('error_description') || gotError;
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(ERROR_HTML(escapeHtml(desc)));
          reject(new Error(`Authorization failed: ${desc}`));
          return;
        }
        if (!gotCode) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(ERROR_HTML('Missing authorization code'));
          reject(new Error('Authorization callback missing `code`'));
          return;
        }
        if (gotState !== state) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(ERROR_HTML('State mismatch — possible CSRF'));
          reject(new Error('Authorization state mismatch (CSRF guard tripped)'));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(SUCCESS_HTML);
        resolve(gotCode);
      });

      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        timer = setTimeout(() => {
          reject(new Error('Login timed out. Please run `megallm login` again.'));
        }, timeoutMs);
        if (signal) {
          onAbort = () => reject(new Error('Login cancelled'));
          if (signal.aborted) onAbort();
          else signal.addEventListener('abort', onAbort, { once: true });
        }
        resolveOuter({ server, port, callback });
      });
    }).finally(() => {
      if (timer) clearTimeout(timer);
      if (onAbort && signal) signal.removeEventListener('abort', onAbort);
    });

    // If the server itself fails to listen, surface that on the outer promise
    // so the caller doesn't hang forever.
    callback.catch(rejectOuter);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Heuristic: is this environment likely to have a working desktop browser?
 * Used to decide between loopback (default) and device-code fallback.
 */
export function canUseLoopback() {
  if (process.env.MEGALLM_FORCE_DEVICE_FLOW === '1') return false;
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return false;
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return false;
  }
  return true;
}
