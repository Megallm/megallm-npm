# MegaLLM Setup Tool - Frequently Asked Questions

## 1. How do I install and run the MegaLLM Setup Tool?

The MegaLLM Setup Tool is designed to be run directly without installation using NPX (which comes with Node.js 18+).

### Quick Start
```bash
npx megallm@latest
```

That's it! The tool will:
- Automatically detect your operating system and shell
- Check for installed AI tools (Claude Code and Codex/Windsurf)
- Guide you through the configuration process

### Prerequisites
- **Node.js 18.0.0 or higher** is required
- Check your version: `node --version`
- Install Node.js from [nodejs.org](https://nodejs.org/) if needed

### What happens when you run it?
1. Shows a welcome banner with ASCII art
2. Detects your OS (macOS/Linux/Windows) and shell (bash/zsh/fish/PowerShell)
3. Scans for Claude Code and Codex/Windsurf installations
4. Offers to install missing tools if needed
5. Guides you through API key setup and configuration

## 2. What if I don't have a MegaLLM API key?

No problem! The tool includes a comprehensive API key creation workflow.

### Automatic Key Creation Process
When you run the tool without an API key:

1. **The tool asks**: "Do you have a MegaLLM API key?"
2. **Select "No"**: The tool will automatically open your browser to https://megallm.io
3. **Follow the instructions**:
   - Create your MegaLLM account
   - Navigate to the API keys section
   - Create a new API key
   - Copy the key to your clipboard
4. **Return to the terminal**: Press Enter when ready
5. **Paste your key**: The tool validates it (must be 20+ characters)

### If the browser doesn't open automatically
The tool will display:
- The URL to visit: https://megallm.io
- Step-by-step instructions for key creation
- Option to continue once you have your key

### API Key Requirements
- Minimum 20 characters long
- No spaces (unless it starts with "Bearer ")
- Keep it secure - it's like a password!

## 3. Which AI tools does MegaLLM support and how do I know if they're installed?

MegaLLM currently supports two major AI coding assistants:

### Supported Tools

#### Claude Code
- **Detection**: Checks for `~/.claude/` directory and `settings.json`
- **Installation**: If not found, the tool offers to install it via NPM
- **Configuration locations**:
  - System: `~/.claude/settings.json`
  - Project: `./.claude/settings.json` or `./.claude/settings.local.json`

#### Codex/Windsurf
- **Detection**: Checks for `~/.codex/` directory and `config.toml`
- **Windsurf specific**: Also checks `/Applications/Windsurf.app` (macOS) or `%LOCALAPPDATA%\Programs\Windsurf` (Windows)
- **Installation**: Offers automatic installation if not detected
- **Configuration location**: `~/.codex/config.toml` (system-level only)

### How the tool detects installations
The tool runs several checks:
1. Looks for configuration directories (`~/.claude/`, `~/.codex/`)
2. Checks for CLI commands (`which claude`, `which codex`)
3. For Windsurf on macOS: checks `/Applications/Windsurf.app`
4. For Windsurf on Windows: checks common installation paths

### What if no tools are detected?
- The tool will inform you that no supported tools are installed
- It offers to install Claude Code, Codex, or both
- Installation happens via NPM global packages
- After installation, the tool continues with configuration

## 4. What's the difference between system-level and project-level configuration?

Understanding configuration levels helps you choose the right setup for your workflow.

### System-Level Configuration
- **Scope**: Applies to ALL projects on your machine
- **Location**:
  - Claude: `~/.claude/settings.json`
  - Codex: `~/.codex/config.toml`
- **Best for**: Personal machines where you always use MegaLLM
- **Persistence**: Survives across all projects and terminal sessions

### Project-Level Configuration
- **Scope**: Only applies to the current project directory
- **Location**:
  - Claude: `./.claude/settings.json` or `./.claude/settings.local.json`
  - Codex: **Not supported** (Codex only uses system-level)
- **Best for**:
  - Team projects with shared MegaLLM settings
  - Testing different configurations
  - Keeping work and personal projects separate
- **Note**: Takes precedence over system-level configuration

### Which should you choose?
- **System-level**: Choose this for personal use on your own machine
- **Project-level**: Choose this for:
  - Shared team projects
  - Client work with different API keys
  - Testing or development purposes

### Important Notes
- Codex/Windsurf only supports system-level configuration
- Project-level configs should be added to `.gitignore` if they contain API keys
- Claude Code checks project-level first, then falls back to system-level

## 5. I already have MegaLLM configured. What should I do?

The tool intelligently detects existing MegaLLM configurations and offers you choices.

### Detection
The tool checks for existing MegaLLM configuration in:
- Environment variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `MEGALLM_API_KEY`)
- Claude settings files (system and project level)
- Codex config.toml files
- Shell configuration files (.bashrc, .zshrc, etc.)
- Windows Registry (for persistent environment variables)

### Your Options

When existing configuration is detected, you'll see three choices:

#### 1. Override (Recommended for updates)
- Removes all existing MegaLLM configuration
- Applies fresh configuration with your new settings
- Creates backups of modified files
- Cleans up environment variables from all sources

#### 2. Skip (Keep existing)
- Preserves your current configuration
- Exits the tool without making changes
- Use this if your setup is already working

#### 3. Cancel
- Exits immediately without any changes
- Same as pressing Ctrl+C

### Where configurations might exist
- **Environment variables**: Current session, shell configs, Windows Registry
- **Claude Code**: `~/.claude/settings.json`, `./.claude/settings.json`
- **Codex**: `~/.codex/config.toml`
- **Shell configs**: `.bashrc`, `.zshrc`, `.profile`, PowerShell profiles

