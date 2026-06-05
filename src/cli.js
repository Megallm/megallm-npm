#!/usr/bin/env node

// Main CLI for MegaLLM Setup
import chalk from 'chalk';
import gradient from 'gradient-string';
import { buildWordmarkGrid, playShimmerOnce } from './tui/shimmer.js';
import { detectOS } from './detectors/os.js';
import { getInstalledTools, checkToolsStatus, isClaudeCodeInstalled, isCodexInstalled, isOpenCodeInstalled } from './detectors/tools.js';
import {
  promptToolSelection,
  promptSetupLevel,
  promptApiKey,
  promptApiKeyPaste,
  promptAuthMethod,
  promptOrgSelection,
  printIdentityBanner,
  confirmConfiguration,
  promptRetry,
  promptExistingConfigAction,
  confirmOverride,
  promptStatuslineSetup
} from './utils/prompts.js';
import { select, confirm } from '@inquirer/prompts';
import { installClaudeCode, installCodex, installOpenCode, promptInstallation } from './utils/installer.js';
import { configureClaude } from './configurators/claude.js';
import { configureCodex } from './configurators/codex.js';
import { configureOpenCode } from './configurators/opencode.js';
import { configureStatusline, isStatuslineConfigured } from './configurators/statusline.js';
import { reloadShell, setEnvironmentVariable } from './utils/shell.js';
import { MEGALLM_BASE_URL, SETUP_LEVELS } from './constants.js';
import { checkExistingConfiguration, removeEnvVars, detectExistingEnvVars, removeConfigurationFiles } from './utils/envDetector.js';
import { loginWithBrowser } from './auth/login.js';
import { readAuth, resolveProfileName, writeAuth, writeState } from './auth/store.js';
import { fetchUserInfo } from './auth/oauth.js';
import { listOrgs } from './auth/api.js';
import { resolveKeyForOrg } from './auth/keys.js';

/**
 * Resolve a usable MegaLLM API key for the wizard.
 *
 * Order of preference:
 *   1. If a saved CLI session exists and still works, offer to reuse it.
 *   2. Otherwise let the user pick "login with browser" or "paste a key".
 *
 * The login path also runs the org picker if the account belongs to >1 org
 * and mints a fresh per-org key so the key the wizard installs is scoped
 * correctly out of the box.
 *
 * @returns {Promise<{ apiKey: string, source: 'login' | 'paste' | 'existing' }>}
 */
async function obtainApiKey() {
  const profile = resolveProfileName();
  const existing = await readAuth(profile);

  let sessionLabel = '';
  let sessionStillValid = false;
  if (existing?.apiKey) {
    // Quietly verify the saved key still works before offering it.
    try {
      const u = await fetchUserInfo(existing.apiKey);
      if (u) {
        sessionStillValid = true;
        sessionLabel = u.email || u.name || existing.user?.email || 'saved session';
      }
    } catch { /* network blip — still offer it */ }
  }

  const method = await promptAuthMethod({
    hasExistingSession: !!existing?.apiKey && sessionStillValid,
    sessionLabel,
  });

  if (method === 'existing' && existing?.apiKey) {
    printIdentityBanner({
      user: existing.user,
      orgName: existing.orgName,
      apiKey: existing.apiKey,
    });
    return { apiKey: existing.apiKey, source: 'existing' };
  }

  if (method === 'paste') {
    const k = await promptApiKeyPaste();
    return { apiKey: k, source: 'paste' };
  }

  // method === 'login'
  let record = await loginWithBrowser({ profile });

  // If the account has multiple orgs, let the user pick one and mint a fresh
  // per-org key. This mirrors AWS CLI's "default profile is your default org".
  let orgs = [];
  try { orgs = await listOrgs(record.apiKey); } catch { /* ignore */ }

  if (orgs.length > 1) {
    const chosenOrgId = await promptOrgSelection(orgs, { defaultOrgId: record.orgId });
    if (chosenOrgId && chosenOrgId !== record.orgId) {
      const chosenOrg = orgs.find(o => o.org_id === chosenOrgId);
      try {
        // Reuse a cached per-org key if it's still alive on the backend; only
        // mint a fresh one when no live key exists for this org.
        const resolved = await resolveKeyForOrg({
          auth: record,
          org: { org_id: chosenOrgId, org_name: chosenOrg?.org_name || null },
          onProgress: (msg) => console.log(chalk.cyan(`\n🔑 ${msg}`)),
        });
        if (resolved.apiKey) {
          if (resolved.reused) {
            console.log(chalk.gray('  Reused saved key for this org.'));
          } else {
            console.log(chalk.green('  Minted a fresh key for this org.'));
          }
          record = {
            ...record,
            apiKey:    resolved.apiKey,
            apiKeyId:  resolved.apiKeyId,
            keyPrefix: resolved.keyPrefix,
            orgId:     chosenOrgId,
            orgName:   chosenOrg?.org_name || null,
            keysByOrg: resolved.keysByOrg,
          };
          await writeAuth(record, profile);
          await writeState({
            current_org_id: record.orgId,
            current_org_name: record.orgName,
            orgs,
          }, profile);
        }
      } catch (err) {
        console.log(chalk.yellow(`⚠ Could not resolve a per-org key (${err.message}); using your default key.`));
      }
    }
  }

  printIdentityBanner({
    user: record.user,
    orgName: record.orgName,
    apiKey: record.apiKey,
  });
  return { apiKey: record.apiKey, source: 'login' };
}

