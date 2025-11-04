// Environment Variable Detection and Cleanup Module
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Detect existing MegaLLM-related environment variables across the system.
 *
 * Scans the current process environment and platform-specific locations (Windows registry and PowerShell profiles on Windows; common shell and system environment files on Unix-like systems) for ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, and MEGALLM_API_KEY. Detection errors are logged as warnings but do not cause the function to throw.
 *
 * @returns {{ANTHROPIC_BASE_URL: Array<Object>, ANTHROPIC_API_KEY: Array<Object>, MEGALLM_API_KEY: Array<Object>, hasExisting: boolean}}
 * An object with:
 * - `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `MEGALLM_API_KEY`: arrays of detected entries. Each entry is an object containing:
 *   - `source` (string): where the value was found (e.g., "current_process", "config_file", "registry", "shell_env").
 *   - `value` (string): display value; API keys are masked for display.
 *   - `rawValue` (string, optional): the unmasked API key when available.
 *   - `location` (string): descriptive location (file path, "Current shell session", registry hive, etc.).
 * - `hasExisting`: `true` if any of the three arrays contains at least one entry, `false` otherwise.
 */
export async function detectExistingEnvVars() {
  const platform = os.platform();
  const results = {
    ANTHROPIC_BASE_URL: [],
    ANTHROPIC_API_KEY: [],
    MEGALLM_API_KEY: [],
    hasExisting: false
  };

  try {
    // Check current process environment
    if (process.env.ANTHROPIC_BASE_URL) {
      results.ANTHROPIC_BASE_URL.push({
        source: 'current_process',
        value: process.env.ANTHROPIC_BASE_URL,
        location: 'Current shell session'
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      results.ANTHROPIC_API_KEY.push({
        source: 'current_process',
        value: maskApiKey(process.env.ANTHROPIC_API_KEY),
        rawValue: process.env.ANTHROPIC_API_KEY,
        location: 'Current shell session'
      });
    }

    if (process.env.MEGALLM_API_KEY) {
      results.MEGALLM_API_KEY.push({
        source: 'current_process',
        value: maskApiKey(process.env.MEGALLM_API_KEY),
        rawValue: process.env.MEGALLM_API_KEY,
        location: 'Current shell session'
      });
    }

    if (platform === 'win32') {
      await detectWindowsEnvVars(results);
    } else {
      await detectUnixEnvVars(results);
    }

    // Check if any existing variables were found
    results.hasExisting = results.ANTHROPIC_BASE_URL.length > 0 ||
                         results.ANTHROPIC_API_KEY.length > 0 ||
                         results.MEGALLM_API_KEY.length > 0;

  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not fully detect environment variables: ${error.message}`));
  }

  return results;
}

/**
 * Detect MegaLLM-related environment variables in Windows registry and PowerShell profiles and append any findings to the provided results object.
 *
 * Finds occurrences of ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, and MEGALLM_API_KEY in user and system registry locations and in common PowerShell profile files, and pushes entries into the corresponding arrays on the results object.
 *
 * @param {Object} results - Mutable results container to populate. Expected to have arrays for `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, and `MEGALLM_API_KEY`; this function appends objects describing each discovery (fields include `source`, `value`, optional `rawValue` for API keys, and `location`).
 */
