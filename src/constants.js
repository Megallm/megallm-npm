// Constants for MegaLLM setup
import os from 'os';
import path from 'path';

// API base URL the configured tools (Claude/Codex/OpenCode) talk to.
export const MEGALLM_BASE_URL = 'https://ai.megallm.io';

// Web app URL — hosts the OAuth provider, /activate page, and dashboard.
// Override at runtime with MEGALLM_WEB_URL for local development.
export const MEGALLM_WEB_URL = process.env.MEGALLM_WEB_URL || 'https://megallm.io';

// OAuth client_id for the MegaLLM CLI. Register the app once at
// /dashboard/developers (public app, PKCE-only) and paste the client_id here,
// or override per-environment with MEGALLM_CLI_CLIENT_ID.
export const OAUTH_CLIENT_ID =
  process.env.MEGALLM_CLI_CLIENT_ID || 'mega_pub_cli';

// Scopes the CLI requests at login. All four are needed for the AWS-CLI-style
// command surface (login, whoami, orgs, switch-org, keys list/revoke).
export const OAUTH_SCOPES = [
  'api:use',
  'profile:read',
  'keys:read',
  'keys:manage',
];

// Where the CLI stores its credentials. Mirrors `~/.aws/`, `~/.claude/`, etc.
export const MEGALLM_HOME = path.join(os.homedir(), '.megallm');
export const MEGALLM_PROFILES_DIR = path.join(MEGALLM_HOME, 'profiles');
export const MEGALLM_CONFIG_FILE = path.join(MEGALLM_HOME, 'config.json');
export const DEFAULT_PROFILE = 'default';

export const CONFIG_PATHS = {
  claude: {
    user: path.join(os.homedir(), '.claude', 'settings.json'),
    apiKeys: path.join(os.homedir(), '.claude.json'),  // This is where customApiKeyResponses goes
    project: '.claude/settings.json',
    projectLocal: '.claude/settings.local.json'
  },
  codex: {
    user: path.join(os.homedir(), '.codex', 'config.toml'),
    project: '.codex/config.toml'
  },
  opencode: {
    user: path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    project: 'opencode.json'
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
  OPENCODE: 'OpenCode',
  ALL: 'All'
};

export const SETUP_LEVELS = {
  PROJECT: 'Project-level',
  SYSTEM: 'System-level'
};
