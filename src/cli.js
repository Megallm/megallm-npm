#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import { select, confirm } from '@inquirer/prompts';

import { detectOS } from './detectors/os.js';
import {
getInstalledTools,
checkToolsStatus
} from './detectors/tools.js';

import {
promptToolSelection,
promptSetupLevel,
promptApiKey,
confirmConfiguration,
promptRetry,
promptExistingConfigAction,
confirmOverride,
promptStatuslineSetup
} from './utils/prompts.js';

import {
installClaudeCode,
installCodex,
installOpenCode
} from './utils/installer.js';

import { configureClaude } from './configurators/claude.js';
import { configureCodex } from './configurators/codex.js';
import { configureOpenCode } from './configurators/opencode.js';

import {
configureStatusline,
isStatuslineConfigured
} from './configurators/statusline.js';

import {
reloadShell,
setEnvironmentVariable
} from './utils/shell.js';

import {
checkExistingConfiguration,
removeEnvVars,
detectExistingEnvVars,
removeConfigurationFiles
} from './utils/envDetector.js';

import {
MEGALLM_BASE_URL,
SETUP_LEVELS
} from './constants.js';

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const TOOL_METADATA = {
claude: {
label: 'Claude Code',
package: '@anthropic-ai/claude-code',
installer: installClaudeCode
},
codex: {
label: 'Codex',
package: '@openai/codex',
installer: installCodex
},
opencode: {
label: 'OpenCode',
package: 'opencode-ai',
installer: installOpenCode
}
};

function step(message) {
console.log(chalk.cyan(`\n▶ ${message}`));
}

function success(message) {
console.log(chalk.green(`✓ ${message}`));
}

function warning(message) {
console.log(chalk.yellow(`⚠ ${message}`));
}

function info(message) {
console.log(chalk.gray(message));
}

function exitGracefully(message = 'Setup cancelled.') {
console.log(chalk.yellow(`\n👋 ${message}`));
process.exit(0);
}

async function showBanner() {
console.clear();

const banner = figlet.textSync('MegaLLM', {
horizontalLayout: 'default'
});

console.log(chalk.cyan(banner));
console.log(
chalk.cyan(
'      Setup Tool for Claude Code, Codex & OpenCode'
)
);

console.log(
chalk.gray(
'      Configure your AI tools to use MegaLLM\n'
)
);

console.log(chalk.gray('═'.repeat(60)));
}

function displayToolStatus(toolsStatus) {
const tools = [
['claude', 'Claude Code'],
['codex', 'Codex'],
['opencode', 'OpenCode']
];

tools.forEach(([key, label]) => {
const tool = toolsStatus[key];

```
if (tool.installed) {
  success(`${label} detected`);

  if (tool.configPath) {
    info(`  Config: ${tool.configPath}`);
  }
} else {
  warning(`${label} not found`);
}
```

});
}

async function refreshToolState() {
return {
toolsStatus: checkToolsStatus(),
installedTools: getInstalledTools()
};
}

async function installAndRefresh(installer) {
const installed = await installer();

if (!installed) return null;

return refreshToolState();
}

/* -------------------------------------------------------------------------- */
/*                              INSTALLATION FLOW                             */
/* -------------------------------------------------------------------------- */

async function handleToolInstallation(toolsStatus) {
const missingTools = Object.entries(toolsStatus)
.filter(([key, value]) => key !== 'anyInstalled' && !value.installed)
.map(([key]) => key);

if (toolsStatus.anyInstalled && missingTools.length === 0) {
return refreshToolState();
}

console.log();

if (!toolsStatus.anyInstalled) {
warning('No supported AI tools detected.');
} else {
step('Additional tools available for installation');
}

const wantsInstall = await confirm({
message: 'Would you like to install missing tools?',
default: true
});

if (!wantsInstall && !toolsStatus.anyInstalled) {
console.log();
warning('No tools available for configuration.');
process.exit(1);
}

if (!wantsInstall) {
return refreshToolState();
}

const installChoices = missingTools.map(tool => ({
name: `${TOOL_METADATA[tool].label} (${TOOL_METADATA[tool].package})`,
value: tool
}));

if (missingTools.length > 1) {
installChoices.push({
name: 'All missing tools',
value: 'all'
});
}

const selectedInstall = await select({
message: 'Select tool(s) to install',
choices: installChoices
});

const toolsToInstall =
selectedInstall === 'all'
? missingTools
: [selectedInstall];

for (const tool of toolsToInstall) {
step(`Installing ${TOOL_METADATA[tool].label}...`);

```
await installAndRefresh(
  TOOL_METADATA[tool].installer
);
```

}

return refreshToolState();
}

