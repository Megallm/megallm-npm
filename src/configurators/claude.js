// Claude Code Configuration Module
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  readJsonFile,
  writeJsonFile,
  mergeJsonConfig,
  ensureDirectory
 } from '../utils/files.js';
import { getLastNCharacters } from '../utils/shell.js';
import { MEGALLM_BASE_URL, CONFIG_PATHS } from '../constants.js';
import { getConfigPath } from '../detectors/os.js';

async function configureClaude(apiKey, level = 'system') {
  const spinner = ora('Configuring Claude Code...').start();

  try {
    // Determine config path based on level
    const configPath = getConfigPath('claude', level);

    if (!configPath) {
      throw new Error('Could not determine Claude Code configuration path');
    }

    spinner.text = `Reading existing configuration from ${configPath}...`;

    // Ensure directory exists
    await ensureDirectory(path.dirname(configPath));

    // Read existing config or create new
    let existingConfig = await readJsonFile(configPath) || {};

    // Prepare new configuration for settings.json
    const newConfig = {
      env: {
        ...existingConfig.env,
        ANTHROPIC_BASE_URL: MEGALLM_BASE_URL,
        ANTHROPIC_API_KEY: apiKey
      }
    };

    // Merge configurations for settings.json
    const finalConfig = await mergeJsonConfig(existingConfig, newConfig);

    spinner.text = `Writing configuration to ${configPath}...`;

    // Write the settings.json configuration
    await writeJsonFile(configPath, finalConfig, true);

    // Now handle the .claude.json file for customApiKeyResponses
    const claudeJsonPath = CONFIG_PATHS.claude.apiKeys;
    spinner.text = `Updating API key approval in ${claudeJsonPath}...`;

    // Read existing .claude.json or create new
    let claudeJson = await readJsonFile(claudeJsonPath) || {};

    // Add API key approval for Claude Code
    const last20Chars = getLastNCharacters(apiKey, 20);

    if (!claudeJson.customApiKeyResponses) {
      claudeJson.customApiKeyResponses = {
        approved: [],
        rejected: []
      };
    }

    // Add to approved if not already there
    if (!claudeJson.customApiKeyResponses.approved) {
      claudeJson.customApiKeyResponses.approved = [];
    }
    if (!claudeJson.customApiKeyResponses.approved.includes(last20Chars)) {
      claudeJson.customApiKeyResponses.approved.push(last20Chars);
    }

    // Write the .claude.json file
    await writeJsonFile(claudeJsonPath, claudeJson, true);

    spinner.succeed(chalk.green('Claude Code configured successfully!'));

    // Show additional instructions
    console.log(chalk.cyan('\n📝 Configuration Details:'));
    console.log(chalk.gray(`  Settings file: ${configPath}`));
    console.log(chalk.gray(`  API keys file: ${claudeJsonPath}`));
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

export { configureClaude };
export { verifyClaudeConfig };