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
import { setEnvironmentVariable } from '../utils/shell.js';

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

    // Remove old api, auth, and model sections if they exist
    delete newConfig.api;
    delete newConfig.auth;
    delete newConfig.model;

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

    // Set the MEGALLM_API_KEY environment variable
    spinner.text = 'Setting MEGALLM_API_KEY environment variable...';
    setEnvironmentVariable('MEGALLM_API_KEY', apiKey, true);

    spinner.succeed(chalk.green('Codex configured successfully!'));

    // Show additional instructions
    console.log(chalk.cyan('\n📝 Configuration Details:'));
    console.log(chalk.gray(`  Config file: ${configPath}`));
    console.log(chalk.gray(`  Model Provider: megallm`));
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