/* -------------------------------------------------------------------------- */
/*                          EXISTING CONFIGURATION                            */
/* -------------------------------------------------------------------------- */

async function handleExistingConfiguration(toolsStatus) {
step('Checking existing MegaLLM configuration...');

const existingConfig =
await checkExistingConfiguration();

const envVars = await detectExistingEnvVars();

if (!existingConfig.isConfigured) {
info('✓ No existing MegaLLM configuration found');
return;
}

success('MegaLLM configuration detected');

const printLocations = (items, title) => {
if (!items.length) return;

```
console.log(chalk.cyan(`\n${title}`));

items.forEach(item => {
  info(`  • ${item.location}: ${item.value}`);
});
```

};

printLocations(
envVars.ANTHROPIC_BASE_URL,
'📍 Base URLs'
);

printLocations(
envVars.ANTHROPIC_API_KEY,
'🔑 Anthropic API Keys'
);

printLocations(
envVars.MEGALLM_API_KEY,
'🔑 MegaLLM API Keys'
);

const action = await promptExistingConfigAction(
existingConfig.locations
);

if (action === 'skip') {
success('Keeping existing configuration');

```
await handleStatuslineSetup(toolsStatus);

process.exit(0);
```

}

if (action === 'cancel') {
exitGracefully();
}

const confirmed = await confirmOverride(
existingConfig.locations
);

if (!confirmed) {
exitGracefully();
}

step('Removing previous configuration...');

const envCleanup = await removeEnvVars();
const fileCleanup =
await removeConfigurationFiles();

envCleanup.removed.forEach(item => {
success(`Removed: ${item.location}`);
});

fileCleanup.removed.forEach(item => {
success(`Cleaned: ${item.file}`);
});

[...envCleanup.errors, ...fileCleanup.errors]
.filter(Boolean)
.forEach(error => {
warning(error);
});

success('Previous configuration removed');
}

/* -------------------------------------------------------------------------- */
/*                              STATUSLINE FLOW                               */
/* -------------------------------------------------------------------------- */

async function handleStatuslineSetup(toolsStatus) {
if (!toolsStatus.claude.installed) {
return;
}

const configured =
await isStatuslineConfigured();

if (configured) {
success(
'Claude Code statusline already configured'
);
return;
}

const wantsSetup =
await promptStatuslineSetup();

if (!wantsSetup) {
info(
'\nYou can enable statusline later using:'
);

```
info(
  'npx @chongdashu/cc-statusline@latest init'
);

return;
```

}

const successStatus =
await configureStatusline(true);

if (!successStatus) {
warning('Statusline setup skipped');
}
}

/* -------------------------------------------------------------------------- */
/*                            CONFIGURATION FLOW                              */
/* -------------------------------------------------------------------------- */

async function configureSelectedTools(
selectedTool,
apiKey,
configLevel
) {
const tasks = [];

if (
['claude', 'both', 'all'].includes(
selectedTool
)
) {
tasks.push(
configureClaude(apiKey, configLevel)
);
}

if (
['codex', 'both', 'all'].includes(
selectedTool
)
) {
tasks.push(
configureCodex(apiKey, configLevel)
);
}

if (
['opencode', 'all'].includes(
selectedTool
)
) {
tasks.push(
configureOpenCode(apiKey, configLevel)
);
}

const results = await Promise.all(tasks);

return results.every(Boolean);
}

function setEnvironmentVariables(
selectedTool,
apiKey
) {
if (
['claude', 'both', 'all'].includes(
selectedTool
)
) {
setEnvironmentVariable(
'ANTHROPIC_BASE_URL',
MEGALLM_BASE_URL,
true
);

```
setEnvironmentVariable(
  'ANTHROPIC_API_KEY',
  apiKey,
  true
);
```

}

if (
[
'codex',
'opencode',
'both',
'all'
].includes(selectedTool)
) {
setEnvironmentVariable(
'MEGALLM_API_KEY',
apiKey,
true
);
}
}

