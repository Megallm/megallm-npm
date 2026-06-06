// `megallm whoami` — show the identity behind the saved key.
import chalk from 'chalk';
import { readAuth, resolveProfileName, maskApiKey } from '../auth/store.js';
import { fetchUserInfo } from '../auth/oauth.js';

export async function runWhoami({ profile } = {}) {
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`Not logged in (profile "${name}"). Run \`megallm login\`.`));
    process.exit(1);
  }
  let user = auth.user;
  try {
    const fresh = await fetchUserInfo(auth.apiKey);
    if (fresh) user = fresh;
    else {
      console.log(chalk.red('✗ Saved key is no longer valid. Run `megallm login` again.'));
      process.exit(1);
    }
  } catch { /* show cached on network failure */ }

  console.log(chalk.cyan('\nMegaLLM identity'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Profile : ${chalk.white(name)}`);
  console.log(`  Name    : ${chalk.white(user?.name || '(unknown)')}`);
  console.log(`  Email   : ${chalk.white(user?.email || '(unknown)')}`);
  console.log(`  Org     : ${chalk.white(auth.orgName || auth.orgId || '(default)')}`);
  console.log(`  Scopes  : ${chalk.white((auth.scopes || []).join(' '))}`);
  console.log(`  Key     : ${chalk.white(maskApiKey(auth.apiKey))}`);
  console.log('');
}
