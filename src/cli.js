#!/usr/bin/env node

// Main CLI for MegaLLM Setup
const chalk = require('chalk');
const ora = require('ora');
const figlet = require('figlet');
const { detectOS } = require('./detectors/os');
const { getInstalledTools, checkToolsStatus } = require('./detectors/tools');
const {
  promptToolSelection,
  promptSetupLevel,
  promptApiKey,
  confirmConfiguration,
  promptRetry
} = require('./utils/prompts');
const { configureClaude } = require('./configurators/claude');
const { configureCodex } = require('./configurators/codex');
const { reloadShell, setEnvironmentVariable } = require('./utils/shell');
const { MEGALLM_BASE_URL, SETUP_LEVELS } = require('./constants');

// ASCII Art for branding
function showBanner() {
  console.clear();
  console.log(chalk.cyan(figlet.textSync('MegaLLM', { horizontalLayout: 'default' })));
  console.log(chalk.cyan('      Setup Tool for Claude Code & Codex'));
  console.log(chalk.gray('      Configure your AI tools to use MegaLLM\n'));
  console.log(chalk.gray('─'.repeat(50)));
}

// Main setup flow
async function main() {
  showBanner();

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

    console.log(chalk.gray('\n─'.repeat(50)));
    console.log(chalk.cyan('Thank you for using MegaLLM! 🚀\n'));

  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n❌ Unhandled error:'), reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Setup interrupted. Goodbye!'));
  process.exit(0);
});

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = main;