/**
 * Render the wizard's branded welcome banner. Plays a one-shot diagonal
 * shimmer over the cfonts "block" wordmark (top-left → bottom-right), then
 * prints the gradient rule and tagline under it.
 */
async function showBanner() {
  console.clear();
  const grid = buildWordmarkGrid('MegaLLM');
  await playShimmerOnce(grid, { passes: 1 });
  const brand = gradient(['#22d3ee', '#3b82f6']);
  const rule = brand('━'.repeat(70));
  console.log(rule);
  console.log('');
  console.log(' ' + chalk.cyan.bold('✻') + '  ' + chalk.bold('Configure Claude Code, Codex & OpenCode for MegaLLM'));
  console.log('    ' + chalk.gray('Docs at megallm.io  ·  Run `megallm --help`'));
  console.log('');
}

/**
 * Handle statusline setup flow
 * @param {Object} toolsStatus - Status of installed tools
 * @returns {Promise<void>}
 */
async function handleStatuslineSetup(toolsStatus) {
  if (!toolsStatus.claude.installed) {
    return;
  }

  const statuslineConfigured = await isStatuslineConfigured();

  if (!statuslineConfigured) {
    const wantsStatusline = await promptStatuslineSetup();

    if (wantsStatusline) {
      const statuslineSuccess = await configureStatusline(true);
      if (!statuslineSuccess) {
        console.log(chalk.yellow('\n⚠ Statusline setup was skipped.'));
      }
    } else {
      console.log(chalk.gray('\n✓ Skipping statusline setup. You can set it up later with:'));
      console.log(chalk.gray('  npx @chongdashu/cc-statusline@latest init'));
    }
  } else {
    console.log(chalk.green('\n✓ Claude Code statusline is already configured'));
  }
}

/**
 * Launches the interactive MegaLLM setup CLI to detect, install, and configure supported AI tools.
 *
 * Guides the user through system detection, tool installation, selection of Claude Code, Codex, and OpenCode,
 * configuration level and API key collection, per-tool configuration, optional system environment variable updates,
 * optional Claude Code statusline setup, shell reload, and final usage instructions.
 *
 * This function performs system-side effects (installing packages, modifying configuration and environment files,
 * reloading the shell) and may call process.exit to terminate the process based on user choices or errors.
 */
