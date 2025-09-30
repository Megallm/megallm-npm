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
    } else {
      console.log(chalk.white('  npm install -g @openai/codex'));
    }
    return false;
  }

  return true;
}

export {
  installClaudeCode,
  installCodex,
  promptInstallation
};