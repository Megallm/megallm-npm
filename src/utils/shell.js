// Shell Command Utilities
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import chalk from 'chalk';
import { getShellConfigFile } from '../detectors/os.js';

function reloadShell() {
  const platform = os.platform();

  if (platform === 'win32') {
    console.log(chalk.yellow('\n⚠ Please restart your terminal to apply the changes.'));
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

function setEnvironmentVariable(key, value, persistent = true) {
  // Set for current session
  process.env[key] = value;

  if (!persistent) return true;

  const platform = os.platform();

  try {
    if (platform === 'win32') {
      // Windows - set user environment variable
      execSync(`setx ${key} "${value}"`, { stdio: 'ignore' });
      return true;
    } else {
      // Unix-like systems - append to shell config
      const shellConfigFile = getShellConfigFile();

      const exportLine = `\n# MegaLLM Configuration\nexport ${key}="${value}"\n`;

      // Check if already exists and update or append
      if (fs.existsSync(shellConfigFile)) {
        let content = fs.readFileSync(shellConfigFile, 'utf8');
        const regex = new RegExp(`export ${key}=.*`, 'g');

        if (regex.test(content)) {
          // Update existing
          content = content.replace(regex, `export ${key}="${value}"`);
        } else {
          // Append new
          content += exportLine;
        }

        fs.writeFileSync(shellConfigFile, content);
      } else {
        // Create new file
        fs.writeFileSync(shellConfigFile, exportLine);
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