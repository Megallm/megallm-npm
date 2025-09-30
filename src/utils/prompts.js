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