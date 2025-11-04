// Shell Command Utilities
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import chalk from 'chalk';
import { getShellConfigFile } from '../detectors/os.js';

function reloadShell() {
  const platform = os.platform();

  if (platform === 'win32') {
    console.log(chalk.yellow('\n⚠ Environment variables have been set for both current and future sessions.'));
    console.log(chalk.cyan('✅ The changes are already active in this session.'));
    console.log(chalk.yellow('⚠ For other open terminals, please restart them to apply the changes.'));
    return false;
  }

  try {
    const shell = process.env.SHELL || '/bin/bash';
    const shellName = shell.split('/').pop();

    console.log(chalk.cyan(`\n🔄 Shell configuration updated`));
    console.log(chalk.yellow(`⚠ Please restart your terminal or run:`));

    switch (shellName) {
      case 'zsh':
        console.log(chalk.white(`   source ~/.zshrc`));
        break;
      case 'bash':
        console.log(chalk.white(`   source ~/.bashrc`));
        break;
      case 'fish':
        console.log(chalk.white(`   source ~/.config/fish/config.fish`));
        break;
      default:
        console.log(chalk.white(`   source ~/.bashrc`));
    }

    return true;
  } catch (error) {
    console.log(chalk.yellow('\n⚠ Please restart your terminal to apply the changes.'));
    return false;
  }
}

/**
 * Set an environment variable for the current process and optionally persist it for future sessions.
 *
 * @param {string} key - The environment variable name.
 * @param {string} value - The value to assign to the environment variable.
 * @param {boolean} [persistent=true] - If true, persist the variable so it is available in future sessions; if false, only set it for the current process.
 * @returns {boolean} `true` if the variable was set (and persisted when requested), `false` on failure.
 */
function setEnvironmentVariable(key, value, persistent = true) {
  // Set for current session
  process.env[key] = value;

  if (!persistent) return true;

  const platform = os.platform();

  try {
    if (platform === 'win32') {
      // Windows - set for both current session and future sessions
      // Set for future sessions using setx
      execSync(`setx ${key} "${value}"`, { stdio: 'ignore' });

      // Also set for current PowerShell session using $env:
      // This ensures the variable is available immediately
      try {
        execSync(`powershell -Command "$env:${key}='${value}'"`, { stdio: 'ignore' });
      } catch (psError) {
        // If PowerShell fails, try using set command for cmd
        try {
          execSync(`set ${key}=${value}`, { stdio: 'ignore' });
        } catch (cmdError) {
          // Silently continue - setx will still work for future sessions
        }
      }
      return true;
    } else {
      // Unix-like systems - append to shell config
      const shellConfigFile = getShellConfigFile();

      const exportLine = `export ${key}="${value}"`;

      // Check if already exists and update or append
      if (fs.existsSync(shellConfigFile)) {
        let content = fs.readFileSync(shellConfigFile, 'utf8');
        const regex = new RegExp(`export ${key}=.*`, 'g');

        if (regex.test(content)) {
          // Update existing
          content = content.replace(regex, exportLine);
        } else {
          // Append new - only add comment if it doesn't exist
          const megallmCommentExists = content.includes('# MegaLLM Configuration');
          if (!megallmCommentExists) {
            content += `\n# MegaLLM Configuration\n${exportLine}\n`;
          } else {
            // Find the MegaLLM Configuration section and append there
            const megallmSectionRegex = /(# MegaLLM Configuration\n(?:export [A-Z_]+=.*\n)*)/;
            if (megallmSectionRegex.test(content)) {
              content = content.replace(megallmSectionRegex, `$1${exportLine}\n`);
            } else {
              // Fallback: just append at the end
              content += `${exportLine}\n`;
            }
          }
        }

        fs.writeFileSync(shellConfigFile, content);
      } else {
        // Create new file
        const exportBlock = `# MegaLLM Configuration\n${exportLine}\n`;
        fs.writeFileSync(shellConfigFile, exportBlock);
      }

      return true;
    }
  } catch (error) {
    console.error(chalk.red(`Failed to set environment variable: ${error.message}`));
    return false;
  }
}

function getEnvironmentVariable(key) {
  return process.env[key] || null;
}

function validateApiKey(apiKey) {
  // Basic validation for API key format
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  if (apiKey.length < 20) {
    return { valid: false, error: 'API key seems too short' };
  }

  // Check for common patterns
  if (apiKey.includes(' ') && !apiKey.startsWith('Bearer ')) {
    return { valid: false, error: 'API key contains spaces' };
  }

  return { valid: true };
}

function getLastNCharacters(str, n = 20) {
  if (!str || str.length <= n) return str;
  return str.slice(-n);
}

export { reloadShell };
export { setEnvironmentVariable };
export { getEnvironmentVariable };
export { validateApiKey };
export { getLastNCharacters };