async function detectWindowsEnvVars(results) {
  // Check Windows Registry (User variables)
  try {
    const userEnvResult = await execAsync('reg query "HKEY_CURRENT_USER\\Environment"', { encoding: 'utf8' });

    if (userEnvResult.stdout.includes('ANTHROPIC_BASE_URL')) {
      const match = userEnvResult.stdout.match(/ANTHROPIC_BASE_URL\s+REG_\w+\s+(.+)/);
      if (match) {
        results.ANTHROPIC_BASE_URL.push({
          source: 'windows_registry_user',
          value: match[1].trim(),
          location: 'Windows Registry (User)'
        });
      }
    }

    if (userEnvResult.stdout.includes('ANTHROPIC_API_KEY')) {
      const match = userEnvResult.stdout.match(/ANTHROPIC_API_KEY\s+REG_\w+\s+(.+)/);
      if (match) {
        const apiKey = match[1].trim();
        results.ANTHROPIC_API_KEY.push({
          source: 'windows_registry_user',
          value: maskApiKey(apiKey),
          rawValue: apiKey,
          location: 'Windows Registry (User)'
        });
      }
    }

    if (userEnvResult.stdout.includes('MEGALLM_API_KEY')) {
      const match = userEnvResult.stdout.match(/MEGALLM_API_KEY\s+REG_\w+\s+(.+)/);
      if (match) {
        const apiKey = match[1].trim();
        results.MEGALLM_API_KEY.push({
          source: 'windows_registry_user',
          value: maskApiKey(apiKey),
          rawValue: apiKey,
          location: 'Windows Registry (User)'
        });
      }
    }
  } catch (error) {
    // Registry query might fail if keys don't exist
  }

  // Check Windows Registry (System variables)
  try {
    const systemEnvResult = await execAsync('reg query "HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Control\\Session Manager\\Environment"', { encoding: 'utf8' });

    if (systemEnvResult.stdout.includes('ANTHROPIC_BASE_URL')) {
      const match = systemEnvResult.stdout.match(/ANTHROPIC_BASE_URL\s+REG_\w+\s+(.+)/);
      if (match) {
        results.ANTHROPIC_BASE_URL.push({
          source: 'windows_registry_system',
          value: match[1].trim(),
          location: 'Windows Registry (System)'
        });
      }
    }

    if (systemEnvResult.stdout.includes('ANTHROPIC_API_KEY')) {
      const match = systemEnvResult.stdout.match(/ANTHROPIC_API_KEY\s+REG_\w+\s+(.+)/);
      if (match) {
        const apiKey = match[1].trim();
        results.ANTHROPIC_API_KEY.push({
          source: 'windows_registry_system',
          value: maskApiKey(apiKey),
          rawValue: apiKey,
          location: 'Windows Registry (System)'
        });
      }
    }

    if (systemEnvResult.stdout.includes('MEGALLM_API_KEY')) {
      const match = systemEnvResult.stdout.match(/MEGALLM_API_KEY\s+REG_\w+\s+(.+)/);
      if (match) {
        const apiKey = match[1].trim();
        results.MEGALLM_API_KEY.push({
          source: 'windows_registry_system',
          value: maskApiKey(apiKey),
          rawValue: apiKey,
          location: 'Windows Registry (System)'
        });
      }
    }
  } catch (error) {
    // Registry query might fail if no admin permissions
  }

  // Check all PowerShell profiles
  const psProfiles = [
    // Current user - Windows PowerShell 5.1
    { name: 'PowerShell Profile', path: path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1') },
    { name: 'PowerShell Profile (All Hosts)', path: path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'profile.ps1') },

    // Current user - PowerShell Core/7+
    { name: 'PowerShell Core Profile', path: path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1') },
    { name: 'PowerShell Core Profile (All Hosts)', path: path.join(os.homedir(), 'Documents', 'PowerShell', 'profile.ps1') },

    // All users profiles (may not have access)
    { name: 'PowerShell System Profile', path: path.join(process.env.ALLUSERSPROFILE || 'C:\\ProgramData', 'Microsoft', 'Windows', 'PowerShell', 'profile.ps1') }
  ];

  for (const profile of psProfiles) {
    if (fs.existsSync(profile.path)) {
      try {
        const content = fs.readFileSync(profile.path, 'utf8');
        checkFileForEnvVars(content, results, profile.name, profile.path);
      } catch (error) {
        // May not have permission to read some profiles
      }
    }
  }
}

/**
 * Scan common Unix-like and macOS shell/system configuration files and the current shell session for
 * ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, and MEGALLM_API_KEY, and record any discoveries in `results`.
 *
 * @param {Object} results - Mutable detector results object to populate.
 *   The function appends entries to `results.ANTHROPIC_BASE_URL`, `results.ANTHROPIC_API_KEY`, and
 *   `results.MEGALLM_API_KEY`. Each entry includes at minimum a `source` and `location`; API key
 *   entries also include a masked `value` and, when available, `rawValue`.
 */
async function detectUnixEnvVars(results) {
  const homeDir = os.homedir();
  const shell = process.env.SHELL || '/bin/bash';
  const shellName = path.basename(shell);

  // Shell configuration files to check
  const shellConfigs = [
    { name: 'Bash (.bashrc)', path: path.join(homeDir, '.bashrc') },
    { name: 'Bash (.bash_profile)', path: path.join(homeDir, '.bash_profile') },
    { name: 'Zsh (.zshrc)', path: path.join(homeDir, '.zshrc') },
    { name: 'Zsh (.zprofile)', path: path.join(homeDir, '.zprofile') },
    { name: 'Fish', path: path.join(homeDir, '.config', 'fish', 'config.fish') },
    { name: 'System (/etc/environment)', path: '/etc/environment' },
    { name: 'Profile (.profile)', path: path.join(homeDir, '.profile') }
  ];

  // macOS specific
  if (os.platform() === 'darwin') {
    shellConfigs.push(
      { name: 'macOS Zsh (.zshenv)', path: path.join(homeDir, '.zshenv') },
      { name: 'macOS Path', path: '/etc/paths.d/megallm' }
    );
  }

  // Check each configuration file
  for (const config of shellConfigs) {
    if (fs.existsSync(config.path)) {
      try {
        const content = fs.readFileSync(config.path, 'utf8');
        checkFileForEnvVars(content, results, config.name, config.path);
      } catch (error) {
        // File might not be readable
      }
    }
  }

  // Check if variables are set in current shell session
  try {
    const envOutput = execSync('env | grep -E "(ANTHROPIC|MEGALLM)"', { encoding: 'utf8' });
    const lines = envOutput.split('\n').filter(line => line);

    for (const line of lines) {
      if (line.startsWith('ANTHROPIC_BASE_URL=')) {
        const value = line.substring('ANTHROPIC_BASE_URL='.length);
        const existing = results.ANTHROPIC_BASE_URL.find(r => r.value === value && r.source === 'shell_env');
        if (!existing) {
          results.ANTHROPIC_BASE_URL.push({
            source: 'shell_env',
            value: value,
            location: 'Shell environment'
          });
        }
      }

      if (line.startsWith('ANTHROPIC_API_KEY=')) {
        const value = line.substring('ANTHROPIC_API_KEY='.length);
        const existing = results.ANTHROPIC_API_KEY.find(r => r.rawValue === value && r.source === 'shell_env');
        if (!existing) {
          results.ANTHROPIC_API_KEY.push({
            source: 'shell_env',
            value: maskApiKey(value),
            rawValue: value,
            location: 'Shell environment'
          });
        }
      }

      if (line.startsWith('MEGALLM_API_KEY=')) {
        const value = line.substring('MEGALLM_API_KEY='.length);
        const existing = results.MEGALLM_API_KEY.find(r => r.rawValue === value && r.source === 'shell_env');
        if (!existing) {
          results.MEGALLM_API_KEY.push({
            source: 'shell_env',
            value: maskApiKey(value),
            rawValue: value,
            location: 'Shell environment'
          });
        }
      }
    }
  } catch (error) {
    // grep might fail if no matches
  }
}

/**
 * Scan file text for MegaLLM-related environment variable definitions and record any findings in the results object.
 *
 * Detects ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, and MEGALLM_API_KEY assignments in the provided file content and appends entries to the corresponding arrays on `results`.
 *
 * Each appended entry has:
 * - `source: 'config_file'`
 * - `location`: `${sourceName} (${filePath})`
 * - For URL entries: `value` set to the detected URL.
 * - For API key entries: `value` set to a masked display string and `rawValue` set to the full detected key.
 *
 * @param {string} content - The file contents to scan.
 * @param {Object} results - Object collecting detections; expected to have arrays `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, and `MEGALLM_API_KEY`.
 * @param {string} sourceName - A short label describing the source (e.g., "bashrc", "PowerShell profile").
 * @param {string} filePath - The path to the file scanned, used in the recorded `location`.
 */
function checkFileForEnvVars(content, results, sourceName, filePath) {
  // Check for ANTHROPIC_BASE_URL
  const baseUrlPatterns = [
    /export\s+ANTHROPIC_BASE_URL\s*=\s*["']?([^"'\n]+)["']?/g,
    /ANTHROPIC_BASE_URL\s*=\s*["']?([^"'\n]+)["']?/g,
    /\$env:ANTHROPIC_BASE_URL\s*=\s*["']?([^"'\n]+)["']?/g,
    /set\s+ANTHROPIC_BASE_URL\s*=\s*["']?([^"'\n]+)["']?/g
  ];

  for (const pattern of baseUrlPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const value = match[1].trim();
      const existing = results.ANTHROPIC_BASE_URL.find(r =>
        r.value === value && r.location === `${sourceName} (${filePath})`
      );
      if (!existing) {
        results.ANTHROPIC_BASE_URL.push({
          source: 'config_file',
          value: value,
          location: `${sourceName} (${filePath})`
        });
      }
    }
  }

  // Check for ANTHROPIC_API_KEY
  const apiKeyPatterns = [
    /export\s+ANTHROPIC_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g,
    /ANTHROPIC_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g,
    /\$env:ANTHROPIC_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g,
    /set\s+ANTHROPIC_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g
  ];

  for (const pattern of apiKeyPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const value = match[1].trim();
      const existing = results.ANTHROPIC_API_KEY.find(r =>
        r.rawValue === value && r.location === `${sourceName} (${filePath})`
      );
      if (!existing) {
        results.ANTHROPIC_API_KEY.push({
          source: 'config_file',
          value: maskApiKey(value),
          rawValue: value,
          location: `${sourceName} (${filePath})`
        });
      }
    }
  }

  // Check for MEGALLM_API_KEY
  const megallmKeyPatterns = [
    /export\s+MEGALLM_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g,
    /MEGALLM_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g,
    /\$env:MEGALLM_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g,
    /set\s+MEGALLM_API_KEY\s*=\s*["']?([^"'\n]+)["']?/g
  ];

  for (const pattern of megallmKeyPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const value = match[1].trim();
      const existing = results.MEGALLM_API_KEY.find(r =>
        r.rawValue === value && r.location === `${sourceName} (${filePath})`
      );
      if (!existing) {
        results.MEGALLM_API_KEY.push({
          source: 'config_file',
          value: maskApiKey(value),
          rawValue: value,
          location: `${sourceName} (${filePath})`
        });
      }
    }
  }
}

