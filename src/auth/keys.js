// Per-org key resolution shared between `megallm switch-org` and the
// `megallm setup` / `npx megallm` wizard.
//
// Behaviour:
//   1. If the local `auth.keysByOrg[orgId]` cache has an entry, ask the
//      backend if that key is still alive (matches by api_key_id, falling
//      back to key_prefix).
//   2. If alive → reuse it.
//   3. Otherwise → mint a fresh one via /api/v1/keys.
//
// Returns { apiKey, apiKeyId, keyPrefix, reused, keysByOrg } where
// `keysByOrg` is the updated cache the caller should persist.

import { listKeys, createKey } from './api.js';

async function verifyKeyAlive(authApiKey, orgId, cached) {
  try {
    const payload = await listKeys(authApiKey, orgId);
    const keys = payload?.keys || payload?.data || payload || [];
    if (!Array.isArray(keys) || keys.length === 0) return false;
    if (cached.api_key_id && keys.some(k => (k.api_key_id || k.id) === cached.api_key_id)) return true;
    if (cached.key_prefix && keys.some(k => (k.key_prefix || k.prefix) === cached.key_prefix)) return true;
    return false;
  } catch {
    return null; // network/auth failure — caller decides
  }
}

/**
 * @param {object} args
 * @param {object} args.auth     Current auth record (apiKey, orgId, keysByOrg, …)
 * @param {object} args.org      Target org { org_id, org_name }
 * @param {(msg: string) => void} [args.onProgress] Optional UI hook.
 * @returns {Promise<{ apiKey: string, apiKeyId: string|null, keyPrefix: string, reused: boolean, keysByOrg: object }>}
 */
export async function resolveKeyForOrg({ auth, org, onProgress }) {
  const cached = auth.keysByOrg?.[org.org_id];
  let apiKey, apiKeyId = null, keyPrefix, reused = false;

  if (cached?.api_key) {
    onProgress?.(`Checking saved key for ${org.org_name}…`);
    const alive = await verifyKeyAlive(auth.apiKey, org.org_id, cached);
    if (alive === true) {
      apiKey    = cached.api_key;
      apiKeyId  = cached.api_key_id || null;
      keyPrefix = cached.key_prefix || apiKey.slice(0, 16);
      reused = true;
    }
  }

  if (!apiKey) {
    onProgress?.(`Creating a new API key for ${org.org_name}…`);
    const minted = await createKey(auth.apiKey, {
      orgId: org.org_id,
      name: `MegaLLM CLI · ${new Date().toISOString().slice(0, 10)}`,
    });
    apiKey    = minted.api_key || minted.apiKey;
    apiKeyId  = minted.api_key_id || minted.apiKeyId || null;
    keyPrefix = minted.key_prefix || apiKey?.slice(0, 16);
    if (!apiKey) throw new Error('Server did not return an API key.');
  }

  // Lazy-stash the previous active org's key so users upgrading from older
  // CLIs get their existing key cached on the very first switch.
  const keysByOrg = { ...(auth.keysByOrg || {}) };
  if (auth.orgId && auth.apiKey && !keysByOrg[auth.orgId]) {
    keysByOrg[auth.orgId] = {
      api_key:    auth.apiKey,
      api_key_id: auth.apiKeyId || null,
      key_prefix: auth.keyPrefix || auth.apiKey.slice(0, 16),
      org_name:   auth.orgName || null,
      saved_at:   new Date().toISOString(),
    };
  }
  keysByOrg[org.org_id] = {
    api_key:    apiKey,
    api_key_id: apiKeyId,
    key_prefix: keyPrefix,
    org_name:   org.org_name,
    saved_at:   new Date().toISOString(),
  };

  return { apiKey, apiKeyId, keyPrefix, reused, keysByOrg };
}
