// Claude Code Configuration Module
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const {
  readJsonFile,
  writeJsonFile,
  mergeJsonConfig,
  ensureDirectory
} = require('../utils/files');
const { getLastNCharacters } = require('../utils/shell');
const { MEGALLM_BASE_URL } = require('../constants');

async function configureClaude(apiKey, level = 'system') {
  const spinner = ora('Configuring Claude Code...').start();

  try {
    // Determine config path based on level
    const { getConfigPath } = require('../detectors/os');
    const configPath = getConfigPath('claude', level);

    if (!configPath) {
      throw new Error('Could not determine Claude Code configuration path');
    }

    spinner.text = `Reading existing configuration from ${configPath}...`;

    // Ensure directory exists
    await ensureDirectory(path.dirname(configPath));

    // Read existing config or create new
    let existingConfig = await readJsonFile(configPath) || {};

    // Prepare new configuration
    const newConfig = {
      env: {
        ...existingConfig.env,
        ANTHROPIC_BASE_URL: MEGALLM_BASE_URL,
        ANTHROPIC_API_KEY: apiKey
      }
    };

    // Add API key approval for Claude Code
    const last20Chars = getLastNCharacters(apiKey, 20);
    if (!newConfig.customApiKeyResponses) {
      newConfig.customApiKeyResponses = {
        approved: [],
        rejected: []
      };
    }

    // Add to approved if not already there
    if (!newConfig.customApiKeyResponses.approved) {
      newConfig.customApiKeyResponses.approved = [];
    }
    if (!newConfig.customApiKeyResponses.approved.includes(last20Chars)) {
      newConfig.customApiKeyResponses.approved.push(last20Chars);
    }

    // Merge configurations
    const finalConfig = await mergeJsonConfig(existingConfig, newConfig);

    spinner.text = `Writing configuration to ${configPath}...`;

    // Write the configuration
    await writeJsonFile(configPath, finalConfig, true);

    spinner.succeed(chalk.green('Claude Code configured successfully!'));

    // Show additional instructions
    console.log(chalk.cyan('\n📝 Configuration Details:'));
    console.log(chalk.gray(`  Config file: ${configPath}`));
    console.log(chalk.gray(`  Base URL: ${MEGALLM_BASE_URL}`));
    console.log(chalk.gray(`  API Key: ${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`));

    // Special instructions for project-level config
    if (level === 'project') {
      console.log(chalk.yellow('\n⚠ Note: Project-level configuration created.'));
      console.log(chalk.gray('  This will only apply to the current project.'));

      // Add to .gitignore if it's local settings
      if (configPath.includes('settings.local.json')) {
        await addToGitignore('.claude/settings.local.json');
      }
    }

    return true;
  } catch (error) {
    spinner.fail(chalk.red('Failed to configure Claude Code'));
    console.error(chalk.red(`Error: ${error.message}`));
    return false;
  }
}

async function addToGitignore(pattern) {
  const fs = require('fs-extra');
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

async function verifyClaudeConfig(configPath) {
  try {
    const config = await readJsonFile(configPath);

    if (!config) {
      return { valid: false, error: 'Configuration file not found' };
    }

    const hasBaseUrl = config.env?.ANTHROPIC_BASE_URL === MEGALLM_BASE_URL;
    const hasApiKey = config.env?.ANTHROPIC_API_KEY && config.env.ANTHROPIC_API_KEY.length > 0;

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

module.exports = {
  configureClaude,
  verifyClaudeConfig
};