/**
 * Remove specified environment variables from the current process and common system configuration locations.
 *
 * @param {string[]} variables - Names of environment variables to remove. Defaults to ['ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'MEGALLM_API_KEY'].
 * @returns {{success: boolean, removed: Array<{variable: string, location: string}>, errors: string[]}} An object describing the outcome: `success` is true when no unhandled errors occurred, `removed` lists each removed variable and its location, and `errors` contains any error messages encountered.
 */
export async function removeEnvVars(variables = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'MEGALLM_API_KEY']) {
  const platform = os.platform();
  const results = {
    success: true,
    removed: [],
    errors: []
  };

  try {
    // Remove from current process
    for (const varName of variables) {
      if (process.env[varName]) {
        delete process.env[varName];
        results.removed.push({ variable: varName, location: 'Current process' });
      }
    }

    if (platform === 'win32') {
      await removeWindowsEnvVars(variables, results);
    } else {
      await removeUnixEnvVars(variables, results);
    }
  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Remove MegaLLM configuration files
 */
export async function removeConfigurationFiles() {
  const fs = (await import('fs-extra')).default;
  const results = {
    removed: [],
    errors: []
  };

  try {
    // Import configuration checkers
    const { checkExistingClaudeConfig } = await import('../configurators/claude.js');
    const { checkExistingCodexConfig } = await import('../configurators/codex.js');

    // Check Claude configurations
    const claudeConfig = await checkExistingClaudeConfig();
    for (const configItem of claudeConfig.configs) {
      try {
        // Read the existing config
        const config = configItem.config;

        // Remove MegaLLM specific configuration
        if (config?.env) {
          delete config.env.ANTHROPIC_BASE_URL;
          delete config.env.ANTHROPIC_API_KEY;

          // If env is now empty, remove it
          if (Object.keys(config.env).length === 0) {
            delete config.env;
          }
        }

        // For API keys file, clear approved keys
        if (config?.customApiKeyResponses?.approved) {
          config.customApiKeyResponses.approved = [];
        }

        // Write back the cleaned config or remove if empty
        if (Object.keys(config).length === 0) {
          await fs.remove(configItem.path);
          results.removed.push({ file: configItem.path, action: 'deleted' });
        } else {
          await fs.writeJson(configItem.path, config, { spaces: 2 });
          results.removed.push({ file: configItem.path, action: 'cleaned' });
        }
      } catch (error) {
        results.errors.push(`Failed to clean ${configItem.path}: ${error.message}`);
      }
    }

    // Check Codex configurations
    const codexConfig = await checkExistingCodexConfig();
    for (const configItem of codexConfig.configs) {
      try {
        const config = configItem.config;

        // Remove MegaLLM provider
        if (config?.model_provider === 'megallm') {
          delete config.model_provider;
        }

        if (config?.model_providers?.megallm) {
          delete config.model_providers.megallm;
        }

        // Write back the cleaned config
        const toml = (await import('@iarna/toml')).default;
        const tomlStr = toml.stringify(config);
        await fs.writeFile(configItem.path, tomlStr);
        results.removed.push({ file: configItem.path, action: 'cleaned' });
      } catch (error) {
        results.errors.push(`Failed to clean ${configItem.path}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Configuration file cleanup failed: ${error.message}`);
  }

  return results;
}

/**
 * Remove environment variables on Windows
 */
async function removeWindowsEnvVars(variables, results) {
  // Step 1: Remove from Windows Registry (User)
  for (const varName of variables) {
    try {
      await execAsync(`reg delete "HKEY_CURRENT_USER\\Environment" /v ${varName} /f`);
      results.removed.push({ variable: varName, location: 'Windows Registry (User)' });
    } catch (error) {
      // Variable might not exist, which is fine
    }
  }

  // Step 2: Remove from Windows Registry (System) - requires admin
  for (const varName of variables) {
    try {
      await execAsync(`reg delete "HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Control\\Session Manager\\Environment" /v ${varName} /f`);
      results.removed.push({ variable: varName, location: 'Windows Registry (System)' });
    } catch (error) {
      // Might fail due to permissions or non-existence
      if (error.message && !error.message.includes('not find')) {
        results.errors.push(`System registry cleanup may require admin rights`);
      }
    }
  }

  // Step 3: Remove from current PowerShell session
  try {
    for (const varName of variables) {
      await execAsync(`powershell -Command "Remove-Item Env:${varName} -ErrorAction SilentlyContinue"`);
    }
    results.removed.push({ variable: 'ANTHROPIC_*', location: 'Current PowerShell session' });
  } catch (error) {
    // Silently ignore if PowerShell command fails
  }

  // Step 4: Remove from all PowerShell profiles
  const psProfiles = [
    // Current user - Windows PowerShell 5.1
    path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'profile.ps1'),

    // Current user - PowerShell Core/7+
    path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(os.homedir(), 'Documents', 'PowerShell', 'profile.ps1'),

    // All users - Windows PowerShell 5.1
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'profile.ps1'),
    path.join(process.env.ALLUSERSPROFILE || 'C:\\ProgramData', 'Microsoft', 'Windows', 'PowerShell', 'profile.ps1'),

    // All users - PowerShell Core/7+
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'Microsoft.PowerShell_profile.ps1')
  ];

  for (const profilePath of psProfiles) {
    if (fs.existsSync(profilePath)) {
      try {
        let content = fs.readFileSync(profilePath, 'utf8');
        let modified = false;

        for (const varName of variables) {
          const patterns = [
            // PowerShell $env: syntax
            new RegExp(`\\$env:${varName}\\s*=\\s*["']?[^"'\n]*["']?\\s*\n?`, 'g'),
            // Set-Item cmdlet
            new RegExp(`Set-Item\\s+-Path\\s+Env:${varName}\\s+-Value\\s+["']?[^"'\n]*["']?\\s*\n?`, 'g'),
            // [Environment]::SetEnvironmentVariable
            new RegExp(`\\[Environment\\]::SetEnvironmentVariable\\(["']${varName}["'],\\s*["'][^"']*["'],\\s*["'][^"']*["']\\)\\s*\n?`, 'g'),
            // MegaLLM comment block with the variable
            new RegExp(`# MegaLLM Configuration\\s*\n\\$env:${varName}\\s*=.*\n?`, 'g')
          ];

          for (const pattern of patterns) {
            if (pattern.test(content)) {
              content = content.replace(pattern, '');
              modified = true;
            }
          }
        }

        // Clean up empty MegaLLM comment blocks
        content = content.replace(/# MegaLLM Configuration\s*\n(?=\s*\n|$)/g, '');
        content = content.replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines

        if (modified) {
          fs.writeFileSync(profilePath, content, 'utf8');
          results.removed.push({ variable: 'ANTHROPIC_*', location: `PowerShell Profile (${path.basename(profilePath)})` });
        }
      } catch (error) {
        // May not have permission to modify some profiles
        if (!error.message.includes('ENOENT')) {
          results.errors.push(`Could not modify ${profilePath}: Permission denied`);
        }
      }
    }
  }

  // Step 5: Broadcast WM_SETTINGCHANGE to notify all windows of environment change
  try {
    await execAsync(`powershell -Command "[Environment]::SetEnvironmentVariable('MEGALLM_CLEANUP', $null, 'User')"`);
    // This triggers a refresh of environment variables in Windows
  } catch (error) {
    // Ignore errors
  }

  // Step 6: Notify user to restart applications
  console.log(chalk.yellow('\n⚠ Windows environment variables updated:'));
  console.log(chalk.cyan('  • New terminal windows will use the updated settings'));
  console.log(chalk.cyan('  • Existing applications may need to be restarted'));
  console.log(chalk.cyan('  • For immediate effect, please restart your terminal/IDE'));
}

/**
 * Remove environment variables on Unix-like systems
 */
async function removeUnixEnvVars(variables, results) {
  const homeDir = os.homedir();
  const configFiles = [
    path.join(homeDir, '.bashrc'),
    path.join(homeDir, '.bash_profile'),
    path.join(homeDir, '.zshrc'),
    path.join(homeDir, '.zprofile'),
    path.join(homeDir, '.zshenv'),
    path.join(homeDir, '.profile'),
    path.join(homeDir, '.config', 'fish', 'config.fish')
  ];

  for (const filePath of configFiles) {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      for (const varName of variables) {
        const patterns = [
          new RegExp(`export\\s+${varName}\\s*=.*\n?`, 'g'),
          new RegExp(`${varName}\\s*=.*\n?export\\s+${varName}\n?`, 'g'),
          new RegExp(`set\\s+-x\\s+${varName}.*\n?`, 'g'), // Fish shell
          new RegExp(`# MegaLLM Configuration\n?export\\s+${varName}.*\n?`, 'g')
        ];

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, '');
            modified = true;
          }
        }
      }

      // Clean up empty MegaLLM comment blocks
      content = content.replace(/# MegaLLM Configuration\n(?=\n|$)/g, '');

      if (modified) {
        fs.writeFileSync(filePath, content);
        results.removed.push({ variable: 'ANTHROPIC_*', location: path.basename(filePath) });
      }
    }
  }

  // Remove from /etc/environment if we have permissions
  if (fs.existsSync('/etc/environment')) {
    try {
      let content = fs.readFileSync('/etc/environment', 'utf8');
      let modified = false;

      for (const varName of variables) {
        const pattern = new RegExp(`${varName}\\s*=.*\n?`, 'g');
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync('/etc/environment', content);
        results.removed.push({ variable: 'ANTHROPIC_*', location: '/etc/environment' });
      }
    } catch (error) {
      // Might not have permissions
      results.errors.push(`Could not modify /etc/environment: ${error.message}`);
    }
  }
}

