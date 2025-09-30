// User Interaction Prompts
const inquirer = require('inquirer');
const chalk = require('chalk');
const { TOOLS, SETUP_LEVELS } = require('../constants');

async function promptToolSelection(availableTools) {
  if (availableTools.length === 0) {
    console.log(chalk.yellow('\n⚠ No supported tools found installed.'));
    console.log(chalk.cyan('Please install Claude Code or Codex first.'));

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Would you like to set up configuration anyway?',
        default: false
      }
    ]);

    if (!proceed) {
      return null;
    }

    // Allow manual selection
    const { tool } = await inquirer.prompt([
      {
        type: 'list',
        name: 'tool',
        message: 'Which tool would you like to configure?',
        choices: [
          { name: 'Claude Code', value: TOOLS.CLAUDE_CODE },
          { name: 'Codex', value: TOOLS.CODEX },
          { name: 'Both', value: TOOLS.BOTH }
        ]
      }
    ]);

    return tool;
  }

  const choices = availableTools.map(tool => ({
    name: tool.name,
    value: tool.key
  }));

  if (availableTools.length > 1) {
    choices.push({ name: 'Configure Both', value: 'both' });
  }

  const { selectedTool } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTool',
      message: 'Which tool would you like to configure?',
      choices
    }
  ]);

  return selectedTool;
}

async function promptSetupLevel() {
  const { level } = await inquirer.prompt([
    {
      type: 'list',
      name: 'level',
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
    }
  ]);

  return level;
}

async function promptApiKey(toolName = '') {
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
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
    }
  ]);

  return apiKey.trim();
}

async function confirmConfiguration(config) {
  console.log(chalk.cyan('\n📋 Configuration Summary:'));
  console.log(chalk.gray('─'.repeat(40)));

  if (config.tool) {
    console.log(chalk.white(`Tool: ${config.tool}`));
  }
  if (config.level) {
    console.log(chalk.white(`Level: ${config.level}`));
  }
  if (config.baseUrl) {
    console.log(chalk.white(`Base URL: ${config.baseUrl}`));
  }
  if (config.apiKey) {
    console.log(chalk.white(`API Key: ${config.apiKey.substring(0, 10)}...${config.apiKey.slice(-4)}`));
  }

  console.log(chalk.gray('─'.repeat(40)));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with this configuration?',
      default: true
    }
  ]);

  return confirm;
}

async function promptRetry(message = 'Would you like to try again?') {
  const { retry } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'retry',
      message,
      default: true
    }
  ]);

  return retry;
}

module.exports = {
  promptToolSelection,
  promptSetupLevel,
  promptApiKey,
  confirmConfiguration,
  promptRetry
};