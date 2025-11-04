// Tool Installation Module
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';

async function installClaudeCode() {
  const spinner = ora('Installing Claude Code...').start();

  try {
    spinner.text = 'Installing @anthropic-ai/claude-code globally...';

    // Install Claude Code via npm
    execSync('npm install -g @anthropic-ai/claude-code', {
      stdio: 'pipe',
      encoding: 'utf8'
    });

    spinner.succeed(chalk.green('Claude Code installed successfully!'));
    console.log(chalk.gray('  You can now use: claude'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to install Claude Code'));
    console.error(chalk.gray(`Error: ${error.message}`));
    console.log(chalk.yellow('\nYou can install it manually with:'));
    console.log(chalk.white('  npm install -g @anthropic-ai/claude-code'));
    return false;
  }
}

/**
 * Install the OpenAI Codex CLI globally using npm.
 *
 * Attempts to install `@openai/codex` and reports success or failure to the user.
 * @returns {Promise<boolean>} `true` if installation succeeded, `false` otherwise.
 */
async function installCodex() {
  const spinner = ora('Installing Codex...').start();

  try {
    spinner.text = 'Installing @openai/codex globally...';

    // Install Codex via npm
    execSync('npm install -g @openai/codex', {
      stdio: 'pipe',
      encoding: 'utf8'
    });

    spinner.succeed(chalk.green('Codex installed successfully!'));
    console.log(chalk.gray('  You can now use: codex'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to install Codex'));
    console.error(chalk.gray(`Error: ${error.message}`));
    console.log(chalk.yellow('\nYou can install it manually with:'));
    console.log(chalk.white('  npm install -g @openai/codex'));
    return false;
  }
}

/**
 * Install the Open Code CLI (`opencode-ai`) globally.
 *
 * Attempts to install the `opencode-ai` package so the `opencode` command is available system-wide.
 * @returns {boolean} `true` if installation succeeded, `false` otherwise.
 */
async function installOpenCode() {
  const spinner = ora('Installing Open Code...').start();

  try {
    spinner.text = 'Installing opencode-ai globally...';

    // Install OpenCode via npm
    execSync('npm install -g opencode-ai', {
      stdio: 'pipe',
      encoding: 'utf8'
    });

    spinner.succeed(chalk.green('OpenCode installed successfully!'));
    console.log(chalk.gray('  You can now use: opencode'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to install OpenCode'));
    console.error(chalk.gray(`Error: ${error.message}`));
    console.log(chalk.yellow('\nYou can install it manually with:'));
    console.log(chalk.white('  npm install -g opencode-ai'));
    return false;
  }
}

/**
 * Prompt the user to install a tool and optionally print manual install instructions if declined.
 *
 * Prompts for confirmation to install the tool named by `toolName`; if the user declines, prints a suggested
 * manual `npm install -g ...` command based on the tool name and returns `false`.
 *
 * @param {string} toolName - The display name of the tool to offer for installation (used to tailor the manual install hint).
 * @returns {boolean} `true` if the user agrees to install the tool, `false` otherwise.
 */
async function promptInstallation(toolName) {
  console.log(chalk.yellow(`\n⚠ ${toolName} is not installed on your system.`));

  const shouldInstall = await confirm({
    message: `Would you like to install ${toolName} now?`,
    default: true
  });

  if (!shouldInstall) {
    console.log(chalk.gray('\nYou can install it manually later:'));
    if (toolName.includes('Claude')) {
      console.log(chalk.white('  npm install -g @anthropic-ai/claude-code'));
    } else if (toolName.includes('Codex')){
      console.log(chalk.white('  npm install -g @openai/codex'));
    } else {
      console.log(chalk.white('  npm install -g opencode-ai'))
    }
    return false;
  }

  return true;
}

export {
  installClaudeCode,
  installCodex,
  installOpenCode,
  promptInstallation
};