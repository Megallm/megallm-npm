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
megallm-setup

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
npx megallm-setup@latest
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

2. **User Input Phase**:
   - Select tool to configure
   - Choose setup level (system/project)
   - Input API key

3. **Configuration Phase**:
   - Read existing configurations
   - Merge with new settings
   - Write updated configurations
   - Create backups

4. **Finalization Phase**:
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

3. **Configuration**:
   - [ ] System-level setup
   - [ ] Project-level setup
   - [ ] Existing config merge
   - [ ] Backup creation

4. **Error Handling**:
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