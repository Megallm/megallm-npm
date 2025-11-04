// Tool Detection Module
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function isClaudeCodeInstalled() {
  // Check for Claude Code installation
  const claudeDir = path.join(os.homedir(), '.claude');

  if (fs.existsSync(claudeDir)) {
    // Check for settings.json to confirm it's actually Claude Code
    const settingsPath = path.join(claudeDir, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      return {
        installed: true,
        path: claudeDir,
        configPath: settingsPath
      };
    }
  }

  // Also check for the claude CLI command
  try {
    const command = process.platform === 'win32' ? 'where claude' : 'which claude';
    execSync(command, { stdio: 'ignore' });
    return {
      installed: true,
      path: claudeDir,
      configPath: null,
      cliAvailable: true
    };
  } catch (error) {
    // Command not found
  }

  return {
    installed: false,
    path: null,
    configPath: null
  };
}

/**
 * Detects whether Codex (or the Windsurf variant) is installed and reports its paths and configuration state.
 *
 * @returns {{installed: boolean, path: string|null, configPath: string|null, configured?: boolean, cliAvailable?: boolean, isWindsurf?: boolean}}
 * An object describing the detected installation:
 * - `installed`: `true` if Codex or Windsurf was found, `false` otherwise.
 * - `path`: The expected Codex directory (`~/.codex`) when detected, or `null` if not installed.
 * - `configPath`: The path to `config.toml` inside the Codex directory, or `null` if not installed.
 * - `configured`: `true` if `config.toml` exists at `configPath`, `false` if the installation exists but the config file is missing. Omitted when not applicable.
 * - `cliAvailable`: `true` if a `codex` CLI executable was found on PATH. Omitted when not applicable.
 * - `isWindsurf`: `true` if a Windsurf installation (which includes Codex) was detected. Omitted when not applicable.
 */
function isCodexInstalled() {
  // Check for Codex installation
  const codexDir = path.join(os.homedir(), '.codex');

  // First check if the .codex directory exists
  if (fs.existsSync(codexDir)) {
    const configPath = path.join(codexDir, 'config.toml');
    if (fs.existsSync(configPath)) {
      return {
        installed: true,
        path: codexDir,
        configPath: configPath,
        configured: true
      };
    }
    // Directory exists but no config
    return {
      installed: true,
      path: codexDir,
      configPath: configPath,
      configured: false
    };
  }

  // Also check for the codex CLI command
  try {
    const command = process.platform === 'win32' ? 'where codex' : 'which codex';
    execSync(command, { stdio: 'ignore' });
    return {
      installed: true,
      path: codexDir,
      configPath: path.join(codexDir, 'config.toml'),
      cliAvailable: true,
      configured: false
    };
  } catch (error) {
    // Command not found
  }

  // Check for Windsurf as an alternative (Codex is part of Windsurf)
  try {
    if (process.platform === 'darwin') {
      // Check for Windsurf app on macOS
      if (fs.existsSync('/Applications/Windsurf.app')) {
        return {
          installed: true,
          path: codexDir,
          configPath: path.join(codexDir, 'config.toml'),
          isWindsurf: true,
          configured: false
        };
      }
    } else if (process.platform === 'win32') {
      // Check for Windsurf on Windows
      const winPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Windsurf');
      if (fs.existsSync(winPath)) {
        return {
          installed: true,
          path: codexDir,
          configPath: path.join(codexDir, 'config.toml'),
          isWindsurf: true,
          configured: false
        };
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return {
    installed: false,
    path: null,
    configPath: null
  };
}

/**
 * Detects whether OpenCode is installed and returns its installation and configuration status.
 *
 * @returns {{installed: boolean, path: string|null, configPath: string|null, configured?: boolean, cliAvailable?: boolean}}
 * An object describing the detected OpenCode state:
 * - `installed`: `true` if OpenCode was found (config directory or CLI), `false` otherwise.
 * - `path`: the filesystem path to the OpenCode config directory (`~/.config/opencode`) or `null` if not found.
 * - `configPath`: the expected path to the `opencode.json` config file or `null` if not found.
 * - `configured` (optional): `true` if `opencode.json` exists, `false` if the directory exists but the file does not.
 * - `cliAvailable` (optional): `true` if the `opencode` CLI was found on PATH (used when the config directory is absent).
 */
function isOpenCodeInstalled() {
  // Check for OpenCode installation
  const opencodeConfigDir = path.join(os.homedir(), '.config', 'opencode');

  // First check if the .config/opencode directory exists
  if (fs.existsSync(opencodeConfigDir)) {
    const configPath = path.join(opencodeConfigDir, 'opencode.json');
    if (fs.existsSync(configPath)) {
      return {
        installed: true,
        path: opencodeConfigDir,
        configPath: configPath,
        configured: true
      };
    }
    // Directory exists but no config
    return {
      installed: true,
      path: opencodeConfigDir,
      configPath: configPath,
      configured: false
    };
  }

  // Also check for the opencode CLI command
  try {
    const command = process.platform === 'win32' ? 'where opencode' : 'which opencode';
    execSync(command, { stdio: 'ignore' });
    return {
      installed: true,
      path: opencodeConfigDir,
      configPath: path.join(opencodeConfigDir, 'opencode.json'),
      cliAvailable: true,
      configured: false
    };
  } catch (error) {
    // Command not found
  }

  return {
    installed: false,
    path: null,
    configPath: null
  };
}

/**
 * Gather installation status for Claude Code, Codex, and OpenCode.
 * @returns {{claude: {installed: boolean, path: (string|null), configPath: (string|null), cliAvailable?: boolean}, codex: {installed: boolean, path: (string|null), configPath: (string|null), configured?: boolean, isWindsurf?: boolean, cliAvailable?: boolean}, opencode: {installed: boolean, path: (string|null), configPath: (string|null), configured?: boolean, cliAvailable?: boolean}, anyInstalled: boolean}} An object with per-tool status objects (`claude`, `codex`, `opencode`) and `anyInstalled` set to `true` if any of the three tools is installed, `false` otherwise.
 */
function checkToolsStatus() {
  const claude = isClaudeCodeInstalled();
  const codex = isCodexInstalled();
  const opencode = isOpenCodeInstalled();

  return {
    claude,
    codex,
    opencode,
    anyInstalled: claude.installed || codex.installed || opencode.installed
  };
}

/**
 * Builds a list of detected coding tools and their metadata.
 * @returns {Array<Object>} An array of tool descriptor objects for each detected tool. Each object contains `name` (display name), `key` (identifier) and detector-specific fields such as `installed`, `path`, `configPath`, `cliAvailable`, `configured`, and other flags (e.g., `isWindsurf`) when present.
 */
function getInstalledTools() {
  const status = checkToolsStatus();
  const tools = [];

  if (status.claude.installed) {
    tools.push({
      name: 'Claude Code',
      key: 'claude',
      ...status.claude
    });
  }

  if (status.codex.installed) {
    tools.push({
      name: status.codex.isWindsurf ? 'Codex (Windsurf)' : 'Codex',
      key: 'codex',
      ...status.codex
    });
  }

  if (status.opencode.installed) {
    tools.push({
      name: 'OpenCode',
      key: 'opencode',
      ...status.opencode
    });
  }

  return tools;
}

export { isClaudeCodeInstalled };
export { isCodexInstalled };
export { isOpenCodeInstalled };
export { checkToolsStatus };
export { getInstalledTools };