/**
 * Mask API key for display
 */
function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 10) return apiKey;
  return `${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`;
}

/**
 * Check if MegaLLM is already configured
 */
export async function checkExistingConfiguration() {
  // Dynamically import the configurator functions to avoid circular dependencies
  const { checkExistingClaudeConfig } = await import('../configurators/claude.js');
  const { checkExistingCodexConfig } = await import('../configurators/codex.js');

  const envVars = await detectExistingEnvVars();
  const claudeConfig = await checkExistingClaudeConfig();
  const codexConfig = await checkExistingCodexConfig();

  const config = {
    isConfigured: false,
    hasBaseUrl: false,
    hasApiKey: false,
    baseUrlValue: null,
    apiKeyValue: null,
    locations: []
  };

  // Check for base URL
  if (envVars.ANTHROPIC_BASE_URL.length > 0) {
    config.hasBaseUrl = true;
    config.baseUrlValue = envVars.ANTHROPIC_BASE_URL[0].value;

    // Check if it's already pointing to MegaLLM
    if (config.baseUrlValue && config.baseUrlValue.includes('megallm')) {
      config.isConfigured = true;
    }
  }

  // Check for API key
  if (envVars.ANTHROPIC_API_KEY.length > 0) {
    config.hasApiKey = true;
    config.apiKeyValue = envVars.ANTHROPIC_API_KEY[0].rawValue;
  }

  // Check Claude configuration files
  if (claudeConfig.hasConfig) {
    config.isConfigured = true;
    config.locations.push(...claudeConfig.locations);
  }

  // Check Codex configuration files
  if (codexConfig.hasConfig) {
    config.isConfigured = true;
    config.locations.push(...codexConfig.locations);
  }

  // Collect all locations where configuration was found
  const allLocations = new Set();
  [...envVars.ANTHROPIC_BASE_URL, ...envVars.ANTHROPIC_API_KEY].forEach(item => {
    allLocations.add(item.location);
  });

  // Add file locations
  config.locations.forEach(loc => allLocations.add(loc));

  config.locations = Array.from(allLocations);

  return config;
}