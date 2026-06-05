// `megallm switch-org <org_id>` — mint or reuse a per-org key and rewrite tool configs.
import chalk from 'chalk';
import { brailleOra as ora } from '../utils/spinner.js';
import {
  readAuth,
  writeAuth,
  writeState,
  resolveProfileName,
  maskApiKey,
} from '../auth/store.js';
import { listOrgs } from '../auth/api.js';
import { resolveKeyForOrg } from '../auth/keys.js';
import { promptOrgSelection } from '../utils/prompts.js';
import { runInkOrgPicker } from '../tui/OrgPicker.js';
import { promptAndConfigureTools } from '../utils/configure-tools.js';
import { releaseStdinHandoff } from '../tui/stdin.js';

export async function runSwitchOrg({ profile, orgId, rewriteConfigs = true } = {}) {
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`Not logged in (profile "${name}"). Run \`megallm login\`.`));
    process.exit(1);
  }

  const spinner = ora('Loading organizations…').start();
  let orgs;
  try { orgs = await listOrgs(auth.apiKey); spinner.stop(); }
  catch (err) { spinner.fail(err.message); process.exit(1); }

  if (!orgs.length) {
    console.log(chalk.yellow('No organizations found for this account.'));
    return;
  }

  let target = orgId;
  if (!target) {
    if (process.stdout.isTTY && process.stdin.isTTY) {
      target = await runInkOrgPicker(orgs, { currentOrgId: auth.orgId });
    } else {
      target = await promptOrgSelection(orgs, { defaultOrgId: auth.orgId });
    }
  }
  if (!target) {
    console.log(chalk.yellow('No org selected — nothing to do.'));
    return;
  }
  const org = orgs.find(o => o.org_id === target);
  if (!org) {
    console.log(chalk.red(`✗ You are not a member of org "${target}".`));
    process.exit(1);
  }

  if (org.org_id === auth.orgId) {
    console.log(chalk.green(`Already using ${org.org_name}.`));
    return;
  }

  // Resolve the key for the target org via the shared helper:
  // verify-and-reuse from cache, or mint fresh when needed.
  const keySpinner = ora('Resolving key for ' + org.org_name + '…').start();
  let resolved;
  try {
    resolved = await resolveKeyForOrg({
      auth,
      org,
      onProgress: (msg) => { keySpinner.text = msg; },
    });
    keySpinner.succeed(resolved.reused
      ? `Reusing saved key for ${org.org_name}`
      : `Minted a new key for ${org.org_name}`);
  } catch (err) {
    keySpinner.fail(err.message);
    process.exit(1);
  }

  const { apiKey: newKey, apiKeyId: newKeyId, keyPrefix: newKeyPrefix, reused, keysByOrg } = resolved;

  const updated = {
    ...auth,
    apiKey:    newKey,
    apiKeyId:  newKeyId,
    keyPrefix: newKeyPrefix,
    orgId:     org.org_id,
    orgName:   org.org_name,
    keysByOrg,
  };
  await writeAuth(updated, name);
  await writeState({
    current_org_id: org.org_id,
    current_org_name: org.org_name,
    orgs,
  }, name);

  console.log(chalk.green(`✓ Switched to ${org.org_name}${reused ? ' (reused saved key)' : ''}`));
  console.log(chalk.gray(`  Key: ${maskApiKey(newKey)}`));

  if (rewriteConfigs) {
    console.log('');
    await promptAndConfigureTools(newKey, {
      message: `Which tool would you like to update with the new ${org.org_name} key?`,
      skipHint: `Kept tool configs as-is. Run ${chalk.bold('megallm setup')} or ${chalk.bold('megallm link <tool>')} later to apply the new ${org.org_name} key.`,
    });
  }
  console.log('');
  releaseStdinHandoff();
}
