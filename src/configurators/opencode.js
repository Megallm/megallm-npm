// OpenCode Configuration Module
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  readJsonFile,
  writeJsonFile,
  mergeJsonConfig,
  ensureDirectory
} from '../utils/files.js';
import { getConfigPath } from '../detectors/os.js';

/**
 * Retrieve non-Anthropic models available via the MegaLLM API.
 *
 * @param {string} apiKey - MegaLLM API key used for Authorization.
 * @returns {Promise<Object>} An object mapping model IDs to `{ id, name }` for non-Anthropic models. If the API request fails, returns a predefined fallback set of non-Anthropic models.
 */
async function fetchMegaLLMModels(apiKey) {
  try {
    const response = await fetch('https://ai.megallm.io/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();

    // Organize models: only add non-Anthropic models since Anthropic models are auto-added
    const models = {};

    data.data.forEach(model => {
      // Skip Anthropic models as they will be auto-added by OpenCode
      if (model.owned_by === 'Anthropic') {
        return;
      }

      // Add non-Anthropic models with simplified structure
      models[model.id] = {
        id: model.id,
        name: `${model.display_name} (Via MegaLLM)`
      };
    });

    return models;
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not fetch models from MegaLLM API: ${error.message}`));
    console.log(chalk.gray('Falling back to default model configuration...'));

    // Fallback to a basic set of non-Anthropic models
    return {
      'gpt-5': {
        id: 'gpt-5',
        name: 'GPT-5 (Via MegaLLM)'
      },
      'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o (Via MegaLLM)'
      },
      'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini (Via MegaLLM)'
      }
    };
  }
}

/**
 * Detects OpenCode configuration files that reference MegaLLM and reports their locations and contents.
 * @returns {{ hasConfig: boolean, locations: string[], configs: { path: string, config: object }[] }} An object where `hasConfig` is `true` if any matching configuration was found, `locations` lists human-readable location strings (e.g., "System: /path/to/opencode.json"), and `configs` contains entries with the file `path` and parsed `config` object for each matching file.
 */
async function checkExistingOpenCodeConfig() {
  const results = {
    hasConfig: false,
    locations: [],
    configs: []
  };

  // Check system-level configuration
  const systemPath = getConfigPath('opencode', 'system');
  if (systemPath) {
    const systemConfig = await readJsonFile(systemPath);
    if (systemConfig?.provider?.anthropic?.options?.baseURL?.includes('megallm')) {
      results.hasConfig = true;
      results.locations.push(`System: ${systemPath}`);
      results.configs.push({ path: systemPath, config: systemConfig });
    }
  }

  // Check project-level configuration
  const projectPath = getConfigPath('opencode', 'project');
  if (projectPath) {
    const projectConfig = await readJsonFile(projectPath);
    if (projectConfig?.provider?.anthropic?.options?.baseURL?.includes('megallm')) {
      results.hasConfig = true;
      results.locations.push(`Project: ${projectPath}`);
      results.configs.push({ path: projectPath, config: projectConfig });
    }
  }

  return results;
}

/**
 * Configure OpenCode to use MegaLLM-backed Anthropic models and write the resulting configuration at the given level.
 * @param {string} apiKey - MegaLLM API key used to fetch available models.
 * @param {'system'|'project'} [level='system'] - Target configuration scope: 'system' writes a global config, 'project' writes a repo-local config.
 * @returns {boolean} `true` if the configuration was written successfully, `false` otherwise.
 */
async function configureOpenCode(apiKey, level = 'system') {
  const spinner = ora('Configuring OpenCode...').start();

  try {
    // Determine config path based on level
    const configPath = getConfigPath('opencode', level);

    if (!configPath) {
      throw new Error('Could not determine OpenCode configuration path');
    }

    spinner.text = 'Fetching available models from MegaLLM...';

    // Fetch models dynamically from MegaLLM API
    const models = await fetchMegaLLMModels(apiKey);

    spinner.text = `Reading existing configuration from ${configPath}...`;

    // Ensure directory exists
    await ensureDirectory(path.dirname(configPath));

    // Read existing config or create new
    let existingConfig = await readJsonFile(configPath) || {};

    // Prepare new configuration for OpenCode
    const newConfig = {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        ...existingConfig.provider,
        anthropic: {
          models: models,
          options: {
            apiKey: '{env:MEGALLM_API_KEY}',
            baseURL: 'https://ai.megallm.io/v1'
          }
        }
      },
      autoupdate: existingConfig.autoupdate ?? true,
      tools: {
        ...existingConfig.tools,
        bash: true,
        edit: true,
        write: true,
        read: true
      }
    };

    // Merge with existing config
    const finalConfig = await mergeJsonConfig(existingConfig, newConfig);

    spinner.text = `Writing configuration to ${configPath}...`;

    // Write the OpenCode configuration
    await writeJsonFile(configPath, finalConfig, true);

    spinner.succeed(chalk.green('OpenCode configured successfully!'));

    // Show additional instructions
    console.log(chalk.cyan('\n📝 Configuration Details:'));
    console.log(chalk.gray(`  Config file: ${configPath}`));
    console.log(chalk.gray(`  Base URL: https://ai.megallm.io/v1`));
    console.log(chalk.gray(`  API Key (env): MEGALLM_API_KEY=${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`));
    console.log(chalk.gray(`  Provider: anthropic`));
    console.log(chalk.gray(`  Models configured: ${Object.keys(models).length} non-Anthropic models`));
    console.log(chalk.gray(`  Config Level: ${level === 'system' ? 'System (global)' : 'Project (local)'}`));

    // Special instructions for project-level config
    if (level === 'project') {
      console.log(chalk.yellow('\n⚠ Note: Project-level configuration created.'));
      console.log(chalk.gray('  This will only apply to the current project.'));

      // Add to .gitignore
      await addToGitignore('opencode.json');
    }

    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to configure OpenCode'));
    console.error(chalk.red(`Error: ${error.message}`));
    return false;
  }
}

/**
 * Ensures a given pattern is present in the repository's .gitignore, appending it if missing.
 *
 * Appends a section header and the provided pattern to `.gitignore` when the pattern is not already present,
 * logs a gray confirmation message when added, and silently ignores any filesystem errors.
 *
 * @param {string} pattern - The gitignore pattern to add (e.g., "opencode.json").
 */
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

/**
 * Validate an OpenCode configuration file for use with MegaLLM's Anthropic provider.
 * @param {string} configPath - Filesystem path to the OpenCode JSON configuration.
 * @returns {{valid: true, config: Object} | {valid: false, error: string, details?: {baseUrl: boolean, apiKeyRef: boolean, apiKeySet: boolean}}}
 *   When valid: an object with `valid: true` and the parsed `config`.
 *   When invalid: an object with `valid: false` and an `error` message. For configuration-related failures the optional `details` object indicates:
 *     - `baseUrl`: `true` if `provider.anthropic.options.baseURL` equals "https://ai.megallm.io/v1".
 *     - `apiKeyRef`: `true` if `provider.anthropic.options.apiKey` equals "{env:MEGALLM_API_KEY}".
 *     - `apiKeySet`: `true` if the `MEGALLM_API_KEY` environment variable is present.
 */
async function verifyOpenCodeConfig(configPath) {
  try {
    const config = await readJsonFile(configPath);

    if (!config) {
      return { valid: false, error: 'Configuration file not found' };
    }

    const hasBaseUrl = config.provider?.anthropic?.options?.baseURL === 'https://ai.megallm.io/v1';
    const hasApiKeyRef = config.provider?.anthropic?.options?.apiKey === '{env:MEGALLM_API_KEY}';

    // Also check if MEGALLM_API_KEY is set in environment
    const { getEnvironmentVariable } = await import('../utils/shell.js');
    const apiKeySet = !!getEnvironmentVariable('MEGALLM_API_KEY');

    if (!hasBaseUrl || !hasApiKeyRef) {
      return {
        valid: false,
        error: 'Configuration incomplete',
        details: {
          baseUrl: hasBaseUrl,
          apiKeyRef: hasApiKeyRef,
          apiKeySet: apiKeySet
        }
      };
    }

    if (!apiKeySet) {
      return {
        valid: false,
        error: 'MEGALLM_API_KEY environment variable not set',
        details: {
          baseUrl: hasBaseUrl,
          apiKeyRef: hasApiKeyRef,
          apiKeySet: false
        }
      };
    }

    return { valid: true, config };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export { configureOpenCode };
export { verifyOpenCodeConfig };
export { checkExistingOpenCodeConfig };