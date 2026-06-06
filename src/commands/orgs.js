// `megallm orgs` — list the orgs the current session can switch into.
import chalk from 'chalk';
import { readAuth, resolveProfileName } from '../auth/store.js';
import { listOrgs } from '../auth/api.js';

export async function runOrgs({ profile } = {}) {
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`Not logged in (profile "${name}"). Run \`megallm login\`.`));
    process.exit(1);
  }
  let orgs;
  try { orgs = await listOrgs(auth.apiKey); }
  catch (err) {
    console.log(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }
  if (!orgs.length) {
    console.log(chalk.yellow('No organizations found for this account.'));
    return;
  }
  console.log(chalk.cyan('\nOrganizations'));
  console.log(chalk.gray('─'.repeat(48)));
  for (const o of orgs) {
    const active = auth.orgId === o.org_id ? chalk.green(' ★') : '  ';
    const role = o.role ? chalk.gray(` (${o.role})`) : '';
    console.log(`${active} ${chalk.white(o.org_name)}${role}`);
    console.log(chalk.gray(`     ${o.org_id}`));
  }
  console.log('');
  console.log(chalk.gray(`Switch with: ${chalk.bold('megallm switch-org <org_id>')}`));
}
