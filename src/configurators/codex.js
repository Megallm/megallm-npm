// Codex Configuration Module
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  readTomlFile,
  writeTomlFile,
  ensureDirectory
 } from '../utils/files.js';
import { MEGALLM_BASE_URL } from '../constants.js';
import { getConfigPath } from '../detectors/os.js';

/**
 * Detect whether a system-level Codex configuration enables the MegaLLM provider.
 *
 * @returns {{hasConfig: boolean, locations: string[], configs: {path: string, config: Object}[]}} An object describing discovered configurations:
 * - `hasConfig`: `true` if a system-level Codex config referencing MegaLLM was found, `false` otherwise.
 * - `locations`: list of human-readable locations where matching configurations were found (e.g., `"System: /path/to/config"`).
 * - `configs`: list of objects with `path` (file path) and `config` (parsed TOML configuration) for each match.
 */
async function checkExistingCodexConfig() {
  const results = {
    hasConfig: false,
    locations: [],
    configs: []
  };

  // Check system-level configuration (Codex only uses system level)
  const systemPath = getConfigPath('codex', 'system');
  if (systemPath) {
    const systemConfig = await readTomlFile(systemPath);

    // Check if MegaLLM is configured
    if (systemConfig?.model_provider === 'megallm' ||
        systemConfig?.model_providers?.megallm ||
        systemConfig?.api?.base_url?.includes('megallm')) {
      results.hasConfig = true;
      results.locations.push(`System: ${systemPath}`);
      results.configs.push({ path: systemPath, config: systemConfig });
    }
  }

  return results;
}

/**
 * Write a Codex configuration that enables the MegaLLM model provider and persists it to the system config path.
 *
 * @param {string} apiKey - The MEGALLM API key used for display/masking in the output (not written to the environment).
 * @param {string} [level='system'] - Requested configuration level; this function always writes to the system (global) config path regardless of this value.
 * @returns {boolean} `true` if the configuration was written and reported successfully, `false` otherwise.
 */
async function configureCodex(apiKey, level = 'system') {
  const spinner = ora('Configuring Codex...').start();

  try {
    // Force system-level configuration only for Codex
    const configPath = getConfigPath('codex', 'system');

    if (!configPath) {
      throw new Error('Could not determine Codex configuration path');
    }

    spinner.text = `Reading existing configuration from ${configPath}...`;

    // Ensure directory exists
    await ensureDirectory(path.dirname(configPath));

    // Read existing config or create new
    let existingConfig = await readTomlFile(configPath) || {};

    // Remove any existing model_provider if it exists
    if (existingConfig.model_provider) {
      delete existingConfig.model_provider;
    }

    // Prepare new configuration structure for Codex with MegaLLM model provider
    const newConfig = {
      ...existingConfig,
      model_provider: 'megallm',
      model: 'gpt-5',
      model_providers: {
        ...existingConfig.model_providers,
        megallm: {
          name: 'OpenAI using Chat Completions',
          base_url: 'https://ai.megallm.io/v1',
          env_key: 'MEGALLM_API_KEY',
          query_params: {}
        }
      }
    };

    // Remove old api and auth sections if they exist (but keep model)
    delete newConfig.api;
    delete newConfig.auth;

    // Add additional Codex-specific settings
    if (!newConfig.tools) {
      newConfig.tools = {};
    }

    // Enable useful tools by default
    newConfig.tools.web_search = true;
    newConfig.tools.file_browser = true;

    spinner.text = `Writing configuration to ${configPath}...`;

    // Write the TOML configuration
    await writeTomlFile(configPath, newConfig, true);

    spinner.succeed(chalk.green('Codex configured successfully!'));

    // Show additional instructions
    console.log(chalk.cyan('\n📝 Configuration Details:'));
    console.log(chalk.gray(`  Config file: ${configPath}`));
    console.log(chalk.gray(`  Model Provider: megallm`));
    console.log(chalk.gray(`  Model: gpt-5`));
    console.log(chalk.gray(`  Base URL: https://ai.megallm.io/v1`));
    console.log(chalk.gray(`  API Key (env): MEGALLM_API_KEY=${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`));
    console.log(chalk.gray(`  Config Level: System (global)`));

    // Additional Windsurf-specific instructions if detected
    if (await isWindsurf()) {
      console.log(chalk.cyan('\n🌊 Windsurf detected!'));
      console.log(chalk.gray('  Restart Windsurf for changes to take effect.'));
    }

    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to configure Codex'));
    console.error(chalk.red(`Error: ${error.message}`));
    return false;
  }
}

async function isWindsurf() {
  const { default: fs } = await import('fs-extra');

  if (process.platform === 'darwin') {
    return await fs.pathExists('/Applications/Windsurf.app');
  } else if (process.platform === 'win32') {
    const winPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Windsurf');
    return await fs.pathExists(winPath);
  }

  return false;
}

async function addToGitignore(pattern) {
  const { default: fs } = await import('fs-extra');
  const gitignorePath = '.gitignore';

  try {
    let content = '';
    if (await fs.pathExists(gitignorePath)) {
      content = await fs.readFile(gitignorePath, 'utf8');
    }

    if (!content.includes(pattern)) {
      content += `\n# MegaLLM Configuration\n${pattern}\n`;
      await fs.writeFile(gitignorePath, content);
      console.log(chalk.gray(`  Added ${pattern} to .gitignore`));
    }
  } catch (error) {
    // Ignore errors with .gitignore
  }
}

async function verifyCodexConfig(configPath) {
  try {
    const config = await readTomlFile(configPath);

    if (!config) {
      return { valid: false, error: 'Configuration file not found' };
    }

    // Check for new model provider structure
    const hasModelProvider = config.model_provider === 'megallm';
    const hasMegallmConfig = config.model_providers?.megallm?.base_url === 'https://ai.megallm.io/v1';
    const hasEnvKey = config.model_providers?.megallm?.env_key === 'MEGALLM_API_KEY';

    // Also check if MEGALLM_API_KEY is set in environment
    const { getEnvironmentVariable } = await import('../utils/shell.js');
    const apiKeySet = !!getEnvironmentVariable('MEGALLM_API_KEY');

    if (!hasModelProvider || !hasMegallmConfig || !hasEnvKey) {
      return {
        valid: false,
        error: 'Configuration incomplete',
        details: {
          modelProvider: hasModelProvider,
          megallmConfig: hasMegallmConfig,
          envKey: hasEnvKey,
          apiKeySet: apiKeySet
        }
      };
    }

    if (!apiKeySet) {
      return {
        valid: false,
        error: 'MEGALLM_API_KEY environment variable not set',
        details: {
          modelProvider: hasModelProvider,
          megallmConfig: hasMegallmConfig,
          envKey: hasEnvKey,
          apiKeySet: false
        }
      };
    }

    return { valid: true, config };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export { configureCodex };
export { verifyCodexConfig };
export { isWindsurf };
export { checkExistingCodexConfig };