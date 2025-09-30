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

async function configureCodex(apiKey, level = 'system') {
  const spinner = ora('Configuring Codex...').start();

  try {
    // Determine config path based on level
    const configPath = getConfigPath('codex', level);

    if (!configPath) {
      throw new Error('Could not determine Codex configuration path');
    }

    spinner.text = `Reading existing configuration from ${configPath}...`;

    // Ensure directory exists
    await ensureDirectory(path.dirname(configPath));

    // Read existing config or create new
    let existingConfig = await readTomlFile(configPath) || {};

    // Prepare new configuration structure for Codex
    const newConfig = {
      ...existingConfig,
      api: {
        ...existingConfig.api,
        base_url: MEGALLM_BASE_URL,
        api_key: apiKey,
        provider: 'custom'
      },
      auth: {
        ...existingConfig.auth,
        provider: 'custom',
        endpoint: MEGALLM_BASE_URL,
        api_key: apiKey
      },
      model: {
        ...existingConfig.model,
        provider: 'anthropic-compatible',
        base_url: MEGALLM_BASE_URL
      }
    };

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
    console.log(chalk.gray(`  Base URL: ${MEGALLM_BASE_URL}`));
    console.log(chalk.gray(`  API Key: ${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`));

    // Special instructions for project-level config
    if (level === 'project') {
      console.log(chalk.yellow('\n⚠ Note: Project-level configuration created.'));
      console.log(chalk.gray('  This will only apply to the current project.'));

      // Add to .gitignore
      await addToGitignore('.codex/config.toml');
    }

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

    const hasBaseUrl = config.api?.base_url === MEGALLM_BASE_URL ||
                       config.auth?.endpoint === MEGALLM_BASE_URL;
    const hasApiKey = (config.api?.api_key && config.api?.api_key.length > 0) ||
                      (config.auth?.api_key && config.auth?.api_key.length > 0);

    if (!hasBaseUrl || !hasApiKey) {
      return {
        valid: false,
        error: 'Configuration incomplete',
        details: {
          baseUrl: hasBaseUrl,
          apiKey: hasApiKey
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