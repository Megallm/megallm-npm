// `megallm profile list | use <name> | rm <name>` — manage named credential
// profiles stored under ~/.megallm/profiles/.
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import {
  listProfiles,
  setCurrentProfile,
  resolveProfileName,
  readAuth,
  maskApiKey,
} from '../auth/store.js';
import { MEGALLM_PROFILES_DIR } from '../constants.js';

function profileDir(name) {
  return path.join(MEGALLM_PROFILES_DIR, name);
}

export async function runProfileList() {
  const names = await listProfiles();
  const current = resolveProfileName(); // honours config.json + env
  if (names.length === 0) {
    console.log(chalk.yellow('No profiles yet. Run `megallm login` to create one.'));
    return;
  }
  console.log(chalk.bold('Profiles'));
  console.log(chalk.gray('────────'));
  for (const n of names) {
    const auth = await readAuth(n);
    const marker = n === current ? chalk.green('★') : ' ';
    const who = auth?.user?.email || auth?.user?.name || chalk.gray('(no identity)');
    const org = auth?.orgName ? chalk.gray(` · ${auth.orgName}`) : '';
    const key = auth?.apiKey ? chalk.gray(` · ${maskApiKey(auth.apiKey)}`) : '';
    console.log(`${marker} ${chalk.white(n.padEnd(16))} ${who}${org}${key}`);
  }
  console.log('');
  console.log(chalk.gray('★ = current profile.  Switch with `megallm profile use <name>`.'));
}

export async function runProfileUse({ name } = {}) {
  if (!name) {
    console.error(chalk.red('Usage: megallm profile use <name>'));
    process.exit(1);
  }
  const names = await listProfiles();
  if (!names.includes(name)) {
    console.error(chalk.red(`No profile "${name}". Existing: ${names.join(', ') || '(none)'}.`));
    process.exit(1);
  }
  await setCurrentProfile(name);
  console.log(chalk.green(`✓ Active profile is now "${name}".`));
  console.log(chalk.gray('  (Other shells inherit via ~/.megallm/config.json.)'));
}

export async function runProfileRm({ name } = {}) {
  if (!name) {
    console.error(chalk.red('Usage: megallm profile rm <name>'));
    process.exit(1);
  }
  const current = resolveProfileName();
  if (name === current) {
    console.error(chalk.red(
      `Refusing to delete the active profile "${name}". ` +
      `Switch with \`megallm profile use <other>\` first.`,
    ));
    process.exit(1);
  }
  const dir = profileDir(name);
  if (!await fs.pathExists(dir)) {
    console.error(chalk.red(`No profile "${name}".`));
    process.exit(1);
  }
  await fs.remove(dir);
  console.log(chalk.green(`✓ Removed profile "${name}".`));
}
