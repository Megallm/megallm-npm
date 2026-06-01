```js
// Shell Command Utilities

import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import chalk from 'chalk';
import { getShellConfigFile } from '../detectors/os.js';

/* -------------------------------------------------------
   UI HELPERS
------------------------------------------------------- */

function logInfo(message) {
  console.log(chalk.cyan(message));
}

function logWarning(message) {
  console.log(chalk.yellow(message));
}

function logError(message) {
  console.log(chalk.red(message));
}

function logSuccess(message) {
  console.log(chalk.green(message));
}

/* -------------------------------------------------------
   SHELL DETECTION
------------------------------------------------------- */

/**
 * Detect active shell environment and platform details.
 */
function detectShell() {
  const shellPath =
    process.env.SHELL ||
    process.env.ComSpec ||
    'unknown';

  const shellName = shellPath.split(/[\\/]/).pop();

  return {
    path: shellPath,
    name: shellName,
    platform: os.platform(),
    isWindows: os.platform() === 'win32',
    isMac: os.platform() === 'darwin',
    isLinux: os.platform() === 'linux'
  };
}

/* -------------------------------------------------------
   SAFE SHELL COMMAND EXECUTION
------------------------------------------------------- */

/**
 * Execute shell commands safely with timeout handling.
 *
 * @param {string} command
 * @param {Object} options
 * @param {number} [options.timeout=15000]
 * @param {boolean} [options.verbose=false]
 * @returns {{
 *   success: boolean,
 *   output?: string,
 *   error?: string
 * }}
 */
function runShellCommand(command, options = {}) {
  const {
    timeout = 15000,
    verbose = false
  } = options;

  try {
    if (verbose) {
      logInfo(`\n⚡ Executing: ${command}`);
    }

    const output = execSync(command, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return {
      success: true,
      output: output.trim()
    };

  } catch (error) {
    return {
      success: false,
      error:
        error.stderr?.toString()?.trim() ||
        error.message ||
        'Unknown shell execution error'
    };
  }
}

/* -------------------------------------------------------
   SHELL RELOAD
------------------------------------------------------- */

/**
 * Show shell reload instructions to the user.
 */
function reloadShell() {
  const shell = detectShell();

  if (shell.isWindows) {
    logWarning('\n⚠ Environment variables updated.');
    logSuccess('✅ Changes are active for future sessions.');
    logWarning('⚠ Restart open terminals to apply changes.');
    return false;
  }

  try {
    logInfo('\n🔄 Shell configuration updated');
    logWarning('⚠ Restart terminal or run:\n');

    switch (shell.name) {
      case 'zsh':
        console.log(chalk.white('source ~/.zshrc'));
        break;

      case 'bash':
        console.log(chalk.white('source ~/.bashrc'));
        break;

      case 'fish':
        console.log(
          chalk.white('source ~/.config/fish/config.fish')
        );
        break;

      default:
        console.log(chalk.white('source ~/.bashrc'));
    }

    return true;

  } catch {
    logWarning(
      '\n⚠ Please restart your terminal manually.'
    );

    return false;
  }
}

/* -------------------------------------------------------
   ENVIRONMENT VARIABLE MANAGEMENT
------------------------------------------------------- */

/**
 * Persist environment variables across sessions.
 *
 * @param {string} key
 * @param {string} value
 * @param {boolean} [persistent=true]
 * @returns {boolean}
 */
function setEnvironmentVariable(
  key,
  value,
  persistent = true
) {
  process.env[key] = value;

  if (!persistent) {
    return true;
  }

  const shell = detectShell();

  try {

    /* -----------------------------
       WINDOWS
    ----------------------------- */

    if (shell.isWindows) {

      const setxResult = runShellCommand(
        `setx ${key} "${value}"`
      );

      if (!setxResult.success) {
        throw new Error(setxResult.error);
      }

      return true;
    }

    /* -----------------------------
       UNIX-LIKE SYSTEMS
    ----------------------------- */

    const shellConfigFile = getShellConfigFile();

    const exportLine = `export ${key}="${value}"`;

    let content = '';

    if (fs.existsSync(shellConfigFile)) {
      content = fs.readFileSync(
        shellConfigFile,
        'utf8'
      );
    }

    const regex = new RegExp(
      `export ${key}=.*`,
      'g'
    );

    if (regex.test(content)) {

      // Replace existing variable
      content = content.replace(regex, exportLine);

    } else {

      // Append MegaLLM block
      if (!content.includes('# MegaLLM Configuration')) {
        content += `

# MegaLLM Configuration
${exportLine}
`;
      } else {
        content += `${exportLine}\n`;
      }
    }

    fs.writeFileSync(shellConfigFile, content);

    return true;

  } catch (error) {

    logError(
      `Failed to set environment variable: ${error.message}`
    );

    return false;
  }
}

/* -------------------------------------------------------
   ENV HELPERS
------------------------------------------------------- */

/**
 * Get environment variable.
 *
 * @param {string} key
 * @returns {string|null}
 */
function getEnvironmentVariable(key) {
  return process.env[key] || null;
}

/**
 * Validate API key format.
 *
 * @param {string} apiKey
 * @returns {{
 *   valid: boolean,
 *   error?: string
 * }}
 */
function validateApiKey(apiKey) {

  if (!apiKey || !apiKey.trim()) {
    return {
      valid: false,
      error: 'API key cannot be empty'
    };
  }

  if (apiKey.length < 20) {
    return {
      valid: false,
      error: 'API key seems too short'
    };
  }

  if (
    apiKey.includes(' ') &&
    !apiKey.startsWith('Bearer ')
  ) {
    return {
      valid: false,
      error: 'API key contains spaces'
    };
  }

  return {
    valid: true
  };
}

/**
 * Get last N characters from string.
 *
 * @param {string} str
 * @param {number} [n=20]
 * @returns {string}
 */
function getLastNCharacters(str, n = 20) {

  if (!str || str.length <= n) {
    return str;
  }

  return str.slice(-n);
}

/* -------------------------------------------------------
   EXPORTS
------------------------------------------------------- */

export {
  reloadShell,
  setEnvironmentVariable,
  getEnvironmentVariable,
  validateApiKey,
  getLastNCharacters,
  detectShell,
  runShellCommand
};
```
