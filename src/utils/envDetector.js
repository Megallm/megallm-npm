// Environment Variable Detection and Cleanup Module
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Detect existing MegaLLM environment variables across all platforms
 */
export async function detectExistingEnvVars() {
  const platform = os.platform();
  const results = {
    ANTHROPIC_BASE_URL: [],
    ANTHROPIC_API_KEY: [],
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

    if (platform === 'win32') {
      await detectWindowsEnvVars(results);
    } else {
      await detectUnixEnvVars(results);
    }

    // Check if any existing variables were found
    results.hasExisting = results.ANTHROPIC_BASE_URL.length > 0 ||
                         results.ANTHROPIC_API_KEY.length > 0;

  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not fully detect environment variables: ${error.message}`));
  }

  return results;
}

/**
 * Detect environment variables on Windows
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
  } catch (error) {
    // Registry query might fail if no admin permissions
  }

  // Check PowerShell profile
  const psProfilePath = path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
  if (fs.existsSync(psProfilePath)) {
    const content = fs.readFileSync(psProfilePath, 'utf8');
    checkFileForEnvVars(content, results, 'PowerShell Profile', psProfilePath);
  }

  // Check newer PowerShell Core profile
  const pwshProfilePath = path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  if (fs.existsSync(pwshProfilePath)) {
    const content = fs.readFileSync(pwshProfilePath, 'utf8');
    checkFileForEnvVars(content, results, 'PowerShell Core Profile', pwshProfilePath);
  }
}

/**
 * Detect environment variables on Unix-like systems
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
    const envOutput = execSync('env | grep ANTHROPIC', { encoding: 'utf8' });
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
    }
  } catch (error) {
    // grep might fail if no matches
  }
}

/**
 * Check file content for environment variables
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
}

/**
 * Remove environment variables from all locations
 */
export async function removeEnvVars(variables = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY']) {
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
  for (const varName of variables) {
    // Remove from User registry
    try {
      await execAsync(`reg delete "HKEY_CURRENT_USER\\Environment" /v ${varName} /f`);
      results.removed.push({ variable: varName, location: 'Windows Registry (User)' });
    } catch (error) {
      // Variable might not exist
    }

    // Remove from System registry (requires admin)
    try {
      await execAsync(`reg delete "HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Control\\Session Manager\\Environment" /v ${varName} /f`);
      results.removed.push({ variable: varName, location: 'Windows Registry (System)' });
    } catch (error) {
      // Might fail due to permissions or non-existence
    }
  }

  // Remove from PowerShell profiles
  const psProfiles = [
    path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
  ];

  for (const profilePath of psProfiles) {
    if (fs.existsSync(profilePath)) {
      let content = fs.readFileSync(profilePath, 'utf8');
      let modified = false;

      for (const varName of variables) {
        const patterns = [
          new RegExp(`\\$env:${varName}\\s*=.*\n?`, 'g'),
          new RegExp(`Set-Item -Path Env:${varName}.*\n?`, 'g')
        ];

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, '');
            modified = true;
          }
        }
      }

      if (modified) {
        fs.writeFileSync(profilePath, content);
        results.removed.push({ variable: 'ANTHROPIC_*', location: `PowerShell Profile (${profilePath})` });
      }
    }
  }
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