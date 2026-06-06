// `megallm doctor` — runs every health check we know about and prints a
// digestible report.  Returns a non-zero exit code when any *critical* check
// fails, so it can plug into CI / shell scripts.
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { readAuth, resolveProfileName, maskApiKey } from '../auth/store.js';
import { fetchUserInfo } from '../auth/oauth.js';
import { checkToolsStatus } from '../detectors/tools.js';
import { getEnvironmentVariable, setEnvironmentVariable, readPersistedEnvVar } from '../utils/shell.js';
import { verifyClaudeConfig } from '../configurators/claude.js';
import { verifyCodexConfig }  from '../configurators/codex.js';
import { verifyOpenCodeConfig } from '../configurators/opencode.js';
import { readJsonFile, readTomlFile } from '../utils/files.js';
import { MEGALLM_HOME, MEGALLM_BASE_URL } from '../constants.js';

const PASS = chalk.green('✓');
const WARN = chalk.yellow('!');
const FAIL = chalk.red('✗');

class Report {
  constructor() { this.fails = 0; this.warns = 0; }
  ok(msg, hint)   { console.log(`  ${PASS} ${msg}${hint ? chalk.gray('  — ' + hint) : ''}`); }
  warn(msg, hint) { this.warns++; console.log(`  ${WARN} ${msg}${hint ? chalk.gray('  — ' + hint) : ''}`); }
  fail(msg, hint) { this.fails++; console.log(`  ${FAIL} ${msg}${hint ? chalk.gray('  — ' + hint) : ''}`); }
  section(title)  { console.log(''); console.log(chalk.bold(title)); console.log(chalk.gray('─'.repeat(title.length))); }
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// Pull the API key each tool would actually send to the backend at runtime.
// Returns null when the tool has no resolvable key (config missing, env unset,
// or the config doesn't reference a MegaLLM key).
async function readToolApiKey(tool, configPath) {
  try {
    if (tool === 'claude') {
      if (!configPath) return null;
      const cfg = await readJsonFile(configPath);
      const k = cfg?.env?.ANTHROPIC_API_KEY;
      return k && typeof k === 'string' ? k : null;
    }
    if (tool === 'codex') {
      if (!configPath) return null;
      const cfg = await readTomlFile(configPath);
      const envKey = cfg?.model_providers?.megallm?.env_key || 'MEGALLM_API_KEY';
      // Prefer the live shell value; fall back to the rc file so a tool
      // configured in a previous shell still gets validated.
      return getEnvironmentVariable(envKey) || readPersistedEnvVar(envKey);
    }
    if (tool === 'opencode') {
      if (!configPath) return null;
      const cfg = await readJsonFile(configPath);
      const ref = cfg?.provider?.anthropic?.options?.apiKey;
      const m = typeof ref === 'string' ? ref.match(/^\{env:([A-Z0-9_]+)\}$/) : null;
      const envName = m ? m[1] : 'MEGALLM_API_KEY';
      return getEnvironmentVariable(envName) || readPersistedEnvVar(envName);
    }
  } catch {
    return null;
  }
  return null;
}

// Probe a key against /userinfo. Caches results so the same key is only hit once.
//   active : key works, returns the identity payload
//   revoked: backend returned 401 (key invalid / revoked / rotated)
//   error  : transient / network / unexpected
function makeKeyProber() {
  const cache = new Map();
  return async function probe(apiKey) {
    if (!apiKey) return { status: 'missing' };
    if (cache.has(apiKey)) return cache.get(apiKey);
    let result;
    try {
      const info = await fetchUserInfo(apiKey);
      result = info ? { status: 'active', info } : { status: 'revoked' };
    } catch (err) {
      result = { status: 'error', message: err.message };
    }
    cache.set(apiKey, result);
    return result;
  };
}

export async function runDoctor({ profile } = {}) {
  const r = new Report();
  const probeKey = makeKeyProber();
  console.log(chalk.bold.cyan('MegaLLM doctor\n'));

  // 1. Runtime
  r.section('Runtime');
  const nodeVer = process.versions.node;
  if (compareSemver(nodeVer, '18.0.0') >= 0) r.ok(`Node.js ${nodeVer}`);
  else r.fail(`Node.js ${nodeVer}`, 'Ink requires Node 18+');

  // 2. ~/.megallm directory + perms
  r.section('Local store');
  if (await fs.pathExists(MEGALLM_HOME)) {
    r.ok(`${MEGALLM_HOME} exists`);
    if (process.platform !== 'win32') {
      try {
        const st = await fs.stat(MEGALLM_HOME);
        const mode = (st.mode & 0o777).toString(8);
        if (mode === '700') r.ok(`Permissions are 0700`);
        else r.warn(`Permissions are 0${mode}`, 'expected 0700');
      } catch { /* ignore */ }
    }
  } else {
    r.warn(`${MEGALLM_HOME} missing`, 'created automatically on first login');
  }

  // 3. Profile + identity
  r.section('Identity');
  const name = resolveProfileName(profile);
  console.log(`  Profile: ${chalk.white(name)}`);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    r.fail('Not signed in', 'run `megallm login`');
  } else {
    r.ok(`Saved key ${maskApiKey(auth.apiKey)}`);
    if (process.platform !== 'win32') {
      try {
        const st = await fs.stat(path.join(MEGALLM_HOME, 'profiles', name, 'auth.json'));
        const mode = (st.mode & 0o777).toString(8);
        if (mode === '600') r.ok('auth.json permissions are 0600');
        else r.warn(`auth.json permissions are 0${mode}`, 'expected 0600');
      } catch { /* ignore */ }
    }
    try {
      const probed = await probeKey(auth.apiKey);
      if (probed.status === 'active') {
        const u = probed.info;
        r.ok(`Backend accepts the key`, `${u.email || u.name || 'identity confirmed'}`);
      } else if (probed.status === 'revoked') {
        r.fail(`Backend rejected the key`, 'key was revoked or rotated — run `megallm login`');
      } else {
        r.fail(`Backend rejected the key`, probed.message || 'unknown error');
      }
    } catch (err) {
      r.fail(`Backend rejected the key`, err.message);
    }
    const requiredScopes = ['api:use', 'profile:read', 'keys:read', 'keys:manage'];
    const have = new Set(auth.scopes || []);
    const missing = requiredScopes.filter(s => !have.has(s));
    if (missing.length === 0) r.ok(`Scopes: ${requiredScopes.join(', ')}`);
    else r.warn(`Missing scopes: ${missing.join(', ')}`, 're-run `megallm login` after enabling them in the OAuth app');
  }

