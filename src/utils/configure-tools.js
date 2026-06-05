// Shared tool-picker + apply step used by `megallm login` and `megallm
// switch-org`. Detects installed AI tools, asks the user which one(s) to
// (re)configure with a given API key (with an "All" + "Skip" choice), runs
// the configurators, and updates the relevant env vars.
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { configureClaude } from '../configurators/claude.js';
import { configureCodex } from '../configurators/codex.js';
import { configureOpenCode } from '../configurators/opencode.js';
import { checkToolsStatus } from '../detectors/tools.js';
import { setEnvironmentVariable } from './shell.js';
import { MEGALLM_BASE_URL } from '../constants.js';

/**
 * @param {string} apiKey  The MegaLLM API key to write into tool configs.
 * @param {object} [opts]
 * @param {string} [opts.message]    Prompt text shown to the user.
 * @param {boolean} [opts.updateEnv] When true (default) refresh the
 *   ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY / MEGALLM_API_KEY env vars after
 *   a successful configure.
 * @param {string}  [opts.skipHint]  Override the message printed when the
 *   user picks "Skip".
 * @returns {Promise<{ picked: string, results: Array<{ tool: string, ok: boolean, error?: string }> }>}
 *   `picked` is one of the installed tool keys / `'all'` / `'skip'`.
 */
export async function promptAndConfigureTools(apiKey, opts = {}) {
  const message = opts.message
    || 'Which tool would you like to configure with this key?';
  const updateEnv = opts.updateEnv !== false;

  const tools = checkToolsStatus();
  const installed = [];
  if (tools.claude?.installed)   installed.push({ key: 'claude',   label: 'Claude Code', fn: () => configureClaude(apiKey, 'system') });
  if (tools.codex?.installed)    installed.push({ key: 'codex',    label: 'Codex',       fn: () => configureCodex(apiKey, 'system') });
  if (tools.opencode?.installed) installed.push({ key: 'opencode', label: 'OpenCode',    fn: () => configureOpenCode(apiKey, 'system') });

  if (installed.length === 0) {
    console.log(chalk.gray('\nNo AI tools detected — nothing to configure.'));
    console.log(chalk.gray(`Run ${chalk.bold('megallm setup')} once you install Claude Code, Codex, or OpenCode.\n`));
    return { picked: 'skip', results: [] };
  }

  const choices = installed.map((t) => ({ name: t.label, value: t.key }));
  if (installed.length > 1) {
    choices.push({
      name: `All (${installed.map((t) => t.label).join(', ')})`,
      value: 'all',
    });
  }
  choices.push({ name: 'Skip — keep existing tool configs as-is', value: 'skip' });

  const picked = await select({
    message,
    choices,
    default: installed.length > 1 ? 'all' : installed[0].key,
  });

  if (picked === 'skip') {
    const hint = opts.skipHint
      || `Kept tool configs as-is. Run ${chalk.bold('megallm setup')} or ${chalk.bold('megallm link <tool>')} later to apply.`;
    console.log(chalk.gray('\n' + hint + '\n'));
    return { picked, results: [] };
  }

  const targets = picked === 'all' ? installed : installed.filter((t) => t.key === picked);
  console.log(chalk.cyan('\nUpdating tool configs…'));
  const settled = await Promise.allSettled(targets.map((t) => t.fn()));
  const results = settled.map((r, i) => {
    const target = targets[i];
    if (r.status === 'fulfilled' && r.value) {
      console.log(chalk.green(`  ✓ ${target.label}`));
      return { tool: target.key, ok: true };
    }
    if (r.status === 'fulfilled') {
      console.log(chalk.gray(`  • ${target.label} skipped`));
      return { tool: target.key, ok: false };
    }
    console.log(chalk.red(`  ✗ ${target.label}: ${r.reason?.message || 'failed'}`));
    return { tool: target.key, ok: false, error: r.reason?.message || 'failed' };
  });

  if (updateEnv) {
    setEnvironmentVariable('ANTHROPIC_BASE_URL', MEGALLM_BASE_URL, true);
    setEnvironmentVariable('ANTHROPIC_API_KEY', apiKey, true);
    setEnvironmentVariable('MEGALLM_API_KEY', apiKey, true);
  }

  return { picked, results };
}
