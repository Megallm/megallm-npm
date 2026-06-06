#!/usr/bin/env node
// MegaLLM CLI entry point. Routes subcommands to handlers and falls back to
// the interactive setup wizard when invoked with no args (preserves the
// classic `npx megallm@latest` experience).

const argv = process.argv.slice(2);

// --- tiny flag parser -------------------------------------------------------
function takeFlag(args, name, hasValue) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === name) {
      if (hasValue) {
        const v = args[i + 1];
        args.splice(i, 2);
        return v;
      }
      args.splice(i, 1);
      return true;
    }
    if (hasValue && a.startsWith(name + '=')) {
      const v = a.slice(name.length + 1);
      args.splice(i, 1);
      return v;
    }
  }
  return undefined;
}

const profile = takeFlag(argv, '--profile', true) || takeFlag(argv, '-p', true);
const noBrowser = !!takeFlag(argv, '--no-browser');
const wantsHelp = takeFlag(argv, '--help') || takeFlag(argv, '-h');
const wantsVersion = takeFlag(argv, '--version') || takeFlag(argv, '-v');

const sub = argv[0];

const HELP = `
MegaLLM CLI — sign in once, configure Claude Code / Codex / OpenCode.

Usage:
  megallm                        Open the interactive hub (auto-detects TTY)
  megallm setup                  Run the full setup wizard
  megallm login [--profile p]    Sign in via the browser (OAuth, loopback redirect)
                  [--no-browser]    Force the device-code fallback (headless / SSH)
  megallm logout [--profile p]   Revoke the saved key and clear local creds
  megallm whoami [--profile p]   Show the identity behind the saved key
  megallm status [--profile p]   Plain-text snapshot of identity + tools
  megallm doctor [--profile p]   Run diagnostic checks on creds, tools, env
  megallm doctor fix             Auto-repair tool configs that hold a stale key
  megallm orgs   [--profile p]   List organizations you can switch into
  megallm switch-org [<id>]      Switch to an org and mint a fresh per-org key
  megallm keys list [--org id]   List API keys in the active (or given) org
  megallm keys revoke <key_id>   Revoke a key by its id

  megallm link   <tool>          Wire up one tool (claude | codex | opencode)
  megallm unlink <tool>          Remove MegaLLM keys from one tool

  megallm profile list           List saved credential profiles
  megallm profile use <name>     Make <name> the active profile
  megallm profile rm  <name>     Delete a saved profile

Global flags:
  --profile <name>  / -p <name>  Use a named credential profile  (env: MEGALLM_PROFILE)
  --help    / -h                 Show this help
  --version / -v                 Show the CLI version
`;

async function showVersion() {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  console.log(`megallm ${pkg.version}`);
}

function dieOnError(promise) {
  return promise.catch(err => {
    if (err && err.message && err.message.includes('User force closed')) {
      console.log('\n👋 Cancelled.');
      process.exit(0);
    }
    console.error(`\nError: ${err.message || err}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });
}

(async () => {
  if (wantsVersion) return showVersion();
  if (wantsHelp && !sub) { console.log(HELP); return; }

  switch (sub) {
    case undefined: {
      // No subcommand → show the Ink hub when we're attached to a TTY,
      // otherwise print help so scripted invocations stay deterministic.
      if (process.stdout.isTTY && process.stdin.isTTY) {
        const { runHub } = await import('../src/commands/hub.js');
        return dieOnError(runHub({ profile }));
      }
      console.log(HELP);
      return;
    }
    case 'hub': {
      const { runHub } = await import('../src/commands/hub.js');
      return dieOnError(runHub({ profile }));
    }
    case 'setup':
    case 'wizard': {
      const { default: main } = await import('../src/cli.js');
      return dieOnError(main());
    }
    case 'status': {
      const { runStatus } = await import('../src/commands/status.js');
      return dieOnError(runStatus({ profile }));
    }
    case 'doctor': {
      const action = argv[1];
      if (action === 'fix') {
        const { runDoctorFix } = await import('../src/commands/doctor.js');
        return dieOnError(runDoctorFix({ profile }).then(code => process.exit(code || 0)));
      }
      const { runDoctor } = await import('../src/commands/doctor.js');
      return dieOnError(runDoctor({ profile }).then(code => process.exit(code || 0)));
    }
    case 'link': {
      const tool = argv[1];
      const { runLink } = await import('../src/commands/link.js');
      return dieOnError(runLink({ profile, tool }));
    }
    case 'unlink': {
      const tool = argv[1];
      const { runUnlink } = await import('../src/commands/link.js');
      return dieOnError(runUnlink({ tool }));
    }
    case 'profile': {
      const action = argv[1];
      const arg = argv[2];
      const mod = await import('../src/commands/profile.js');
      if (!action || action === 'list')   return dieOnError(mod.runProfileList());
      if (action === 'use')               return dieOnError(mod.runProfileUse({ name: arg }));
      if (action === 'rm' || action === 'remove' || action === 'delete') {
        return dieOnError(mod.runProfileRm({ name: arg }));
      }
      console.error(`Unknown profile action: ${action}`);
      console.log(HELP);
      process.exit(1);
      break;
    }
    case 'login': {
      const { runLogin } = await import('../src/commands/login.js');
      return dieOnError(runLogin({ profile, setCurrent: !!profile, noBrowser }));
    }
    case 'logout': {
      const { runLogout } = await import('../src/commands/logout.js');
      return dieOnError(runLogout({ profile }));
    }
    case 'whoami': {
      const { runWhoami } = await import('../src/commands/whoami.js');
      return dieOnError(runWhoami({ profile }));
    }
    case 'orgs': {
      const { runOrgs } = await import('../src/commands/orgs.js');
      return dieOnError(runOrgs({ profile }));
    }
    case 'switch-org': {
      const orgId = argv[1];
      const { runSwitchOrg } = await import('../src/commands/switch-org.js');
      return dieOnError(runSwitchOrg({ profile, orgId }));
    }
    case 'keys': {
      const action = argv[1];
      if (action === 'list' || action === undefined) {
        const orgId = takeFlag(argv, '--org', true);
        const { runKeysList } = await import('../src/commands/keys.js');
        return dieOnError(runKeysList({ profile, orgId }));
      }
      if (action === 'revoke') {
        const keyId = argv[2];
        const { runKeysRevoke } = await import('../src/commands/keys.js');
        return dieOnError(runKeysRevoke({ profile, keyId }));
      }
      console.error(`Unknown keys action: ${action}`);
      console.log(HELP);
      process.exit(1);
      break;
    }
    case 'help': {
      console.log(HELP);
      return;
    }
    default: {
      console.error(`Unknown command: ${sub}`);
      console.log(HELP);
      process.exit(1);
    }
  }
})();
