// `megallm logout` — revokes the saved key (best-effort) and removes local creds.
import chalk from 'chalk';
import { readAuth, deleteAuth, resolveProfileName } from '../auth/store.js';
import { revokeApiKey } from '../auth/oauth.js';

export async function runLogout({ profile } = {}) {
  const name = resolveProfileName(profile);
  const auth = await readAuth(name);
  if (!auth?.apiKey) {
    console.log(chalk.yellow(`No saved credentials for profile "${name}".`));
    return;
  }
  console.log(chalk.cyan(`Revoking key and clearing profile "${name}"…`));
  await revokeApiKey(auth.apiKey, auth.clientId);
  await deleteAuth(name);
  console.log(chalk.green('✓ Logged out.'));
}