  // 4. Tools — installed?
  r.section('Tools — installation');
  const t = checkToolsStatus();
  for (const [key, label] of [['claude','Claude Code'],['codex','Codex'],['opencode','OpenCode']]) {
    const i = t[key];
    if (i?.installed) r.ok(`${label}`, i.configPath || i.path || 'detected');
    else              r.warn(`${label} not installed`, 'install it then run `megallm setup`');
  }

  // 5. Tools — config validity
  r.section('Tools — MegaLLM wiring');
  const verifiers = [
    { key: 'claude',   label: 'Claude Code', verify: verifyClaudeConfig,   info: t.claude   },
    { key: 'codex',    label: 'Codex',       verify: verifyCodexConfig,    info: t.codex    },
    { key: 'opencode', label: 'OpenCode',    verify: verifyOpenCodeConfig, info: t.opencode },
  ];
  for (const v of verifiers) {
    if (!v.info?.installed) { console.log(chalk.gray(`  · ${v.label}: skipped (not installed)`)); continue; }
    if (!v.info.configPath) { r.warn(`${v.label}: no config file`); continue; }
    try {
      const result = await v.verify(v.info.configPath);
      if (result.valid) {
        r.ok(`${v.label} configured for MegaLLM`);
      } else if (result.details && result.details.apiKeySet === false
                 && result.details.baseUrl !== false
                 && result.details.megallmConfig !== false
                 && result.details.envKey !== false
                 && result.details.apiKeyRef !== false) {
        // Config file is correct; only the runtime env var is unset, which
        // the Environment section reports separately.
        r.ok(`${v.label} configured for MegaLLM`);
      } else {
        r.fail(`${v.label} not configured for MegaLLM`, result.error || 'config check failed');
      }
    } catch (err) {
      r.fail(`${v.label}: ${err.message}`);
    }
  }

