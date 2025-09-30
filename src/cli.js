#!/usr/bin/env node

// Main CLI for MegaLLM Setup
import chalk from 'chalk';
import figlet from 'figlet';
import { detectOS } from './detectors/os.js';
import { getInstalledTools, checkToolsStatus } from './detectors/tools.js';
import {
  promptToolSelection,
  promptSetupLevel,
  promptApiKey,
  confirmConfiguration,
  promptRetry
} from './utils/prompts.js';
import { configureClaude } from './configurators/claude.js';
import { configureCodex } from './configurators/codex.js';
import { reloadShell, setEnvironmentVariable } from './utils/shell.js';
import { MEGALLM_BASE_URL, SETUP_LEVELS } from './constants.js';

// ASCII Art for branding
async function showBanner() {
  console.clear();
  const banner = figlet.textSync('MegaLLM', { horizontalLayout: 'default' });
  console.log(chalk.cyan(banner));
  console.log(chalk.cyan('      Setup Tool for Claude Code & Codex'));
  console.log(chalk.gray('      Configure your AI tools to use MegaLLM\n'));
  console.log(chalk.gray('═'.repeat(50)));
}

// Main setup flow
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
    const toolsStatus = checkToolsStatus();
    const installedTools = getInstalledTools();

    if (toolsStatus.claude.installed) {
      console.log(chalk.green(`✓ Claude Code detected`));
      if (toolsStatus.claude.configPath) {
        console.log(chalk.gray(`  Config: ${toolsStatus.claude.configPath}`));
      }
    } else {
      console.log(chalk.yellow(`✗ Claude Code not found`));
    }

    if (toolsStatus.codex.installed) {
      const name = toolsStatus.codex.isWindsurf ? 'Codex (Windsurf)' : 'Codex';
      console.log(chalk.green(`✓ ${name} detected`));
      if (toolsStatus.codex.configPath) {
        console.log(chalk.gray(`  Config: ${toolsStatus.codex.configPath}`));
      }
    } else {
      console.log(chalk.yellow(`✗ Codex not found`));
    }

    // Step 3: Tool selection
    console.log(chalk.cyan('\n📋 Configuration Setup'));
    const selectedTool = await promptToolSelection(installedTools);

    if (!selectedTool) {
      console.log(chalk.yellow('\nSetup cancelled.'));
      process.exit(0);
    }

    // Step 4: Setup level selection
    const setupLevel = await promptSetupLevel();

    // Step 5: API Key input
    const apiKey = await promptApiKey();

    // Step 6: Confirm configuration
    const configSummary = {
      tool: selectedTool === 'both' ? 'Claude Code & Codex' :
            selectedTool === 'claude' ? 'Claude Code' : 'Codex',
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
    if (selectedTool === 'claude' || selectedTool === 'both') {
      const claudeSuccess = await configureClaude(apiKey, configLevel);
      success = success && claudeSuccess;
    }

    // Configure Codex
    if (selectedTool === 'codex' || selectedTool === 'both') {
      const codexSuccess = await configureCodex(apiKey, configLevel);
      success = success && codexSuccess;
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
      setEnvironmentVariable('ANTHROPIC_BASE_URL', MEGALLM_BASE_URL, true);
      setEnvironmentVariable('ANTHROPIC_API_KEY', apiKey, true);
      console.log(chalk.green('✓ Environment variables set'));
    }

    // Step 9: Reload shell
    console.log(chalk.cyan('\n🔄 Finalizing setup...'));
    reloadShell();

    // Step 10: Success message
    console.log(chalk.green('\n🎉 Setup completed successfully!'));
    console.log(chalk.cyan('\n✨ You can now use:'));

    if (selectedTool === 'claude' || selectedTool === 'both') {
      console.log(chalk.white('  • Claude Code with MegaLLM'));
      console.log(chalk.gray('    Just start Claude Code as usual'));
    }

    if (selectedTool === 'codex' || selectedTool === 'both') {
      console.log(chalk.white('  • Codex with MegaLLM'));
      console.log(chalk.gray('    Just start Codex/Windsurf as usual'));
    }

    console.log(chalk.cyan('\n📚 Need help?'));
    console.log(chalk.gray('  • Documentation: https://megallm.io/docs'));
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