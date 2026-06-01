import { select, confirm, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { SETUP_LEVELS } from '../constants.js';
import { exec } from 'child_process';

/* ---------------------------
   UI HELPERS (NEW IMPROVEMENT)
---------------------------- */

function divider(color = chalk.white) {
  console.log(color('═'.repeat(50)));
}

function title(text, color = chalk.cyan) {
  console.log('\n' + color(text));
}

function info(text, color = chalk.white) {
  console.log(color(text));
}

function warning(text) {
  console.log(chalk.yellow(text));
}

/* ---------------------------
   TOOL SELECTION
---------------------------- */

export async function promptToolSelection(availableTools = []) {
  title('🔧 Tool Selection', chalk.cyan);

  if (!availableTools.length) {
    warning("⚠ No tools detected, using default configuration...\n");

    const tool = await select({
      message: 'Which tool would you like to configure?',
      choices: [
        { name: 'Claude Code', value: 'claude' },
        { name: 'Codex', value: 'codex' },
        { name: 'Open Code', value: 'opencode' },
        { name: 'All Tools', value: 'all' }
      ]
    });

    return tool;
  }

  const choices = availableTools.map(t => ({
    name: t.name,
    value: t.key
  }));

  if (availableTools.length === 2) {
    choices.push({ name: 'Configure Both', value: 'both' });
  }

  if (availableTools.length >= 3) {
    choices.push({ name: 'Configure All', value: 'all' });
  }

  return await select({
    message: 'Select tool to configure:',
    choices
  });
}

/* ---------------------------
   SETUP LEVEL
---------------------------- */

export async function promptSetupLevel() {
  title('⚙ Setup Level');

  return await select({
    message: 'Choose setup level:',
    choices: [
      {
        name: 'System-level (all projects)',
        value: SETUP_LEVELS.SYSTEM
      },
      {
        name: 'Project-level (current project)',
        value: SETUP_LEVELS.PROJECT
      }
    ],
    default: SETUP_LEVELS.SYSTEM
  });
}

/* ---------------------------
   API KEY FLOW (IMPROVED UX)
---------------------------- */

export async function promptApiKey(toolName = '') {
  title('API Key Setup');

  const hasKey = await confirm({
    message: 'Do you already have a MegaLLM API key?',
    default: false
  });

  if (!hasKey) {
    warning('\nOpening MegaLLM dashboard...\n');

    const url = 'https://megallm.io';

    try {
      const openCmd =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
          ? 'start'
          : 'xdg-open';

      exec(`${openCmd} ${url}`);
    } catch (err) {
      warning('Could not open browser automatically.');
      info(`Visit manually: ${url}`);
    }

    divider(chalk.gray);

    info('Steps to get your API key:');
    info('1. Sign up / Login');
    info('2. Go to API Keys section');
    info('3. Generate new key');
    info('4. Copy and paste it here');

    divider(chalk.gray);

    const continueSetup = await confirm({
      message: 'Ready to enter your API key?',
      default: true
    });

    if (!continueSetup) {
      warning('\nSetup cancelled.');
      process.exit(0);
    }
  }

  const apiKey = await password({
    message: `Enter API key${toolName ? ` for ${toolName}` : ''}:`,
    mask: '*',
    validate: (val) => {
      if (!val?.trim()) return 'API key required';
      if (val.length < 20) return 'Invalid API key length';
      return true;
    }
  });

  return apiKey.trim();
}

/* ---------------------------
   CONFIRM CONFIG
---------------------------- */

export async function confirmConfiguration(config) {
  title('Configuration Summary');

  divider();

  Object.entries(config).forEach(([key, value]) => {
    if (!value) return;

    let displayValue = value;

    if (key === 'apiKey') {
      displayValue = `${value.slice(0, 8)}...${value.slice(-4)}`;
    }

    info(`${key}: ${displayValue}`);
  });

  divider();

  return await confirm({
    message: 'Proceed with this configuration?',
    default: true
  });
}

/* ---------------------------
   RETRY PROMPT
---------------------------- */

export async function promptRetry(message = 'Would you like to try again?') {
  return await confirm({
    message,
    default: true
  });
}

/* ---------------------------
   EXISTING CONFIG HANDLING
---------------------------- */

export async function promptExistingConfigAction(locations = []) {
  warning('\n Existing configuration detected');

  title('Found at:');
  locations.forEach(loc => info(`• ${loc}`, chalk.gray));

  divider();

  return await select({
    message: 'What would you like to do?',
    choices: [
      {
        name: 'Override (replace old config)',
        value: 'override'
      },
      {
        name: 'Skip (keep existing config)',
        value: 'skip'
      },
      {
        name: 'Cancel setup',
        value: 'cancel'
      }
    ],
    default: 'skip'
  });
}

/* ---------------------------
   CONFIRM OVERRIDE
---------------------------- */

export async function confirmOverride(locations = []) {
  title('Dangerous Action', chalk.red);

  warning('This will remove configuration from:');
  locations.forEach(loc => info(`• ${loc}`, chalk.yellow));

  divider(chalk.red);

  warning('This action cannot be undone!');

  return await confirm({
    message: 'Are you sure you want to continue?',
    default: false
  });
}

/* ---------------------------
   STATUSLINE SETUP
---------------------------- */

export async function promptStatuslineSetup() {
  title('🎨 Claude Code Statusline');

  info('Enhance your terminal with:');
  info('• Git branch info');
  info('• Model details');
  info('• Token usage tracking');
  info('• Cost monitoring');
  info('• Session analytics');

  divider();

  return await confirm({
    message: 'Enable statusline setup?',
    default: true
  });
}
