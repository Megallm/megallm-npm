# MegaLLM Setup Tool

🚀 A powerful NPX package to configure Claude Code and Codex to use MegaLLM AI service with a single command.

## 🎯 Features

- **Auto-detection** of installed AI tools (Claude Code, Codex/Windsurf)
- **OS-aware** configuration for macOS, Linux, and Windows
- **Interactive setup** with user-friendly prompts
- **Guided API key creation** with automatic browser opening
- **Project or system-level** configuration options
- **Automatic backup** of existing configurations
- **Environment variable** management
- **Shell configuration** updates

## 📦 Installation & Usage

### Quick Start

```bash
npx megallm@latest
```

### Windows Users (PowerShell)

If you encounter issues with PowerShell, try:

```powershell
# Clear npm cache first
npm cache clean --force

# Use with explicit version
npx megallm@latest

# Or use cmd.exe
cmd /c "npx megallm"

# Or install globally
npm install -g megallm@latest
megallm
```

### macOS/Linux Users

```bash
npx megallm
```

### Global Installation

```bash
npm install -g megallm
megallm
```

## 🔧 What It Does

The MegaLLM setup tool will:

1. **Detect your operating system** and shell environment
2. **Check for installed tools** (Claude Code, Codex)
3. **Guide you through API key setup**:
   - Ask if you have a MegaLLM API key
   - If not, automatically open https://megallm.io in your browser
   - Provide step-by-step instructions to create an API key
   - Wait for you to enter the key when ready
4. **Prompt for configuration choices**:
   - Which tool to configure (Claude Code/Codex/Both)
   - Setup level (System-wide or Project-specific)
5. **Configure the selected tools** with:
   - Base URL: `https://ai.megallm.io`
   - Your API key
   - Proper authentication settings
6. **Update environment variables** (for system-level setup)
7. **Reload shell configuration** automatically

## 📋 Configuration Details

### Claude Code Configuration

**System-level** (applies to all projects):
- Location: `~/.claude/settings.json`
- Sets environment variables:
  - `ANTHROPIC_BASE_URL=https://ai.megallm.io`
  - `ANTHROPIC_API_KEY=<your-api-key>`

**Project-level** (current project only):
- Location: `.claude/settings.json` or `.claude/settings.local.json`
- Configuration is project-specific

### Codex Configuration

**System-level** (applies to all projects):
- Location: `~/.codex/config.toml`
- Configures API settings in TOML format

**Project-level** (current project only):
- Location: `.codex/config.toml`
- Configuration is project-specific

## 🖥️ Supported Platforms

- **macOS** (10.14+)
- **Linux** (Ubuntu, Debian, Fedora, Arch, etc.)
- **Windows** (10/11 with PowerShell or CMD)

## 🚀 Quick Start Guide

1. **Run the setup tool**:
   ```bash
   npx megallm
   ```

2. **Follow the interactive prompts**:
   - The tool will ask if you have a MegaLLM API key
   - If not, it will automatically open https://megallm.io in your browser
   - Follow the on-screen instructions to create your API key
   - Select which tool to configure
   - Choose system or project level setup
   - Enter your API key when ready
   - Confirm the configuration

3. **Start using your AI tools** with MegaLLM!

### Getting Your API Key

If you don't have a MegaLLM API key yet:
1. Visit [https://megallm.io](https://megallm.io) (the tool opens this automatically)
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. Create a new API key
5. Copy and save it securely

### Prerequisites

- **Install Claude Code or Codex** first:
  - Claude Code: [https://claude.ai/code](https://claude.ai/code)
  - Windsurf (includes Codex): [https://codeium.com/windsurf](https://codeium.com/windsurf)

## 🔐 Security

- API keys are stored securely in configuration files
- Backup files are created before any modifications
- Project-level configs can be added to `.gitignore`
- The last 20 characters of API keys are approved for Claude Code

## 🛠️ Advanced Usage

### Command Line Options

```bash
# Run with debug output
DEBUG=* npx megallm

# Skip banner
NO_BANNER=1 npx megallm
```

### Manual Configuration

If you prefer manual setup, you can edit the configuration files directly:

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai.megallm.io",
    "ANTHROPIC_API_KEY": "your-api-key-here"
  },
  "customApiKeyResponses": {
    "approved": ["last-20-chars-of-key"],
    "rejected": []
  }
}
```

**Codex** (`~/.codex/config.toml`):
```toml
[api]
base_url = "https://ai.megallm.io"
api_key = "your-api-key-here"
provider = "custom"

[auth]
provider = "custom"
endpoint = "https://ai.megallm.io"
api_key = "your-api-key-here"
```

## 🐛 Troubleshooting

### Tool not detected
- Ensure Claude Code or Codex is properly installed
- Check that the configuration directories exist:
  - Claude: `~/.claude/`
  - Codex: `~/.codex/`

### Configuration not applied
- Restart your terminal after setup
- For project-level configs, ensure you're in the correct directory
- Check file permissions on configuration files

### API key issues
- Ensure your API key is valid and active
- Check for spaces or special characters
- Verify the key has proper permissions on MegaLLM

## 📚 Documentation

- MegaLLM Documentation: [https://docs.megallm.io/](https://docs.megallm.io/)
- Claude Code Docs: [https://docs.claude.com/claude-code](https://docs.claude.com/claude-code)
- Codex/Windsurf Docs: [https://docs.codeium.com](https://docs.codeium.com)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- Email: support@megallm.io
- GitHub Issues: [https://github.com/megallm/megallm/issues](https://github.com/megallm/megallm/issues)
- Discord: [Join our community](https://discord.gg/megallm)

## 🙏 Acknowledgments

- Built with ❤️ by the MegaLLM team
- Powered by Node.js and NPM
- Special thanks to all contributors

---

Made with 🚀 by [MegaLLM](https://megallm.io)
