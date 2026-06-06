// Persistent credential store at ~/.megallm/. Profile-aware (AWS CLI style).
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  MEGALLM_HOME,
  MEGALLM_PROFILES_DIR,
  MEGALLM_CONFIG_FILE,
  DEFAULT_PROFILE,
} from '../constants.js';

/**
 * Resolve the active profile name in this order:
 *   1. explicit `--profile <name>` (caller passes it in)
 *   2. $MEGALLM_PROFILE
 *   3. config.json `current_profile`
 *   4. "default"
 */
export function resolveProfileName(explicit) {
  if (explicit && explicit.trim()) return explicit.trim();
  if (process.env.MEGALLM_PROFILE) return process.env.MEGALLM_PROFILE.trim();
  try {
    const cfg = fs.readJsonSync(MEGALLM_CONFIG_FILE);
    if (cfg?.current_profile) return cfg.current_profile;
  } catch {
    /* file missing — fall through */
  }
  return DEFAULT_PROFILE;
}

function profileDir(name) {
  return path.join(MEGALLM_PROFILES_DIR, name);
}

function authPath(name) {
  return path.join(profileDir(name), 'auth.json');
}

function statePath(name) {
  return path.join(profileDir(name), 'state.json');
}

export async function ensureMegallmHome() {
  await fs.ensureDir(MEGALLM_HOME);
  // Best-effort tighten perms on Unix; ignore on Windows.
  if (process.platform !== 'win32') {
    try { await fs.chmod(MEGALLM_HOME, 0o700); } catch { /* ignore */ }
  }
  await fs.ensureDir(MEGALLM_PROFILES_DIR);
}

export async function listProfiles() {
  try {
    const entries = await fs.readdir(MEGALLM_PROFILES_DIR);
    const out = [];
    for (const e of entries) {
      const ap = authPath(e);
      if (await fs.pathExists(ap)) out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Read the auth record for a profile. Returns null if missing or unreadable.
 *
 * Shape:
 *   {
 *     version: 1,
 *     apiKey: "sk-mega-...",
 *     keyPrefix: "sk-mega-abc...",
 *     scopes: ["api:use", "profile:read", ...],
 *     user: { sub, email, name, email_verified },
 *     orgId: "org_abc",
 *     orgName: "Acme",
 *     savedAt: "2026-...",
 *     clientId: "mega_pub_..."
 *   }
 */
export async function readAuth(profile = DEFAULT_PROFILE) {
  try {
    return await fs.readJson(authPath(profile));
  } catch {
    return null;
  }
}

export async function writeAuth(record, profile = DEFAULT_PROFILE) {
  await ensureMegallmHome();
  const dir = profileDir(profile);
  await fs.ensureDir(dir);
  const file = authPath(profile);
  await fs.writeJson(file, { version: 1, savedAt: new Date().toISOString(), ...record }, { spaces: 2 });
  if (process.platform !== 'win32') {
    try { await fs.chmod(file, 0o600); } catch { /* ignore */ }
    try { await fs.chmod(dir, 0o700); } catch { /* ignore */ }
  }
}

export async function deleteAuth(profile = DEFAULT_PROFILE) {
  try { await fs.remove(authPath(profile)); } catch { /* ignore */ }
  try { await fs.remove(statePath(profile)); } catch { /* ignore */ }
}

export async function readState(profile = DEFAULT_PROFILE) {
  try { return await fs.readJson(statePath(profile)); } catch { return {}; }
}

export async function writeState(state, profile = DEFAULT_PROFILE) {
  await ensureMegallmHome();
  await fs.ensureDir(profileDir(profile));
  await fs.writeJson(statePath(profile), state, { spaces: 2 });
}

export async function setCurrentProfile(name) {
  await ensureMegallmHome();
  let cfg = {};
  try { cfg = await fs.readJson(MEGALLM_CONFIG_FILE); } catch { /* new */ }
  cfg.current_profile = name;
  await fs.writeJson(MEGALLM_CONFIG_FILE, cfg, { spaces: 2 });
}

/** Mask all but the first 12 and last 4 chars for safe display. */
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 20) return key.slice(0, 6) + '…';
  return `${key.slice(0, 12)}…${key.slice(-4)}`;
}
