// `megallm status` — plain-text snapshot of the current environment.
// Designed to be scriptable: every field is printed even when empty so that
// shell consumers can `grep` deterministically.
import chalk from 'chalk';
import { readAuth, resolveProfileName, maskApiKey } from '../auth/store.js';
import { fetchUserInfo } from '../auth/oauth.js';
import { checkToolsStatus } from '../detectors/tools.js';
import { MEGALLM_BASE_URL, MEGALLM_WEB_URL } from '../constants.js';

export async function runStatus({ profile } = {}) {
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);

  console.log(chalk.bold('MegaLLM CLI status'));
  console.log(chalk.gray('──────────────────'));
  console.log(`Profile           : ${chalk.white(name)}`);
  console.log(`Backend (API)     : ${chalk.gray(MEGALLM_BASE_URL)}`);
  console.log(`Backend (Web)     : ${chalk.gray(MEGALLM_WEB_URL)}`);

  if (!auth?.apiKey) {
    console.log(`Signed in         : ${chalk.yellow('no')}`);
    console.log(chalk.gray(`\nRun ${chalk.bold('megallm login')} to sign in.`));
  } else {
    let identity = null;
    try { identity = await fetchUserInfo(auth.apiKey); } catch { /* keep saved */ }
    const user = identity || auth.user || {};
    console.log(`Signed in         : ${chalk.green('yes')}`);
    console.log(`User              : ${chalk.white(user.name || user.email || '(unknown)')}`);
    console.log(`Email             : ${chalk.white(user.email || '—')}`);
    console.log(`Active org        : ${chalk.white(auth.orgName || auth.orgId || '(default)')}`);
    console.log(`API key           : ${chalk.white(maskApiKey(auth.apiKey))}`);
    console.log(`Scopes            : ${chalk.white((auth.scopes || []).join(', ') || '—')}`);
  }

  console.log('');
  console.log(chalk.bold('Detected tools'));
  console.log(chalk.gray('──────────────'));
  const t = checkToolsStatus();
  for (const [key, label] of [['claude', 'Claude Code'], ['codex', 'Codex'], ['opencode', 'OpenCode']]) {
    const info = t[key];
    const ok = !!info?.installed;
    const mark = ok ? chalk.green('✓') : chalk.gray('✗');
    const detail = ok ? (info.configPath || 'detected') : 'not installed';
    console.log(`${mark} ${label.padEnd(14)} ${chalk.gray(detail)}`);
  }
  console.log('');
}
