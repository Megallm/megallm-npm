// Statusline configuration for Claude Code
import chalk from 'chalk';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Configure Claude Code's terminal statusline by running the @chongdashu/cc-statusline initializer.
 * @param {boolean} install - When true, runs the interactive initializer; when false, does nothing.
 * @returns {boolean} `true` if setup succeeded or was intentionally skipped, `false` if setup failed.
 */
export async function configureStatusline(install = false) {
  if (!install) {
    return true;
  }

  console.log(chalk.cyan('\n🚀 Setting up Claude Code statusline...'));

  try {
    // Check if Claude Code is installed first
    try {
      await execAsync('which claude');
    } catch (error) {
      console.log(chalk.yellow('⚠ Claude Code is not installed. Skipping statusline setup.'));
      console.log(chalk.gray('  You can set it up later with: npx @chongdashu/cc-statusline@latest init'));
      return true;
    }

    // Instead of running the command directly, we'll use spawn to handle the interactive process
    console.log(chalk.cyan('\nRunning statusline setup...'));
    console.log(chalk.gray('This will configure your Claude Code terminal with enhanced features.\n'));

    return new Promise((resolve) => {
      const child = spawn('npx', ['@chongdashu/cc-statusline@latest', 'init'], {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.log(chalk.yellow('\n⚠ Statusline setup was cancelled or encountered an issue.'));
          console.log(chalk.gray('  You can try again manually: npx @chongdashu/cc-statusline@latest init'));
          resolve(false);
        } else {
          console.log(chalk.green('\n✅ Claude Code statusline configured successfully!'));

          // Show what features were enabled
          console.log(chalk.cyan('\n✨ Statusline features enabled:'));
          console.log(chalk.gray('  📁 Current directory with ~ abbreviation'));
          console.log(chalk.gray('  🌿 Git branch information'));
          console.log(chalk.gray('  🤖 Claude model and version info'));
          console.log(chalk.gray('  🧠 Real-time context usage'));
          console.log(chalk.gray('  💰 Cost tracking and burn rates'));
          console.log(chalk.gray('  ⌛ Session timer'));
          console.log(chalk.gray('  📊 Token analytics'));
          console.log(chalk.gray('  🎨 256-color support'));

          // Check if jq is installed for full functionality
          execAsync('which jq').then(() => {
            console.log(chalk.green('\n✓ jq is installed - All features available'));
            resolve(true);
          }).catch(() => {
            console.log(chalk.yellow('\n⚠ jq is not installed - Some features may be limited'));
            console.log(chalk.gray('  Install jq for full functionality:'));

            // Provide OS-specific installation instructions
            const platform = process.platform;
            if (platform === 'darwin') {
              console.log(chalk.gray('    brew install jq'));
            } else if (platform === 'linux') {
              console.log(chalk.gray('    sudo apt-get install jq  # Ubuntu/Debian'));
              console.log(chalk.gray('    sudo yum install jq      # RHEL/CentOS'));
            } else if (platform === 'win32') {
              console.log(chalk.gray('    choco install jq         # Using Chocolatey'));
              console.log(chalk.gray('    scoop install jq         # Using Scoop'));
            }
            resolve(true);
          });
        }
      });

      child.on('error', (error) => {
        console.log(chalk.red('\n❌ Failed to start statusline setup'));
        console.error(chalk.red(`  Error: ${error.message}`));
        console.log(chalk.gray('\n  You can try manually: npx @chongdashu/cc-statusline@latest init'));
        resolve(false);
      });
    });
  } catch (error) {
    console.log(chalk.red('\n❌ Failed to configure statusline'));
    console.error(chalk.red(`  Error: ${error.message}`));
    console.log(chalk.gray('\n  You can try manually: npx @chongdashu/cc-statusline@latest init'));
    return false;
  }
}

/**
 * Determine whether the Claude Code statusline is configured.
 * @returns {Promise<boolean>} `true` if the file `~/.config/claude/statusline.sh` exists, `false` otherwise.
 */
export async function isStatuslineConfigured() {
  try {
    // Check if the statusline configuration exists
    const { stdout } = await execAsync('test -f ~/.config/claude/statusline.sh && echo "exists" || echo "not found"');
    const result = stdout.trim() === 'exists';

    if (process.env.DEBUG) {
      console.log(`[DEBUG] Statusline configured: ${result}`);
    }

    return result;
  } catch (error) {
    return false;
  }
}

/**
 * Retrieve the current configuration and capability status of the Claude Code statusline.
 *
 * @returns {Promise<Object>} An object describing statusline state:
 *  - configured {boolean} whether the statusline script is present and configured.
 *  - hasJq {boolean} when `configured` is true, indicates whether `jq` is available for full features.
 *  - message {string} human-readable status message appropriate to the state.
 *  - error {string} optional error message present when the status check failed.
 */
export async function getStatuslineStatus() {
  try {
    const configured = await isStatuslineConfigured();

    if (!configured) {
      return {
        configured: false,
        message: 'Statusline not configured'
      };
    }

    // Check if jq is installed for full features
    let hasJq = false;
    try {
      await execAsync('which jq');
      hasJq = true;
    } catch (error) {
      hasJq = false;
    }

    return {
      configured: true,
      hasJq,
      message: hasJq
        ? 'Statusline configured with full features'
        : 'Statusline configured (limited features - jq not installed)'
    };
  } catch (error) {
    return {
      configured: false,
      error: error.message,
      message: 'Unable to check statusline status'
    };
  }
}