  // 6. Tools — API key health (probe each tool's key against /userinfo)
  r.section('Tools — API key health');
  const toolKeyChecks = [
    { key: 'claude',   label: 'Claude Code', info: t.claude,   keySource: 'config file',         hint: 'run `megallm doctor fix` to reconfigure ~/.claude/settings.json with the active key' },
    { key: 'codex',    label: 'Codex',       info: t.codex,    keySource: 'MEGALLM_API_KEY env', hint: 'run `megallm doctor fix` to refresh MEGALLM_API_KEY in your shell rc' },
    { key: 'opencode', label: 'OpenCode',    info: t.opencode, keySource: 'MEGALLM_API_KEY env', hint: 'run `megallm doctor fix` to refresh MEGALLM_API_KEY in your shell rc' },
  ];
  for (const c of toolKeyChecks) {
    if (!c.info?.installed) { console.log(chalk.gray(`  · ${c.label}: skipped (not installed)`)); continue; }
    const toolKey = await readToolApiKey(c.key, c.info.configPath);
    if (!toolKey) {
      console.log(chalk.gray(`  · ${c.label}: skipped (no key in ${c.keySource})`));
      continue;
    }
    const probed = await probeKey(toolKey);
    const masked = maskApiKey(toolKey);
    if (probed.status === 'active') {
      const ident = probed.info?.email || probed.info?.name || 'active';
      if (auth?.apiKey && toolKey !== auth.apiKey) {
        r.warn(`${c.label} key ${masked} is active but does not match profile key`,
               'tool is on an older key — run `megallm doctor fix` to align them');
      } else {
        r.ok(`${c.label} key ${masked} is active`, ident);
      }
    } else if (probed.status === 'revoked') {
      r.fail(`${c.label} key ${masked} is revoked`, c.hint);
    } else {
      r.warn(`${c.label} key ${masked}: could not verify`, probed.message || 'network error');
    }
  }

  // 7. Environment variables
  r.section('Environment');
  const envChecks = [
    { name: 'ANTHROPIC_BASE_URL', expected: MEGALLM_BASE_URL,  required: true },
    { name: 'ANTHROPIC_API_KEY',  startsWith: 'sk-mega-',       required: true },
    { name: 'MEGALLM_API_KEY',    startsWith: 'sk-mega-',       required: false },
  ];
  for (const e of envChecks) {
    const live = getEnvironmentVariable(e.name);
    const persisted = readPersistedEnvVar(e.name);
    const v = live || persisted;
    const onlyPersisted = !live && !!persisted;

    if (!v) {
      if (e.required) r.warn(`${e.name} not set`, 'run `megallm doctor fix` to write it to your shell rc');
      else            console.log(chalk.gray(`  · ${e.name}: not set (optional)`));
      continue;
    }
    if (e.expected && v !== e.expected) {
      r.warn(`${e.name}=${v}`, `expected ${e.expected}`);
    } else if (e.startsWith && !v.startsWith(e.startsWith)) {
      r.warn(`${e.name}=${v.slice(0,12)}…`, `expected to start with ${e.startsWith}`);
    } else if (onlyPersisted) {
      r.ok(`${e.name} persisted in shell rc`, 'open a new shell or `source ~/.zshrc` to load it');
    } else {
      r.ok(`${e.name} is set`);
    }
  }

  // 8. Summary
  console.log('');
  if (r.fails === 0 && r.warns === 0) {
    console.log(chalk.green.bold('Everything looks good. ✨'));
  } else {
    console.log(`${r.fails ? chalk.red.bold(`${r.fails} failure(s)`) : ''}` +
                `${r.fails && r.warns ? '  ' : ''}` +
                `${r.warns ? chalk.yellow.bold(`${r.warns} warning(s)`) : ''}`);
    if (r.fails > 0) {
      console.log(chalk.gray('\nTip: many of these can be auto-repaired with `megallm doctor fix`.'));
      process.exit(1);
    }
  }
}

// ── doctor fix ─────────────────────────────────────────────────────────────
//
// Auto-remediates the most common breakages doctor reports:
//   • Tool config holds a revoked / stale key  → re-run the tool's
//     configurator with the active profile key.
//   • MEGALLM_API_KEY / ANTHROPIC_API_KEY in the shell rc are missing or
//     stale → rewrite them via setEnvironmentVariable so a fresh shell
//     picks them up.
//
// Anything that needs human input (signing in, picking an org, installing a
// missing tool) is intentionally *not* attempted here — `fix` only repairs
// state derived from the saved profile.

