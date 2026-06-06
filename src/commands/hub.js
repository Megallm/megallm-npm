// `megallm` (no args, TTY) — Ink hub.
// Renders the hub, captures the user's menu pick, and dispatches to the
// matching subcommand handler.  Subcommands run *after* Ink has unmounted, so
// they get a clean stdout for inquirer / chalk output.
import chalk from 'chalk';
import { runInkHub } from '../tui/Hub.js';
import { releaseStdinHandoff } from '../tui/stdin.js';

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

    console.log('');
    console.log(chalk.gray('Press Ctrl+C to quit, or wait — opening hub again…\n'));
    // Brief pause so the user can read the previous output before the hub
    // re-renders and clears the screen-region above.
    await new Promise(r => setTimeout(r, 700));
  }
}
