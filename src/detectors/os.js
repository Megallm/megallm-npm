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
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';

  // Windows detection
  if (process.platform === 'win32') {
    if (process.env.PSModulePath) return 'powershell';
    return 'cmd';
  }

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