function showSuccessMessage(selectedTool) {
console.log();

success('Setup completed successfully!');

console.log(chalk.cyan('\n✨ Ready to use:\n'));

if (
['claude', 'both', 'all'].includes(
selectedTool
)
) {
console.log(
chalk.white(
'  • Claude Code with MegaLLM'
)
);
}

if (
['codex', 'both', 'all'].includes(
selectedTool
)
) {
console.log(
chalk.white(
'  • Codex with MegaLLM'
)
);
}

if (
['opencode', 'all'].includes(
selectedTool
)
) {
console.log(
chalk.white(
'  • OpenCode with MegaLLM'
)
);
}

console.log(chalk.cyan('\n📚 Resources'));

info('  • https://docs.megallm.io/');
info('  • [support@megallm.io](mailto:support@megallm.io)');

console.log(
chalk.cyan(
'\n✨ Thank you for using MegaLLM!\n'
)
);
}

/* -------------------------------------------------------------------------- */
/*                                    MAIN                                    */
/* -------------------------------------------------------------------------- */

async function main() {
await showBanner();

try {
step('Detecting system information...');

```
const osInfo = detectOS();

success(
  `OS: ${osInfo.type} (${osInfo.platform})`
);

success(`Shell: ${osInfo.shell}`);

step('Checking installed tools...');

let toolsStatus = checkToolsStatus();
let installedTools = getInstalledTools();

displayToolStatus(toolsStatus);

const refreshed =
  await handleToolInstallation(
    toolsStatus
  );

toolsStatus = refreshed.toolsStatus;
installedTools = refreshed.installedTools;

await handleExistingConfiguration(
  toolsStatus
);

step('Configuration Setup');

const selectedTool =
  await promptToolSelection(
    installedTools
  );

if (!selectedTool) {
  exitGracefully();
}

const setupLevel =
  selectedTool === 'codex'
    ? SETUP_LEVELS.SYSTEM
    : await promptSetupLevel();

const apiKey = await promptApiKey();

const confirmed =
  await confirmConfiguration({
    tool: selectedTool,
    level: setupLevel,
    baseUrl: MEGALLM_BASE_URL,
    apiKey
  });

if (!confirmed) {
  const retry = await promptRetry();

  if (retry) {
    return main();
  }

  exitGracefully();
}

step('Applying configuration...');

const configLevel =
  setupLevel === SETUP_LEVELS.SYSTEM
    ? 'system'
    : 'project';

const configured =
  await configureSelectedTools(
    selectedTool,
    apiKey,
    configLevel
  );

if (!configured) {
  throw new Error(
    'Configuration process failed'
  );
}

if (setupLevel === SETUP_LEVELS.SYSTEM) {
  step('Setting environment variables...');
  setEnvironmentVariables(
    selectedTool,
    apiKey
  );
  success('Environment variables updated');
}

await handleStatuslineSetup(
  toolsStatus
);

step('Finalizing setup...');
reloadShell();

showSuccessMessage(selectedTool);
```

} catch (error) {
if (
error.message?.includes(
'User force closed'
)
) {
exitGracefully();
}

```
console.error(
  chalk.red(`\n❌ ${error.message}`)
);

if (process.env.DEBUG) {
  console.error(chalk.gray(error.stack));
}

process.exit(1);
```

}
}

/* -------------------------------------------------------------------------- */
/*                             PROCESS HANDLERS                               */
/* -------------------------------------------------------------------------- */

process.on('unhandledRejection', reason => {
console.error(
chalk.red('\n❌ Unhandled error:')
);

console.error(reason);

process.exit(1);
});

process.on('SIGINT', () => {
exitGracefully();
});

process.on('SIGTERM', () => {
exitGracefully('Setup terminated.');
});

/* -------------------------------------------------------------------------- */
/*                                   START                                    */
/* -------------------------------------------------------------------------- */

if (
import.meta.url ===
`file://${process.argv[1]}`
) {
main();
}

export default main;
