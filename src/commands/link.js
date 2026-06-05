// `megallm link <tool>` and `megallm unlink <tool>` — wire or unwire a single
// tool's config without running the full setup wizard.
import chalk from 'chalk';
import { readAuth, resolveProfileName } from '../auth/store.js';
import { configureClaude, unconfigureClaude } from '../configurators/claude.js';
import { configureCodex, unconfigureCodex }     from '../configurators/codex.js';
import { configureOpenCode, unconfigureOpenCode } from '../configurators/opencode.js';
import { setEnvironmentVariable } from '../utils/shell.js';
import { MEGALLM_BASE_URL } from '../constants.js';

const TOOLS = {
  claude:   { label: 'Claude Code', wire: configureClaude,   unwire: unconfigureClaude   },
  codex:    { label: 'Codex',       wire: configureCodex,    unwire: unconfigureCodex    },
  opencode: { label: 'OpenCode',    wire: configureOpenCode, unwire: unconfigureOpenCode },
};

function bail(msg, code = 1) {
  console.error(chalk.red(msg));
  process.exit(code);
}

export async function runLink({ profile, tool } = {}) {
  if (!tool) bail('Usage: megallm link <claude|codex|opencode>');
  const def = TOOLS[tool.toLowerCase()];
  if (!def) bail(`Unknown tool "${tool}". Pick one of: ${Object.keys(TOOLS).join(', ')}`);

  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`Not signed in (profile "${name}"). Run \`megallm login\` first.`));
    process.exit(1);
  }

  const ok = await def.wire(auth.apiKey, 'system');
  if (!ok) process.exit(1);

  // Always set the env vars too so the tool actually picks the key up.
  setEnvironmentVariable('ANTHROPIC_BASE_URL', MEGALLM_BASE_URL, true);
  setEnvironmentVariable('ANTHROPIC_API_KEY', auth.apiKey, true);
  setEnvironmentVariable('MEGALLM_API_KEY',   auth.apiKey, true);
  console.log(chalk.green(`\n✓ Linked ${def.label} to MegaLLM.`));
}

export async function runUnlink({ tool } = {}) {
  if (!tool) bail('Usage: megallm unlink <claude|codex|opencode>');
  const def = TOOLS[tool.toLowerCase()];
  if (!def) bail(`Unknown tool "${tool}". Pick one of: ${Object.keys(TOOLS).join(', ')}`);

  const result = await def.unwire('system');
  if (result.removed) {
    console.log(chalk.green(`✓ Removed MegaLLM keys from ${def.label} (${result.configPath}).`));
  } else {
    console.log(chalk.gray(`• ${def.label}: ${result.reason || 'nothing to unlink'}.`));
  }
  console.log(chalk.gray('Tip: open a new shell so any old env vars stop applying.'));
}
