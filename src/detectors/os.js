// OS Detection Module
import os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG_PATHS, SHELL_CONFIG_FILES } from '../constants.js';

function detectOS() {
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();

  let osInfo = {
    platform,
    release,
    arch,
    type: 'unknown',
    shell: detectShell()
  };

  switch (platform) {
    case 'darwin':
      osInfo.type = 'macOS';
      osInfo.version = getMacOSVersion();
      break;
    case 'win32':
      osInfo.type = 'Windows';
      osInfo.version = release;
      break;
    case 'linux':
      osInfo.type = 'Linux';
      osInfo.distro = getLinuxDistro();
      break;
    default:
      osInfo.type = platform;
  }

  return osInfo;
}

function detectShell() {
  // Detect the user's default shell
  if (process.platform === 'win32') {
    if (process.env.PSModulePath) return 'powershell';
    return 'cmd';
  }

  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';

  return 'bash'; // Default fallback
}

function getMacOSVersion() {
  try {
    const version = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
    return version;
  } catch (error) {
    return 'Unknown';
  }
}

function getLinuxDistro() {
  try {
    if (fs.existsSync('/etc/os-release')) {
      const content = fs.readFileSync('/etc/os-release', 'utf8');
      const lines = content.split('\n');
      const distroInfo = {};

      lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          distroInfo[key] = value.replace(/"/g, '');
        }
      });

      return distroInfo.PRETTY_NAME || distroInfo.NAME || 'Unknown Linux';
    }
  } catch (error) {
    // Fallback methods
  }

  return 'Linux';
}

/**
 * Resolve the filesystem path for a tool's configuration based on the requested level.
 * @param {string} tool - Tool identifier: `'claude'`, `'codex'`, or `'opencode'`.
 * @param {string} level - Configuration scope; use `'system'` for global/user config, any other value for project-level config.
 * @returns {string|null} The resolved path to the configuration file or directory for the given tool and level, or `null` if the tool is unrecognized.
 */
function getConfigPath(tool, level) {
  if (tool === 'claude') {
    if (level === 'system') {
      return CONFIG_PATHS.claude.user;
    } else {
      // Check if we should use local or regular project config
      if (fs.existsSync(CONFIG_PATHS.claude.projectLocal)) {
        return CONFIG_PATHS.claude.projectLocal;
      }
      return CONFIG_PATHS.claude.project;
    }
  } else if (tool === 'codex') {
    return level === 'system' ? CONFIG_PATHS.codex.user : CONFIG_PATHS.codex.project;
  } else if (tool === 'opencode') {
    return level === 'system' ? CONFIG_PATHS.opencode.user : CONFIG_PATHS.opencode.project;
  }

  return null;
}

function getShellConfigFile() {
  const shell = detectShell();
  const homeDir = os.homedir();

  switch (shell) {
    case 'zsh':
      return path.join(homeDir, SHELL_CONFIG_FILES.zsh);
    case 'bash':
      return path.join(homeDir, SHELL_CONFIG_FILES.bash);
    case 'fish':
      return path.join(homeDir, SHELL_CONFIG_FILES.fish);
    case 'powershell':
      const psProfile = execSync('echo $PROFILE', { shell: 'powershell', encoding: 'utf8' }).trim();
      return psProfile;
    default:
      return path.join(homeDir, '.bashrc');
  }
}

export { detectOS };
export { detectShell };
export { getConfigPath };
export { getShellConfigFile };