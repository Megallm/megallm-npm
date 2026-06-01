// Environment Detection & Cleanup Utilities

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

const ENV_VARIABLES = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'MEGALLM_API_KEY'
];

const MASKED_KEYS = [
  'ANTHROPIC_API_KEY',
  'MEGALLM_API_KEY'
];

const SHELL_CONFIG_FILES = [
  '.bashrc',
  '.bash_profile',
  '.zshrc',
  '.zprofile',
  '.profile'
];

function createResultsObject() {
  return {
    ANTHROPIC_BASE_URL: [],
    ANTHROPIC_API_KEY: [],
    MEGALLM_API_KEY: [],
    hasExisting: false
  };
}

function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 10) {
    return apiKey;
  }

  return `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
}

function addResult(results, key, entry) {
  const exists = results[key].some(
    item =>
      item.location === entry.location &&
      item.value === entry.value
  );

  if (!exists) {
    results[key].push(entry);
  }
}

function createEntry(key, value, source, location) {
  const isSensitive = MASKED_KEYS.includes(key);

  return {
    source,
    location,
    value: isSensitive ? maskApiKey(value) : value,
    rawValue: isSensitive ? value : undefined
  };
}

function scanContent(content, sourceName, filePath, results) {
  for (const envVar of ENV_VARIABLES) {
    const patterns = [
      new RegExp(`export\\s+${envVar}\\s*=\\s*["']?([^"'\\n]+)["']?`, 'g'),
      new RegExp(`${envVar}\\s*=\\s*["']?([^"'\\n]+)["']?`, 'g'),
      new RegExp(`\\$env:${envVar}\\s*=\\s*["']?([^"'\\n]+)["']?`, 'g'),
      new RegExp(`set\\s+${envVar}\\s*=\\s*["']?([^"'\\n]+)["']?`, 'g')
    ];

    for (const pattern of patterns) {
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const value = match[1].trim();

        addResult(
          results,
          envVar,
          createEntry(
            envVar,
            value,
            'config_file',
            `${sourceName} (${filePath})`
          )
        );
      }
    }
  }
}

async function scanFile(filePath, sourceName, results) {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    scanContent(content, sourceName, filePath, results);
  } catch (error) {
    console.debug(
      `[MegaLLM Debug] Failed to scan ${filePath}: ${error.message}`
    );
  }
}

async function detectProcessEnvironment(results) {
  for (const envVar of ENV_VARIABLES) {
    const value = process.env[envVar];

    if (!value) {
      continue;
    }

    addResult(
      results,
      envVar,
      createEntry(
        envVar,
        value,
        'current_process',
        'Current shell session'
      )
    );
  }
}

async function detectUnixEnvVars(results) {
  const homeDir = os.homedir();

  for (const config of SHELL_CONFIG_FILES) {
    const filePath = path.join(homeDir, config);

    await scanFile(filePath, config, results);
  }

  await scanFile(
    path.join(homeDir, '.config', 'fish', 'config.fish'),
    'fish',
    results
  );

  await scanFile('/etc/environment', 'system_env', results);
}

async function detectWindowsRegistry(results) {
  const registryLocations = [
    {
      path: 'HKEY_CURRENT_USER\\Environment',
      source: 'windows_registry_user',
      label: 'Windows Registry (User)'
    },
    {
      path: 'HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Control\\Session Manager\\Environment',
      source: 'windows_registry_system',
      label: 'Windows Registry (System)'
    }
  ];

  for (const registry of registryLocations) {
    try {
      const { stdout } = await execAsync(
        `reg query "${registry.path}"`,
        { encoding: 'utf8' }
      );

      for (const envVar of ENV_VARIABLES) {
        const regex = new RegExp(
          `${envVar}\\s+REG_\\w+\\s+(.+)`
        );

        const match = stdout.match(regex);

        if (!match) {
          continue;
        }

        const value = match[1].trim();

        addResult(
          results,
          envVar,
          createEntry(
            envVar,
            value,
            registry.source,
            registry.label
          )
        );
      }
    } catch (error) {
      console.debug(
        `[MegaLLM Debug] Registry scan failed: ${error.message}`
      );
    }
  }
}

async function detectWindowsProfiles(results) {
  const profiles = [
    path.join(
      os.homedir(),
      'Documents',
      'PowerShell',
      'Microsoft.PowerShell_profile.ps1'
    ),

    path.join(
      os.homedir(),
      'Documents',
      'WindowsPowerShell',
      'Microsoft.PowerShell_profile.ps1'
    )
  ];

  for (const profile of profiles) {
    await scanFile(profile, 'powershell_profile', results);
  }
}

export async function detectExistingEnvVars() {
  const results = createResultsObject();

  try {
    await detectProcessEnvironment(results);

    if (os.platform() === 'win32') {
      await detectWindowsRegistry(results);
      await detectWindowsProfiles(results);
    } else {
      await detectUnixEnvVars(results);
    }

    results.hasExisting = ENV_VARIABLES.some(
      key => results[key].length > 0
    );

  } catch (error) {
    console.error(
      chalk.yellow(
        `Warning: Environment detection incomplete: ${error.message}`
      )
    );
  }

  return results;
}

export function getEnvironmentSummary() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    shell: process.env.SHELL || process.env.ComSpec || 'unknown',

    isCI: Boolean(process.env.CI),

    isDocker:
      fs.existsSync('/.dockerenv') ||
      fs.existsSync('/proc/self/cgroup'),

    isWSL: Boolean(process.env.WSL_DISTRO_NAME),

    isVSCode: Boolean(
      process.env.VSCODE_GIT_IPC_HANDLE
    ),

    isCursor: Boolean(
      process.env.CURSOR_TRACE_ID
    ),

    nodeVersion: process.version
  };
}

export async function removeEnvVars(
  variables = ENV_VARIABLES
) {
  const results = {
    success: true,
    removed: [],
    errors: []
  };

  try {
    for (const variable of variables) {
      delete process.env[variable];

      results.removed.push({
        variable,
        location: 'Current process'
      });
    }

    if (os.platform() === 'win32') {
      for (const variable of variables) {
        try {
          await execAsync(
            `reg delete "HKEY_CURRENT_USER\\Environment" /v ${variable} /f`
          );
        } catch (error) {
          console.debug(
            `[MegaLLM Debug] Failed to remove ${variable}: ${error.message}`
          );
        }
      }
    }

  } catch (error) {
    results.success = false;

    results.errors.push(error.message);
  }

  return results;
}

export async function checkExistingConfiguration() {
  const envVars = await detectExistingEnvVars();

  const config = {
    isConfigured: false,
    hasBaseUrl: false,
    hasApiKey: false,
    baseUrlValue: null,
    apiKeyValue: null,
    locations: []
  };

  if (envVars.ANTHROPIC_BASE_URL.length > 0) {
    config.hasBaseUrl = true;

    config.baseUrlValue =
      envVars.ANTHROPIC_BASE_URL[0].value;
  }

  if (envVars.ANTHROPIC_API_KEY.length > 0) {
    config.hasApiKey = true;

    config.apiKeyValue =
      envVars.ANTHROPIC_API_KEY[0].rawValue;
  }

  config.locations = [
    ...envVars.ANTHROPIC_BASE_URL.map(v => v.location),
    ...envVars.ANTHROPIC_API_KEY.map(v => v.location),
    ...envVars.MEGALLM_API_KEY.map(v => v.location)
  ];

  config.locations = [...new Set(config.locations)];

  config.isConfigured =
    config.hasBaseUrl ||
    config.hasApiKey;

  return config;
}
