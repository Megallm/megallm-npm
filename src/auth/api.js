// Thin client over the bearer-key-authed endpoints in megallm-web-v2.
// Each function takes the user's sk-mega API key and returns parsed JSON.
import { MEGALLM_WEB_URL } from '../constants.js';

const USER_AGENT = `megallm-cli/${process.env.npm_package_version || '0.0.0'} (${process.platform})`;

async function callApi(apiKey, method, urlPath, { query, body } = {}) {
  const url = new URL(`${MEGALLM_WEB_URL}${urlPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': USER_AGENT,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.message || json.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

/** Orgs the authenticated user belongs to: [{ org_id, org_name, role? }] */
export async function listOrgs(apiKey) {
  const json = await callApi(apiKey, 'GET', '/api/oauth/orgs');
  return Array.isArray(json?.data) ? json.data : [];
}

/** API keys for a given org: { keys: [...] } (raw backend shape preserved). */
export async function listKeys(apiKey, orgId) {
  const json = await callApi(apiKey, 'GET', '/api/v1/keys', { query: { org: orgId } });
  return json?.data || json;
}

/**
 * Create a new API key under `orgId`. Returns the freshly-minted key.
 * Backend response is normalized to { api_key, api_key_id, key_prefix, ...rest }.
 */
export async function createKey(apiKey, { orgId, name, services, limits, expiresAt } = {}) {
  const json = await callApi(apiKey, 'POST', '/api/v1/keys', {
    body: {
      api_key_name: name,
      org_id: orgId,
      services,
      limits,
      expires_at: expiresAt,
    },
  });
  // Backend wraps payload in { success, data: {...} }; web-v2 forwards as-is.
  return json?.data || json;
}

/** Revoke an API key by its backend `api_key_id`. */
export async function revokeKey(apiKey, keyId) {
  await callApi(apiKey, 'DELETE', `/api/v1/keys/${encodeURIComponent(keyId)}`);
}
