// `megallm doctor` — runs every health check we know about and prints a
// digestible report.  Returns a non-zero exit code when any *critical* check
// fails, so it can plug into CI / shell scripts.
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { readAuth, resolveProfileName, maskApiKey } from '../auth/store.js';
import { fetchUserInfo } from '../auth/oauth.js';
import { checkToolsStatus } from '../detectors/tools.js';
import { getEnvironmentVariable } from '../utils/shell.js';
import { verifyClaudeConfig } from '../configurators/claude.js';
import { verifyCodexConfig }  from '../configurators/codex.js';
import { verifyOpenCodeConfig } from '../configurators/opencode.js';
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

export async function runDoctor({ profile } = {}) {
  const r = new Report();
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
      const u = await fetchUserInfo(auth.apiKey);
      r.ok(`Backend accepts the key`, `${u.email || u.name || 'identity confirmed'}`);
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

  // 6. Environment variables
  r.section('Environment');
  const envChecks = [
    { name: 'ANTHROPIC_BASE_URL', expected: MEGALLM_BASE_URL,  required: true },
    { name: 'ANTHROPIC_API_KEY',  startsWith: 'sk-mega-',       required: true },
    { name: 'MEGALLM_API_KEY',    startsWith: 'sk-mega-',       required: false },
  ];
  for (const e of envChecks) {
    const v = getEnvironmentVariable(e.name);
    if (!v) {
      if (e.required) r.warn(`${e.name} not set`, 'open a new shell or run `source ~/.zshrc`');
      else            console.log(chalk.gray(`  · ${e.name}: not set (optional)`));
      continue;
    }
    if (e.expected && v !== e.expected)        r.warn(`${e.name}=${v}`, `expected ${e.expected}`);
    else if (e.startsWith && !v.startsWith(e.startsWith)) r.warn(`${e.name}=${v.slice(0,12)}…`, `expected to start with ${e.startsWith}`);
    else                                       r.ok(`${e.name} is set`);
  }

  // 7. Summary
  console.log('');
  if (r.fails === 0 && r.warns === 0) {
    console.log(chalk.green.bold('Everything looks good. ✨'));
  } else {
    console.log(`${r.fails ? chalk.red.bold(`${r.fails} failure(s)`) : ''}` +
                `${r.fails && r.warns ? '  ' : ''}` +
                `${r.warns ? chalk.yellow.bold(`${r.warns} warning(s)`) : ''}`);
    if (r.fails > 0) process.exit(1);
  }
}
