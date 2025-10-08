// User Interaction Prompts
import { select, input, confirm, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { TOOLS, SETUP_LEVELS } from '../constants.js';

export async function promptToolSelection(availableTools) {
  if (availableTools.length === 0) {
    console.log(chalk.yellow('\n⚠ Tools have been installed, now let\'s configure them.'));

    const tool = await select({
      message: 'Which tool would you like to configure?',
      choices: [
        { name: 'Claude Code', value: 'claude' },
        { name: 'Codex', value: 'codex' },
        { name: 'Both', value: 'both' }
      ]
    });

    return tool;
  }

  const choices = availableTools.map(tool => ({
    name: tool.name,
    value: tool.key
  }));

  if (availableTools.length > 1) {
    choices.push({ name: 'Configure Both', value: 'both' });
  }

  const selectedTool = await select({
    message: 'Which tool would you like to configure?',
    choices
  });

  return selectedTool;
}

export async function promptSetupLevel() {
  const level = await select({
    message: 'Choose setup level:',
    choices: [
      {
        name: 'System-level (applies to all projects)',
        value: SETUP_LEVELS.SYSTEM
      },
      {
        name: 'Project-level (current project only)',
        value: SETUP_LEVELS.PROJECT
      }
    ],
    default: SETUP_LEVELS.SYSTEM
  });

  return level;
}

export async function promptApiKey(toolName = '') {
  // First ask if they have an API key
  const hasKey = await confirm({
    message: "Do you have a MegaLLM API key?",
    default: false
  });

  if (!hasKey) {
    // Open browser and show instructions
    console.log(chalk.cyan('\n🔑 Let\'s create your MegaLLM API key!'));
    console.log(chalk.white('═'.repeat(50)));
    console.log(chalk.yellow('\nOpening MegaLLM in your browser...'));
    console.log(chalk.white('\n📌 If the browser doesn\'t open automatically, visit:'));
    console.log(chalk.cyan.bold('   https://megallm.io\n'));

    // Try to open browser
    const openCommand = process.platform === 'darwin' ? 'open' :
                       process.platform === 'win32' ? 'start' :
                       'xdg-open';

    try {
      const { exec } = await import('child_process');
      exec(`${openCommand} https://megallm.io`);
    } catch (error) {
      console.log(chalk.yellow('⚠ Could not open browser automatically.'));
    }

    console.log(chalk.white('═'.repeat(50)));
    console.log(chalk.green('\n✅ Steps to get your API key:'));
    console.log(chalk.white('  1. Sign up or log in to MegaLLM'));
    console.log(chalk.white('  2. Navigate to the API Keys section'));
    console.log(chalk.white('  3. Create a new API key'));
    console.log(chalk.white('  4. Copy the key and paste it below\n'));

    const continueSetup = await confirm({
      message: "Ready to enter your API key?",
      default: true
    });

    if (!continueSetup) {
      console.log(chalk.yellow('\n⚠ Setup cancelled. Run this tool again when you have your API key.'));
      process.exit(0);
    }
  }

  const apiKey = await password({
    message: `Enter your MegaLLM API key${toolName ? ` for ${toolName}` : ''}:`,
    mask: '*',
    validate: (input) => {
      if (!input || input.trim().length === 0) {
        return 'API key is required';
      }
      if (input.length < 20) {
        return 'API key seems too short. Please check and try again.';
      }
      return true;
    }
  });

  return apiKey.trim();
}

export async function confirmConfiguration(config) {
  console.log(chalk.cyan('\n📋 Configuration Summary:'));
  console.log(chalk.white('═'.repeat(40)));

  if (config.tool) {
    console.log(chalk.white(`  Tool: ${config.tool}`));
  }
  if (config.level) {
    console.log(chalk.white(`  Level: ${config.level}`));
  }
  if (config.baseUrl) {
    console.log(chalk.white(`  Base URL: ${config.baseUrl}`));
  }
  if (config.apiKey) {
    console.log(chalk.white(`  API Key: ${config.apiKey.substring(0, 10)}...${config.apiKey.slice(-4)}`));
  }

  console.log(chalk.white('═'.repeat(40)));

  const confirmed = await confirm({
    message: 'Proceed with this configuration?',
    default: true
  });

  return confirmed;
}

export async function promptRetry(message = 'Would you like to try again?') {
  const retry = await confirm({
    message,
    default: true
  });

  return retry;
}

export async function promptExistingConfigAction(locations) {
  console.log(chalk.yellow('\n⚠ MegaLLM configuration already exists!'));
  console.log(chalk.cyan('\nFound existing configuration in:'));

  locations.forEach(location => {
    console.log(chalk.gray(`  • ${location}`));
  });

  console.log(chalk.white('\n' + '═'.repeat(50)));

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      {
        name: '🔄 Override - Remove old configuration and apply new settings',
        value: 'override'
      },
      {
        name: '⏭️  Skip - Keep existing configuration',
        value: 'skip'
      },
      {
        name: '❌ Cancel - Exit without changes',
        value: 'cancel'
      }
    ],
    default: 'skip'
  });

  return action;
}

/**
 * Prompt the user to confirm removing existing configuration locations.
 *
 * Displays each path provided, warns that the action cannot be undone, and asks the user to confirm.
 * @param {string[]} locations - Array of configuration file paths or locations that will be removed.
 * @returns {boolean} `true` if the user confirms overriding the existing configuration, `false` otherwise.
 */
export async function confirmOverride(locations) {
  console.log(chalk.red('\n⚠️  WARNING: This will remove existing configuration from:'));

  locations.forEach(location => {
    console.log(chalk.yellow(`  • ${location}`));
  });

  console.log(chalk.white('\n' + '═'.repeat(50)));
  console.log(chalk.yellow('This action cannot be undone!'));

  const confirmed = await confirm({
    message: 'Are you sure you want to override the existing configuration?',
    default: false
  });

  return confirmed;
}

/**
 * Prompt the user to confirm whether they want to set up the Claude Code statusline.
 * @returns {boolean} `true` if the user opts in to set up the statusline, `false` otherwise.
 */
export async function promptStatuslineSetup() {
  console.log(chalk.cyan('\n🎨 Claude Code Statusline'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(chalk.white('Enhance your Claude Code terminal with:'));
  console.log(chalk.gray('  📁 Directory display with ~ abbreviation'));
  console.log(chalk.gray('  🌿 Git branch information'));
  console.log(chalk.gray('  🤖 Model info and version'));
  console.log(chalk.gray('  🧠 Real-time context usage'));
  console.log(chalk.gray('  💰 Cost tracking and burn rates'));
  console.log(chalk.gray('  ⌛ Session timer'));
  console.log(chalk.gray('  📊 Token analytics'));
  console.log(chalk.gray('═'.repeat(50)));

  const wantsStatusline = await confirm({
    message: 'Would you like to setup Claude Code statusline?',
    default: true
  });

  return wantsStatusline;
}