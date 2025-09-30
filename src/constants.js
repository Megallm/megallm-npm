// Constants for MegaLLM setup
const os = require('os');
const path = require('path');

const MEGALLM_BASE_URL = 'https://ai.megallm.io';

const CONFIG_PATHS = {
  claude: {
    user: path.join(os.homedir(), '.claude', 'settings.json'),
    project: '.claude/settings.json',
    projectLocal: '.claude/settings.local.json'
  },
  codex: {
    user: path.join(os.homedir(), '.codex', 'config.toml'),
    project: '.codex/config.toml'
  }
};

const SHELL_CONFIG_FILES = {
  bash: '.bashrc',
  zsh: '.zshrc',
  fish: '.config/fish/config.fish',
  powershell: 'Microsoft.PowerShell_profile.ps1'
};

const TOOLS = {
  CLAUDE_CODE: 'Claude Code',
  CODEX: 'Codex',
  BOTH: 'Both'
};

const SETUP_LEVELS = {
  PROJECT: 'Project-level',
  SYSTEM: 'System-level'
};

module.exports = {
  MEGALLM_BASE_URL,
  CONFIG_PATHS,
  SHELL_CONFIG_FILES,
  TOOLS,
  SETUP_LEVELS
};