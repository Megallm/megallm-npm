// Tool Installation Module
import { execSync } from 'child_process';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';

async function installClaudeCode() {
  const spinner = ora('Installing Claude Code...').start();

  try {
    const platform = os.platform();

    if (platform === 'darwin') {
      // macOS installation
      spinner.text = 'Downloading Claude Code for macOS...';

      // Check if Homebrew is available
      try {
        execSync('which brew', { stdio: 'ignore' });
        // Use Homebrew if available
        execSync('brew install --cask claude', { stdio: 'pipe' });
      } catch {
        // Direct download from Claude
        spinner.text = 'Opening Claude Code download page...';
        execSync('open https://claude.ai/download');
        spinner.info('Please download and install Claude Code from the opened webpage');

        const installed = await confirm({
          message: 'Have you completed the Claude Code installation?',
          default: false
        });

        if (!installed) {
          throw new Error('Installation cancelled by user');
        }
      }
    } else if (platform === 'win32') {
      // Windows installation
      spinner.text = 'Opening Claude Code download page for Windows...';
      execSync('start https://claude.ai/download', { shell: true });
      spinner.info('Please download and install Claude Code from the opened webpage');

      const installed = await confirm({
        message: 'Have you completed the Claude Code installation?',
        default: false
      });

      if (!installed) {
        throw new Error('Installation cancelled by user');
      }
    } else {
      // Linux installation
      spinner.text = 'Downloading Claude Code for Linux...';

      // Try different package managers
      try {
        // Check for snap
        execSync('which snap', { stdio: 'ignore' });
        execSync('sudo snap install claude --classic', { stdio: 'pipe' });
      } catch {
        try {
          // Check for apt
          execSync('which apt', { stdio: 'ignore' });
          execSync('wget -qO- https://claude.ai/install.sh | sh', { stdio: 'pipe' });
        } catch {
          // Fallback to browser
          spinner.text = 'Opening Claude Code download page...';
          execSync('xdg-open https://claude.ai/download', { stdio: 'pipe' });
          spinner.info('Please download and install Claude Code from the opened webpage');

          const installed = await confirm({
            message: 'Have you completed the Claude Code installation?',
            default: false
          });

          if (!installed) {
            throw new Error('Installation cancelled by user');
          }
        }
      }
    }

    spinner.succeed(chalk.green('Claude Code installation completed!'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to install Claude Code'));
    console.error(chalk.gray(`Error: ${error.message}`));
    return false;
  }
}

async function installCodex() {
  const spinner = ora('Installing Windsurf (Codex)...').start();

  try {
    const platform = os.platform();

    if (platform === 'darwin') {
      // macOS installation
      spinner.text = 'Downloading Windsurf for macOS...';

      // Direct download from Codeium
      spinner.text = 'Opening Windsurf download page...';
      execSync('open https://codeium.com/windsurf/download');
      spinner.info('Please download and install Windsurf from the opened webpage');

      const installed = await confirm({
        message: 'Have you completed the Windsurf installation?',
        default: false
      });

      if (!installed) {
        throw new Error('Installation cancelled by user');
      }
    } else if (platform === 'win32') {
      // Windows installation
      spinner.text = 'Opening Windsurf download page for Windows...';
      execSync('start https://codeium.com/windsurf/download', { shell: true });
      spinner.info('Please download and install Windsurf from the opened webpage');

      const installed = await confirm({
        message: 'Have you completed the Windsurf installation?',
        default: false
      });

      if (!installed) {
        throw new Error('Installation cancelled by user');
      }
    } else {
      // Linux installation
      spinner.text = 'Opening Windsurf download page for Linux...';

      try {
        execSync('xdg-open https://codeium.com/windsurf/download', { stdio: 'pipe' });
      } catch {
        console.log(chalk.yellow('\nPlease visit: https://codeium.com/windsurf/download'));
      }

      spinner.info('Please download and install Windsurf from the opened webpage');

      const installed = await confirm({
        message: 'Have you completed the Windsurf installation?',
        default: false
      });

      if (!installed) {
        throw new Error('Installation cancelled by user');
      }
    }

    spinner.succeed(chalk.green('Windsurf (Codex) installation completed!'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to install Windsurf (Codex)'));
    console.error(chalk.gray(`Error: ${error.message}`));
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
    console.log(chalk.gray('You can install it manually later from:'));
    if (toolName.includes('Claude')) {
      console.log(chalk.cyan('  https://claude.ai/download'));
    } else {
      console.log(chalk.cyan('  https://codeium.com/windsurf/download'));
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