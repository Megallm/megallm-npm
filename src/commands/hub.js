// `megallm` (no args, TTY) — Ink hub.
// Renders the hub, captures the user's menu pick, and dispatches to the
// matching subcommand handler.  Subcommands run *after* Ink has unmounted, so
// they get a clean stdout for inquirer / chalk output.
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { runInkHub } from '../tui/Hub.js';
import { releaseStdinHandoff } from '../tui/stdin.js';

// After a subcommand finishes we *don't* auto-reopen the hub — that wipes
// the output the user just produced. Show an explicit prompt instead.
// Returns true to loop back into the hub, false to exit.
async function promptBackOrExit() {
  console.log('');
  try {
    const choice = await select({
      message: 'Done. What next?',
      default: 'back',
      choices: [
        { name: 'Back to menu', value: 'back' },
        { name: 'Exit',         value: 'exit' },
      ],
    });
    return choice === 'back';
  } catch (err) {
    // Ctrl+C / ESC inside the prompt → treat as exit.
    if (err && err.message && err.message.includes('User force closed')) return false;
    throw err;
  }
}

export async function runHub({ profile } = {}) {
  while (true) {
    const pick = await runInkHub({ profile });

    switch (pick) {
      case 'login': {
        const { runLogin } = await import('./login.js');
        await runLogin({ profile, setCurrent: !!profile, autoConfigure: true });
        break;
      }
      case 'setup': {
        const { default: main } = await import('../cli.js');
        await main();
        releaseStdinHandoff();
        return; // wizard already prints its own farewell
      }
      case 'switch-org': {
        const { runSwitchOrg } = await import('./switch-org.js');
        await runSwitchOrg({ profile });
        break;
      }
      case 'keys': {
        const { runKeysList } = await import('./keys.js');
        await runKeysList({ profile });
        break;
      }
      case 'status': {
        const { runStatus } = await import('./status.js');
        await runStatus({ profile });
        break;
      }
      case 'doctor': {
        const { runDoctor } = await import('./doctor.js');
        await runDoctor({ profile });
        break;
      }
      case 'doctor-fix': {
        const { runDoctorFix } = await import('./doctor.js');
        await runDoctorFix({ profile });
        break;
      }
      case 'logout': {
        const { runLogout } = await import('./logout.js');
        await runLogout({ profile });
        break;
      }
      case 'exit':
      default:
        console.log(chalk.gray('\nBye 👋\n'));
        releaseStdinHandoff();
        return;
    }

    const goBack = await promptBackOrExit();
    if (!goBack) {
      console.log(chalk.gray('\nBye 👋\n'));
      releaseStdinHandoff();
      return;
    }
  }
}