export async function runDoctorFix({ profile } = {}) {
  console.log(chalk.bold.cyan('MegaLLM doctor — fix\n'));

  const probeKey = makeKeyProber();
  const profileName = resolveProfileName(profile);
  const auth = await readAuth(profileName);

  if (!auth?.apiKey) {
    console.log(`  ${FAIL} No saved credentials for profile ${chalk.white(profileName)}`);
    console.log(chalk.gray('    Run `megallm login` first, then re-run `megallm doctor fix`.'));
    process.exit(1);
  }

  // The profile key itself must be alive — we can't push a dead key into the
  // tools and call that "fixed".
  const probed = await probeKey(auth.apiKey);
  if (probed.status === 'revoked') {
    console.log(`  ${FAIL} Saved profile key ${maskApiKey(auth.apiKey)} is revoked`);
    console.log(chalk.gray('    Run `megallm login` to mint a new key, then re-run `megallm doctor fix`.'));
    process.exit(1);
  }
  if (probed.status === 'error') {
    console.log(`  ${FAIL} Could not reach the backend to verify the saved key`);
    console.log(chalk.gray(`    ${probed.message}`));
    process.exit(1);
  }
  console.log(`  ${PASS} Profile ${chalk.white(profileName)} → ${probed.info?.email || 'identity confirmed'} (${maskApiKey(auth.apiKey)})\n`);

  const t = checkToolsStatus();
  const tasks = [
    { key: 'claude',   label: 'Claude Code', info: t.claude,
      configure: async (k) => {
        const { configureClaude } = await import('../configurators/claude.js');
        return configureClaude(k, 'system');
      },
      // Claude embeds the key inline in settings.json *and* honors
      // ANTHROPIC_API_KEY in the shell — keep them aligned.
      envVars: [
        { name: 'ANTHROPIC_BASE_URL', value: MEGALLM_BASE_URL },
        { name: 'ANTHROPIC_API_KEY',  value: auth.apiKey },
      ],
    },
    { key: 'codex',    label: 'Codex',       info: t.codex,
      configure: async (k) => {
        const { configureCodex } = await import('../configurators/codex.js');
        return configureCodex(k, 'system');
      },
      envVars: [{ name: 'MEGALLM_API_KEY', value: auth.apiKey }],
    },
    { key: 'opencode', label: 'OpenCode',    info: t.opencode,
      configure: async (k) => {
        const { configureOpenCode } = await import('../configurators/opencode.js');
        return configureOpenCode(k, 'system');
      },
      envVars: [{ name: 'MEGALLM_API_KEY', value: auth.apiKey }],
    },
  ];

  let repaired = 0;
  let alreadyOk = 0;
  let failed = 0;
  let envWritten = 0;
  const touchedEnv = new Set();

  for (const task of tasks) {
    if (!task.info?.installed) {
      console.log(chalk.gray(`  · ${task.label}: skipped (not installed)`));
      continue;
    }

    const currentKey = await readToolApiKey(task.key, task.info.configPath);
    let needsConfigure = false;
    let reason = '';

    if (!currentKey) {
      needsConfigure = true;
      reason = 'no key resolved';
    } else if (currentKey !== auth.apiKey) {
      const cur = await probeKey(currentKey);
      if (cur.status === 'revoked')      { needsConfigure = true; reason = 'current key is revoked'; }
      else if (cur.status === 'active')  { needsConfigure = true; reason = 'current key does not match profile'; }
      else                               { needsConfigure = true; reason = `could not verify current key (${cur.message || 'unknown'})`; }
    }

    if (!needsConfigure) {
      console.log(`  ${PASS} ${task.label} already on the active profile key`);
      alreadyOk++;
    } else {
      console.log(chalk.cyan(`  → ${task.label}: ${reason} — reconfiguring...`));
      try {
        const ok = await task.configure(auth.apiKey);
        if (ok) {
          console.log(`  ${PASS} ${task.label} reconfigured`);
          repaired++;
        } else {
          console.log(`  ${FAIL} ${task.label} configurator returned a failure`);
          failed++;
        }
      } catch (err) {
        console.log(`  ${FAIL} ${task.label} reconfiguration threw: ${err.message}`);
        failed++;
      }
    }

    // Always make sure the env vars this tool relies on are in place — even
    // when the tool's config file already had the right key, the shell rc
    // can still be missing the export. Compare against the persisted rc
    // value so a re-run doesn't keep rewriting the same line.
    for (const ev of task.envVars) {
      if (touchedEnv.has(ev.name)) continue;
      const persisted = readPersistedEnvVar(ev.name);
      if (persisted === ev.value) {
        touchedEnv.add(ev.name);
        continue;
      }
      const wrote = setEnvironmentVariable(ev.name, ev.value, true);
      if (wrote) {
        console.log(`  ${PASS} ${ev.name} written to shell rc`);
        envWritten++;
        touchedEnv.add(ev.name);
      } else {
        console.log(`  ${FAIL} could not write ${ev.name} to shell rc`);
        failed++;
      }
    }
  }

  // Summary
  console.log('');
  const parts = [];
  if (repaired)   parts.push(chalk.green.bold(`${repaired} repaired`));
  if (envWritten) parts.push(chalk.green(`${envWritten} env var(s) written`));
  if (alreadyOk)  parts.push(chalk.gray(`${alreadyOk} already healthy`));
  if (failed)     parts.push(chalk.red.bold(`${failed} failed`));
  console.log(parts.length ? parts.join('  ·  ') : chalk.gray('Nothing to do.'));

  if (envWritten > 0) {
    console.log(chalk.yellow('\n⚠ Open a new shell (or `source ~/.zshrc`) so the env vars take effect for tools that read them at startup.'));
  }
  if (failed > 0) process.exit(1);
}
