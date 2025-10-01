# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the MegaLLM Setup Tool - an NPX package that configures Claude Code and Codex to use the MegaLLM AI service. The tool provides an interactive CLI for seamless configuration of AI development tools.

## Common Development Tasks

### Building and Testing

```bash
# Install dependencies
npm install

# Run the CLI locally
npm start

# Test the NPX command locally
npm link
megallm

# Run with debug output
DEBUG=* npm start

# Test on different shells
bash -c "npm start"
zsh -c "npm start"
```

### Publishing

```bash
# Update version
npm version patch|minor|major

# Publish to NPM
npm publish

# Test the published package
npx megallm@latest
```

## Code Architecture

### Core Components

1. **CLI Entry Point** (`src/cli.js`):
   - Main interactive flow orchestration
   - User interface with prompts and feedback
   - Error handling and recovery

2. **Detectors** (`src/detectors/`):
   - `os.js`: Operating system and shell detection
   - `tools.js`: Claude Code and Codex installation detection

3. **Configurators** (`src/configurators/`):
   - `claude.js`: Claude Code configuration logic
   - `codex.js`: Codex/Windsurf configuration logic

4. **Utilities** (`src/utils/`):
   - `files.js`: File I/O operations for JSON and TOML
   - `shell.js`: Shell commands and environment variables
   - `prompts.js`: Interactive user prompts

### Configuration Flow

1. **Detection Phase**:
   - Detect OS (macOS/Linux/Windows)
   - Detect shell (bash/zsh/fish/powershell)
   - Check for installed tools

2. **API Key Setup Phase**:
   - Ask if user has a MegaLLM API key
   - If not, guide through key creation:
     - Open https://megallm.io in browser automatically
     - Display fallback URL if browser doesn't open
     - Show step-by-step instructions
     - Wait for user confirmation to continue
   - Prompt for API key entry with validation

3. **User Input Phase**:
   - Select tool to configure
   - Choose setup level (system/project)

4. **Configuration Phase**:
   - Read existing configurations
   - Merge with new settings
   - Write updated configurations
   - Create backups

5. **Finalization Phase**:
   - Set environment variables
   - Update shell configuration
   - Provide success feedback

### File Formats

**Claude Code** uses JSON (`settings.json`):
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai.megallm.io",
    "ANTHROPIC_API_KEY": "key"
  },
  "customApiKeyResponses": {
    "approved": ["last20chars"]
  }
}
```

**Codex** uses TOML (`config.toml`):
```toml
[api]
base_url = "https://ai.megallm.io"
api_key = "key"

[auth]
provider = "custom"
endpoint = "https://ai.megallm.io"
```

### Configuration Paths

**System-level**:
- Claude: `~/.claude/settings.json`
- Codex: `~/.codex/config.toml`

**Project-level**:
- Claude: `.claude/settings.json` or `.claude/settings.local.json`
- Codex: `.codex/config.toml`

## Key Features

### API Key Creation Flow

The tool now includes a comprehensive API key creation workflow:

1. **Automatic Detection**: Asks if the user has an API key
2. **Browser Integration**: Opens MegaLLM website automatically for key creation
3. **Fallback Support**: Displays URL if browser fails to open
4. **Step-by-Step Guide**: Shows clear instructions for key creation
5. **Confirmation Flow**: Waits for user readiness before proceeding

### Browser Opening Logic

```javascript
// Cross-platform browser opening
const openCommand = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32' ? 'start' :
                   'xdg-open';

exec(`${openCommand} https://megallm.io`);
```

## Testing Checklist

When making changes, test:

1. **OS Detection**:
   - [ ] macOS detection
   - [ ] Linux detection
   - [ ] Windows detection

2. **Tool Detection**:
   - [ ] Claude Code installed
   - [ ] Codex installed
   - [ ] Windsurf installed
   - [ ] No tools installed

3. **API Key Flow**:
   - [ ] User has API key (direct entry)
   - [ ] User needs to create key (browser opens)
   - [ ] Browser fails to open (shows URL)
   - [ ] User cancels key creation

4. **Configuration**:
   - [ ] System-level setup
   - [ ] Project-level setup
   - [ ] Existing config merge
   - [ ] Backup creation

5. **Error Handling**:
   - [ ] Invalid API key
   - [ ] Missing permissions
   - [ ] Network errors
   - [ ] File system errors

## Dependencies

Key NPM packages used:
- `inquirer`: Interactive prompts
- `chalk`: Terminal colors
- `ora`: Loading spinners
- `figlet`: ASCII art
- `fs-extra`: Enhanced file operations
- `@iarna/toml`: TOML parsing

## Development Tips

1. **Adding New Tools**: Create a new configurator in `src/configurators/`
2. **New OS Support**: Update `src/detectors/os.js`
3. **Custom Prompts**: Extend `src/utils/prompts.js`
4. **Configuration Formats**: Use appropriate parser in `src/utils/files.js`

## Error Recovery

The tool implements several recovery mechanisms:
- Automatic backup before modifications
- Retry prompts on failure
- Graceful degradation when tools aren't detected
- Clear error messages with troubleshooting hints