### Backup Files
When overriding, the tool creates backups:
- Original files are saved with `.backup` extension
- Timestamp may be added for uniqueness
- You can manually restore if needed

## 6. Why isn't my configuration working after setup?

This is often due to environment variables not being loaded in your current session.

### Common Solutions

#### On macOS/Linux
After configuration, you need to reload your shell:
```bash
# For bash
source ~/.bashrc

# For zsh
source ~/.zshrc

# Or simply restart your terminal
```

#### On Windows
- **Close and reopen** your terminal/IDE
- Changes via `setx` only affect new sessions
- PowerShell: May need to restart PowerShell completely
- VS Code: Restart the entire application, not just the terminal

### Verification Steps

1. **Check environment variables**:
```bash
# Unix/macOS
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_API_KEY

# Windows Command Prompt
echo %ANTHROPIC_BASE_URL%
echo %ANTHROPIC_API_KEY%

# Windows PowerShell
$env:ANTHROPIC_BASE_URL
$env:ANTHROPIC_API_KEY
```

2. **Verify configuration files exist**:
```bash
# Claude Code
cat ~/.claude/settings.json

# Codex
cat ~/.codex/config.toml
```

3. **Check API key approval** (Claude Code):
```bash
cat ~/.claude.json
```
Should contain your API key's last 20 characters in the "approved" array.

### Tool-Specific Issues

#### Claude Code
- Must approve API key usage (happens automatically via our tool)
- Check `~/.claude.json` for approved keys
- Project-level config only works in that specific directory

#### Codex/Windsurf
- Only supports system-level configuration
- Requires `MEGALLM_API_KEY` environment variable
- May need to restart the Windsurf application

### Still not working?
- Run the setup tool again and choose "Override"
- Check file permissions on configuration files
- Ensure your API key is valid (20+ characters, no spaces)
- Try setting environment variables manually as a test

## 7. How do I manually configure Claude Code or Codex for MegaLLM?

Sometimes you may need or prefer to configure the tools manually.

### Manual Claude Code Configuration

#### 1. Create/edit settings file
Create or modify `~/.claude/settings.json`:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai.megallm.io",
    "ANTHROPIC_API_KEY": "your-megallm-api-key-here"
  }
}
```

#### 2. Approve the API key
Create or modify `~/.claude.json`:
```json
{
  "customApiKeyResponses": {
    "approved": ["last-20-characters-of-your-key"],
    "rejected": []
  }
}
```

#### 3. Set environment variables (optional)
```bash
export ANTHROPIC_BASE_URL="https://ai.megallm.io"
export ANTHROPIC_API_KEY="your-megallm-api-key-here"
```

### Manual Codex/Windsurf Configuration

#### 1. Create/edit config file
Create or modify `~/.codex/config.toml`:
```toml
model_provider = "megallm"
model = "gpt-5"

[model_providers.megallm]
name = "OpenAI using Chat Completions"
base_url = "https://ai.megallm.io/v1"
env_key = "MEGALLM_API_KEY"

[tools]
web_search = true
file_browser = true
```

#### 2. Set environment variable
```bash
# Unix/macOS
export MEGALLM_API_KEY="your-megallm-api-key-here"

# Windows Command Prompt
setx MEGALLM_API_KEY "your-megallm-api-key-here"

# Windows PowerShell
[Environment]::SetEnvironmentVariable("MEGALLM_API_KEY", "your-megallm-api-key-here", "User")
```

### Making environment variables permanent

#### macOS/Linux
Add to your shell configuration file (`~/.bashrc`, `~/.zshrc`, etc.):
```bash
export ANTHROPIC_BASE_URL="https://ai.megallm.io"
export ANTHROPIC_API_KEY="your-megallm-api-key-here"
export MEGALLM_API_KEY="your-megallm-api-key-here"
```

#### Windows
Use `setx` for permanent variables:
```cmd
setx ANTHROPIC_BASE_URL "https://ai.megallm.io"
setx ANTHROPIC_API_KEY "your-megallm-api-key-here"
setx MEGALLM_API_KEY "your-megallm-api-key-here"
```

### Validation
After manual configuration:
1. Restart your terminal/IDE
2. Test the configuration in Claude Code or Codex
3. Check that requests are going to MegaLLM (you can verify in your MegaLLM dashboard)

### When to use manual configuration?
- Automation failed due to permissions
- You need custom settings not supported by the tool
- You're integrating with existing configuration management
- You prefer explicit control over your setup

---

## Getting Help

### Support Resources
- **Documentation**: https://docs.megallm.io/
- **Email Support**: support@megallm.io
- **GitHub Issues**: https://github.com/Megallm/megallm-npm/issues
- **Discord Community**: https://discord.gg/megallm

### Debug Mode
Run with debug output for troubleshooting:
```bash
DEBUG=* npx megallm@latest
```

### Common Error Messages
- **"API key seems too short"**: Your key must be at least 20 characters
- **"No supported AI tools detected"**: Install Claude Code or Codex first
- **"Permission denied"**: Run without sudo, or check file permissions
- **"Cannot find module"**: Ensure Node.js 18+ is installed

### Reporting Issues
When reporting issues, please include:
1. Your operating system and version
2. Node.js version (`node --version`)
3. Which AI tool you're configuring
4. Error messages (run with `DEBUG=*` for detailed output)
5. Whether you're using system or project-level configuration