// Constants for MegaLLM setup
import os from 'os';
import path from 'path';

export const MEGALLM_BASE_URL = 'https://ai.megallm.io';

export const CONFIG_PATHS = {
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

export const SHELL_CONFIG_FILES = {
  bash: '.bashrc',
  zsh: '.zshrc',
  fish: '.config/fish/config.fish',
  powershell: 'Microsoft.PowerShell_profile.ps1'
};

export const TOOLS = {
  CLAUDE_CODE: 'Claude Code',
  CODEX: 'Codex',
  BOTH: 'Both'
};

export const SETUP_LEVELS = {
  PROJECT: 'Project-level',
  SYSTEM: 'System-level'
};