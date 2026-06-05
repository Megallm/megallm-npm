// High-level login orchestrator: device flow → token → identity → org pick → save.
// Used by both `megallm login` and the interactive setup wizard.
import chalk from 'chalk';
import { brailleOra as ora } from '../utils/spinner.js';
import { startDeviceFlow, pollForToken, fetchUserInfo, openInBrowser } from './oauth.js';
import { listOrgs } from './api.js';
import { writeAuth, writeState, ensureMegallmHome } from './store.js';
import { OAUTH_CLIENT_ID, OAUTH_SCOPES, DEFAULT_PROFILE } from '../constants.js';

/**
 * Run the full device-flow login. Returns the saved auth record on success.
 *
 * @param {{ profile?: string, openBrowser?: boolean }} opts
 */
export async function loginWithBrowser({ profile = DEFAULT_PROFILE, openBrowser = true } = {}) {
  await ensureMegallmHome();

  // 1. Start the device flow.
  const startSpinner = ora('Requesting device code…').start();
  let device;
  try {
    device = await startDeviceFlow({
      clientId: OAUTH_CLIENT_ID,
      scopes: OAUTH_SCOPES,
    });
    startSpinner.succeed('Device code received');
  } catch (err) {
    startSpinner.fail(err.message);
    throw err;
  }

  const url = device.verification_uri_complete || device.verification_uri;

  // 2. Show the code prominently and try to open the browser.
  console.log('');
  console.log(chalk.cyan('  ┌──────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │              Sign in to MegaLLM           │'));
  console.log(chalk.cyan('  ├──────────────────────────────────────────┤'));
  console.log(chalk.cyan('  │ Open this URL in your browser:            │'));
  console.log(chalk.white('  │   ' + (device.verification_uri || '').padEnd(38) + ' │'));
  console.log(chalk.cyan('  │                                          │'));
  console.log(chalk.cyan('  │ And enter this code:                     │'));
  console.log(chalk.yellow.bold('  │   ' + (device.user_code || '').padEnd(38) + ' │'));
  console.log(chalk.cyan('  └──────────────────────────────────────────┘'));
  console.log('');

  if (openBrowser && url) {
    console.log(chalk.gray(`Opening ${url} …`));
    openInBrowser(url);
  }

  // 3. Poll for the key.
  const pollSpinner = ora('Waiting for authorization…').start();
  let token;
  try {
    token = await pollForToken({
      device_code: device.device_code,
      interval: device.interval || 5,
      expires_in: device.expires_in || 900,
      onTick: ({ secondsLeft }) => {
        pollSpinner.text = `Waiting for authorization… (${secondsLeft}s left)`;
      },
    });
    pollSpinner.succeed('Authorized');
  } catch (err) {
    pollSpinner.fail(err.message);
    throw err;
  }

  const apiKey = token.api_key;
  if (!apiKey) throw new Error('Login response did not contain an API key');

  // 4. Fetch identity (best-effort) and the list of orgs the user belongs to.
  let user = null;
  try { user = await fetchUserInfo(apiKey); } catch { /* tolerate */ }

  let orgs = [];
  try { orgs = await listOrgs(apiKey); } catch { /* tolerate */ }

  // The /activate page already let the user pick the org for THIS key.
  // We don't know the chosen org_id from the token response, so we use the
  // first matching org (typically the user's default) for display, and store
  // the full list so `megallm orgs` can show it without an extra round trip.
  const activeOrg = orgs[0] || null;

  // 5. Persist.
  const record = {
    apiKey,
    keyPrefix: token.key_prefix || apiKey.slice(0, 16),
    scopes: token.scopes || OAUTH_SCOPES,
    user: user || null,
    orgId: activeOrg?.org_id || null,
    orgName: activeOrg?.org_name || null,
    clientId: OAUTH_CLIENT_ID,
  };
  await writeAuth(record, profile);
  await writeState({
    current_org_id: record.orgId,
    current_org_name: record.orgName,
    orgs,
  }, profile);

  return record;
}
