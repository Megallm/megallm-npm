// `megallm login` — runs the Ink-rendered OAuth device flow.
// On success, asks if the user wants to configure their tools right now.
import chalk from 'chalk';
import { runInkLogin } from '../tui/Login.js';
import { releaseStdinHandoff } from '../tui/stdin.js';
import { resolveProfileName, setCurrentProfile } from '../auth/store.js';
import { promptAndConfigureTools } from '../utils/configure-tools.js';

export async function runLogin({ profile, setCurrent, autoConfigure = true, noBrowser = false } = {}) {
  const name = resolveProfileName(profile);
  const record = await runInkLogin({ profile: name, forceDeviceFlow: noBrowser });
  if (setCurrent) await setCurrentProfile(name);

  console.log(chalk.gray(`Credentials saved to ~/.megallm/profiles/${name}/auth.json`));

  if (!autoConfigure) {
    releaseStdinHandoff();
    return;
  }

  console.log('');
  const { picked } = await promptAndConfigureTools(record.apiKey, {
    message: 'Which tool would you like to configure with this key?',
    skipHint: `Skipped. You can run ${chalk.bold('megallm setup')} or ${chalk.bold('megallm link <tool>')} any time.`,
  });

  if (picked !== 'skip') {
    console.log(chalk.green('\n🎉  All set. Open a new shell or run `source ~/.zshrc` to pick up the env vars.\n'));
  }
  releaseStdinHandoff();
}
