// `megallm keys list|revoke` — manage API keys for the active org.
import chalk from 'chalk';
import { readAuth, resolveProfileName, maskApiKey } from '../auth/store.js';
import { listKeys, revokeKey } from '../auth/api.js';

export async function runKeysList({ profile, orgId } = {}) {
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`Not logged in (profile "${name}"). Run \`megallm login\`.`));
    process.exit(1);
  }
  const target = orgId || auth.orgId;
  if (!target) {
    console.log(chalk.yellow('No org_id given and no active org saved. Run `megallm orgs` to find one.'));
    process.exit(1);
  }

  let payload;
  try { payload = await listKeys(auth.apiKey, target); }
  catch (err) {
    console.log(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }

  const keys = payload?.keys || payload?.data || payload || [];
  if (!keys.length) {
    console.log(chalk.yellow(`No API keys in org ${target}.`));
    return;
  }

  console.log(chalk.cyan(`\nKeys for org ${target}`));
  console.log(chalk.gray('─'.repeat(60)));
  for (const k of keys) {
    const id = k.api_key_id || k.id || '';
    const label = k.api_key_name || k.name || '(unnamed)';
    const prefix = k.key_prefix || k.prefix || '';
    const created = k.created_at || k.createdAt || '';
    console.log(`  ${chalk.white(label)}  ${chalk.gray(prefix)}`);
    console.log(chalk.gray(`    id: ${id}${created ? '  ·  created: ' + new Date(created).toLocaleDateString() : ''}`));
  }
  console.log('');
  console.log(chalk.gray(`Revoke with: ${chalk.bold('megallm keys revoke <key_id>')}`));
}

export async function runKeysRevoke({ profile, keyId } = {}) {
  if (!keyId) {
    console.log(chalk.red('✗ Missing key_id. Usage: megallm keys revoke <key_id>'));
    process.exit(1);
  }
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`Not logged in (profile "${name}"). Run \`megallm login\`.`));
    process.exit(1);
  }
  try {
    await revokeKey(auth.apiKey, keyId);
    console.log(chalk.green(`✓ Revoked ${keyId}`));
  } catch (err) {
    console.log(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }
}