async function main() {
  await showBanner();

  try {
    // Step 1: Detect OS
    console.log(chalk.cyan('\n🔍 Detecting system information...'));
    const osInfo = detectOS();
    console.log(chalk.green(`✓ OS: ${osInfo.type} (${osInfo.platform})`));
    console.log(chalk.green(`✓ Shell: ${osInfo.shell}`));

    // Step 2: Check installed tools
    console.log(chalk.cyan('\n🔍 Checking installed tools...'));
    let toolsStatus = checkToolsStatus();
    let installedTools = getInstalledTools();

    // Show current status
    if (toolsStatus.claude.installed) {
      console.log(chalk.green(`✓ Claude Code detected`));
      if (toolsStatus.claude.configPath) {
        console.log(chalk.gray(`  Config: ${toolsStatus.claude.configPath}`));
      }
    } else {
      console.log(chalk.yellow(`✗ Claude Code not found`));
    }

    if (toolsStatus.codex.installed) {
      console.log(chalk.green(`✓ Codex detected`));
      if (toolsStatus.codex.configPath) {
        console.log(chalk.gray(`  Config: ${toolsStatus.codex.configPath}`));
      }
    } else {
      console.log(chalk.yellow(`✗ Codex not found`));
    }

    if (toolsStatus.opencode.installed) {
      console.log(chalk.green(`✓ OpenCode detected`));
      if (toolsStatus.opencode.configPath) {
        console.log(chalk.gray(`  Config: ${toolsStatus.opencode.configPath}`));
      }
    } else {
      console.log(chalk.yellow(`✗ OpenCode not found`));
    }

    // Check if we need to offer installation
    const claudeInstalled = toolsStatus.claude.installed;
    const codexInstalled = toolsStatus.codex.installed;
    const opencodeInstalled = toolsStatus.opencode.installed;

    // If no tools are installed, offer to install them
    if (!toolsStatus.anyInstalled) {
      console.log(chalk.yellow('\n⚠ No supported tools are installed.'));
      console.log(chalk.cyan('MegaLLM supports Claude Code, Codex, and OpenCode.'));

      // Ask if they want to install any tools
      const wantsToInstall = await confirm({
        message: 'Would you like to install AI tools now?',
        default: true
      });

      if (wantsToInstall) {
        // Show installation options
        const installChoice = await select({
          message: 'What would you like to install?',
          choices: [
            { name: 'Claude Code (@anthropic-ai/claude-code)', value: 'claude' },
            { name: 'Codex (@openai/codex)', value: 'codex' },
            { name: 'OpenCode (opencode-ai)', value: 'opencode' },
            { name: 'All tools', value: 'all' }
          ]
        });

        // Install based on choice
        if (installChoice === 'claude' || installChoice === 'all') {
          const installed = await installClaudeCode();
          if (installed) {
            toolsStatus = checkToolsStatus();
            installedTools = getInstalledTools();
          }
        }

        if (installChoice === 'codex' || installChoice === 'all') {
          const installed = await installCodex();
          if (installed) {
            toolsStatus = checkToolsStatus();
            installedTools = getInstalledTools();
          }
        }

        if (installChoice === 'opencode' || installChoice === 'all') {
          const installed = await installOpenCode();
          if (installed) {
            toolsStatus = checkToolsStatus();
            installedTools = getInstalledTools();
          }
        }

        // Final check after installations
        if (!checkToolsStatus().anyInstalled) {
          console.log(chalk.red('\n❌ Installation failed. Please install manually:'));
          console.log(chalk.gray('  Claude Code: npm install -g @anthropic-ai/claude-code'));
          console.log(chalk.gray('  Codex: npm install -g @openai/codex'));
          console.log(chalk.gray('  OpenCode: npm install -g opencode-ai'));
          process.exit(1);
        }
      } else {
        console.log(chalk.red('\n❌ No tools available for configuration.'));
        console.log(chalk.gray('You can install them manually:'));
        console.log(chalk.gray('  Claude Code: npm install -g @anthropic-ai/claude-code'));
        console.log(chalk.gray('  Codex: npm install -g @openai/codex'));
        console.log(chalk.gray('  OpenCode: npm install -g opencode-ai'));
        process.exit(1);
      }
    }
    // If some tools are installed but not all, offer to install missing ones
    else if (!claudeInstalled || !codexInstalled || !opencodeInstalled) {
      console.log(chalk.cyan('\n💡 Additional tools available'));

      if (!claudeInstalled) {
        console.log(chalk.gray('  • Claude Code - Not installed'));
      }
      if (!codexInstalled) {
        console.log(chalk.gray('  • Codex - Not installed'));
      }
      if (!opencodeInstalled) {
        console.log(chalk.gray('  • OpenCode - Not installed'));
      }

      const wantsMore = await confirm({
        message: 'Would you like to install the missing tool(s)?',
        default: false
      });

      if (wantsMore) {
        // Build installation choices for missing tools
        const installChoices = [];
        if (!claudeInstalled) {
          installChoices.push({ name: 'Claude Code (@anthropic-ai/claude-code)', value: 'claude' });
        }
        if (!codexInstalled) {
          installChoices.push({ name: 'Codex (@openai/codex)', value: 'codex' });
        }
        if (!opencodeInstalled) {
          installChoices.push({ name: 'OpenCode (opencode-ai)', value: 'opencode' });
        }
        // Only show "all" if multiple tools are missing
        const missingCount = (!claudeInstalled ? 1 : 0) + (!codexInstalled ? 1 : 0) + (!opencodeInstalled ? 1 : 0);
        if (missingCount > 1) {
          installChoices.push({ name: 'All missing tools', value: 'all' });
        }

        const installChoice = await select({
          message: 'What would you like to install?',
          choices: installChoices
        });

        // Install based on choice
        if (installChoice === 'claude' || installChoice === 'all') {
          const installed = await installClaudeCode();
          if (installed) {
            toolsStatus = checkToolsStatus();
            installedTools = getInstalledTools();
          }
        }

        if (installChoice === 'codex' || installChoice === 'all') {
          const installed = await installCodex();
          if (installed) {
            toolsStatus = checkToolsStatus();
            installedTools = getInstalledTools();
          }
        }

        if (installChoice === 'opencode' || installChoice === 'all') {
          const installed = await installOpenCode();
          if (installed) {
            toolsStatus = checkToolsStatus();
            installedTools = getInstalledTools();
          }
        }
      }
    }

    // Step 2.5: Check for existing MegaLLM configuration
    console.log(chalk.cyan('\n🔍 Checking for existing MegaLLM configuration...'));
    const existingConfig = await checkExistingConfiguration();
    const envVars = await detectExistingEnvVars();

    if (existingConfig.isConfigured && existingConfig.locations.length > 0) {
      // Show detailed information about existing configuration
      console.log(chalk.green('✓ MegaLLM is already configured'));

      if (envVars.ANTHROPIC_BASE_URL.length > 0) {
        console.log(chalk.cyan('\n📍 Base URL found in:'));
        envVars.ANTHROPIC_BASE_URL.forEach(item => {
          console.log(chalk.gray(`  • ${item.location}: ${item.value}`));
        });
      }

      if (envVars.ANTHROPIC_API_KEY.length > 0) {
        console.log(chalk.cyan('\n🔑 API Key found in:'));
        envVars.ANTHROPIC_API_KEY.forEach(item => {
          console.log(chalk.gray(`  • ${item.location}: ${item.value}`));
        });
      }

      if (envVars.MEGALLM_API_KEY.length > 0) {
        console.log(chalk.cyan('\n🔑 MegaLLM API Key found in:'));
        envVars.MEGALLM_API_KEY.forEach(item => {
          console.log(chalk.gray(`  • ${item.location}: ${item.value}`));
        });
      }

      // Ask user what to do
      const action = await promptExistingConfigAction(existingConfig.locations);

      if (action === 'skip') {
        console.log(chalk.green('\n✅ Keeping existing configuration.'));
        console.log(chalk.cyan('MegaLLM is already set up and ready to use!'));

        // Check for statusline setup if Claude Code is installed
        await handleStatuslineSetup(toolsStatus);

        process.exit(0);
      } else if (action === 'cancel') {
        console.log(chalk.yellow('\n👋 Setup cancelled.'));
        process.exit(0);
      } else if (action === 'override') {
        // Confirm override action
        const confirmAction = await confirmOverride(existingConfig.locations);

        if (!confirmAction) {
          console.log(chalk.yellow('\n👋 Setup cancelled.'));
          process.exit(0);
        }

        // Remove existing configuration
        console.log(chalk.cyan('\n🧹 Removing existing configuration...'));

        // Remove environment variables
        const removeResult = await removeEnvVars();

        // Remove configuration files
        const fileRemoveResult = await removeConfigurationFiles();

        // Show results
        if (removeResult.removed.length > 0) {
          console.log(chalk.green('✓ Removed environment variables from:'));
          removeResult.removed.forEach(item => {
            console.log(chalk.gray(`  • ${item.location}`));
          });
        }

        if (fileRemoveResult.removed.length > 0) {
          console.log(chalk.green('✓ Cleaned configuration files:'));
          fileRemoveResult.removed.forEach(item => {
            console.log(chalk.gray(`  • ${item.file} (${item.action})`));
          });
        }

        if (removeResult.errors.length > 0 || fileRemoveResult.errors.length > 0) {
          console.log(chalk.yellow('\n⚠ Some locations could not be cleaned:'));
          [...removeResult.errors, ...fileRemoveResult.errors].forEach(error => {
            console.log(chalk.gray(`  • ${error}`));
          });
        }

        console.log(chalk.green('\n✓ Old configuration removed. Proceeding with new setup...'));
      }
    } else if (existingConfig.hasBaseUrl || existingConfig.hasApiKey) {
      // Partial configuration exists
      console.log(chalk.yellow('⚠ Partial configuration detected'));

      if (existingConfig.hasBaseUrl && !existingConfig.baseUrlValue?.includes('megallm')) {
        console.log(chalk.gray(`  • Base URL: ${existingConfig.baseUrlValue} (not MegaLLM)`));
      }

      const proceed = await confirm({
        message: 'Would you like to update the configuration to use MegaLLM?',
        default: true
      });

      if (!proceed) {
        console.log(chalk.yellow('\n👋 Setup cancelled.'));
        process.exit(0);
      }
    } else {
      console.log(chalk.gray('✓ No existing MegaLLM configuration found'));
    }

    // Step 3: Tool selection
    console.log(chalk.cyan('\n📋 Configuration Setup'));
    const selectedTool = await promptToolSelection(installedTools);

    if (!selectedTool || selectedTool === 'skip') {
      console.log(chalk.gray(`\nSkipped. Run ${chalk.bold('megallm setup')} or ${chalk.bold('megallm link <tool>')} any time.\n`));
      process.exit(0);
    }

    // Step 4: Setup level selection
    // For Codex, always use system-level
    let setupLevel;
    if (selectedTool === 'codex') {
      console.log(chalk.cyan('\n📋 Configuration Level:'));
      console.log(chalk.gray('  Codex/Windsurf only supports system-level configuration'));
      setupLevel = SETUP_LEVELS.SYSTEM;
    } else {
      setupLevel = await promptSetupLevel();
    }

    // Step 5: API Key — login with browser, paste, or reuse saved session.
    const { apiKey } = await obtainApiKey();

    // Step 6: Confirm configuration
    const configSummary = {
      tool: selectedTool === 'all' ? 'All tools (Claude Code, Codex & OpenCode)' :
            selectedTool === 'both' ? 'Claude Code & Codex' :
            selectedTool === 'claude' ? 'Claude Code' :
            selectedTool === 'codex' ? 'Codex' : 'OpenCode',
      level: setupLevel,
      baseUrl: MEGALLM_BASE_URL,
      apiKey: apiKey
    };

    const confirmed = await confirmConfiguration(configSummary);

    if (!confirmed) {
      const retry = await promptRetry('Would you like to reconfigure?');
      if (retry) {
        return main(); // Restart the process
      } else {
        console.log(chalk.yellow('\nSetup cancelled.'));
        process.exit(0);
      }
    }

    // Step 7: Apply configurations
    console.log(chalk.cyan('\n🚀 Applying configuration...'));

    const isSystemLevel = setupLevel === SETUP_LEVELS.SYSTEM;
    const configLevel = isSystemLevel ? 'system' : 'project';

    let success = true;

    // Configure Claude Code
    if (selectedTool === 'claude' || selectedTool === 'both' || selectedTool === 'all') {
      const claudeSuccess = await configureClaude(apiKey, configLevel);
      success = success && claudeSuccess;
    }

    // Configure Codex
    if (selectedTool === 'codex' || selectedTool === 'both' || selectedTool === 'all') {
      const codexSuccess = await configureCodex(apiKey, configLevel);
      success = success && codexSuccess;
    }

    // Configure OpenCode
    if (selectedTool === 'opencode' || selectedTool === 'all') {
      const opencodeSuccess = await configureOpenCode(apiKey, configLevel);
      success = success && opencodeSuccess;
    }

    if (!success) {
      console.log(chalk.red('\n❌ Configuration failed!'));
      const retry = await promptRetry();
      if (retry) {
        return main();
      }
      process.exit(1);
    }

    // Step 8: Set environment variables (optional for system-level)
    if (isSystemLevel) {
      console.log(chalk.cyan('\n🔧 Setting environment variables...'));

      // Set appropriate environment variables based on which tools are configured
      if (selectedTool === 'claude' || selectedTool === 'both' || selectedTool === 'all') {
        setEnvironmentVariable('ANTHROPIC_BASE_URL', MEGALLM_BASE_URL, true);
        setEnvironmentVariable('ANTHROPIC_API_KEY', apiKey, true);
      }

      if (selectedTool === 'codex' || selectedTool === 'opencode' || selectedTool === 'both' || selectedTool === 'all') {
        setEnvironmentVariable('MEGALLM_API_KEY', apiKey, true);
      }

      console.log(chalk.green('✓ Environment variables set'));
    }

    // Step 8.5: Ask about statusline setup (only if Claude Code was configured)
    if (selectedTool === 'claude' || selectedTool === 'both' || selectedTool === 'all') {
      await handleStatuslineSetup(toolsStatus);
    }

    // Step 9: Reload shell
    console.log(chalk.cyan('\n🔄 Finalizing setup...'));
    reloadShell();

    // Step 10: Success message
    console.log(chalk.green('\n🎉 Setup completed successfully!'));
    console.log(chalk.cyan('\n✨ You can now use:'));

    if (selectedTool === 'claude' || selectedTool === 'both' || selectedTool === 'all') {
      console.log(chalk.white('  • Claude Code with MegaLLM'));
      console.log(chalk.gray('    Just start Claude Code as usual'));
    }

    if (selectedTool === 'codex' || selectedTool === 'both' || selectedTool === 'all') {
      console.log(chalk.white('  • Codex with MegaLLM'));
      console.log(chalk.gray('    Just start Codex/Windsurf as usual'));
    }

    if (selectedTool === 'opencode' || selectedTool === 'all') {
      console.log(chalk.white('  • OpenCode with MegaLLM'));
      console.log(chalk.gray('    Just start OpenCode as usual'));
    }

    console.log(chalk.cyan('\n📚 Need help?'));
    console.log(chalk.gray('  • Documentation: https://docs.megallm.io/'));
    console.log(chalk.gray('  • Support: support@megallm.io'));

    console.log(chalk.cyan('\n✨ Thank you for using MegaLLM!\n'));

  } catch (error) {
    // Handle user cancellation gracefully
    if (error.message && error.message.includes('User force closed')) {
      console.log(chalk.yellow('\n\n👋 Setup cancelled. See you next time!'));
      process.exit(0);
    }

    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n❌ Unhandled error:'), reason);
  process.exit(1);
});

// Clean exit on Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Setup cancelled.'));
  process.exit(0);
});

// Clean exit on termination
process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n👋 Setup terminated.'));
  process.exit(0);
});

// Handle ESC key
process.stdin.on('keypress', (str, key) => {
  if (key && key.name === 'escape') {
    console.log(chalk.yellow('\n\n👋 Setup cancelled.'));
    process.exit(0);
  }
});

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;