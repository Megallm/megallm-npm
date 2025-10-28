# MegaLLM Setup Tool

<div align="center">

  <h3>🚀 Configure Claude Code & Codex for MegaLLM with One Command</h3>

  [![NPM Version](https://img.shields.io/npm/v/megallm.svg)](https://www.npmjs.com/package/megallm)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![Platform Support](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](https://github.com/Megallm/megallm-npm)

  [**Quick Start**](#-quick-start) • [**Features**](#-features) • [**How It Works**](#-how-it-works) • [**Documentation**](#-documentation) • [**Support**](#-support)

</div>

---

## 🎯 Quick Start

```bash
npx megallm@latest
```

That's it! The interactive CLI will guide you through the entire setup process.

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 Smart Detection
- Auto-detects installed AI tools
- Identifies your OS and shell
- Checks existing configurations

</td>
<td width="50%">

### 🔧 Automated Setup
- Interactive configuration wizard
- API key creation guidance
- Environment variable management

</td>
</tr>
<tr>
<td width="50%">

### 🔐 Secure & Safe
- Automatic configuration backups
- Secure API key storage
- Project-level isolation support

</td>
<td width="50%">

### 🌍 Universal Support
- Works on macOS, Linux, Windows
- Supports bash, zsh, fish, PowerShell
- System or project-level configs

</td>
</tr>
</table>

## 📊 How It Works

<div align="center">

### 🔄 Setup Process Flow

```
┌──────────────────────────────────────────────────────┐
│                   npx megallm                        │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│          🔍 Environment Detection                    │
├──────────────────────────────────────────────────────┤
│  • Operating System (Mac/Linux/Win)                  │
│  • Shell Type (bash/zsh/fish/PS)                     │
│  • Installed Tools (Claude/Codex)                    │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│          🔑 API Key Setup                            │
├──────────────────────────────────────────────────────┤
│  Have API Key?                                       │
│    ├─ No  → Opens megallm.io                        │
│    │        Shows instructions                       │
│    │        Waits for key entry                      │
│    └─ Yes → Enter API key                           │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│          ⚙️ Configuration Choice                     │
├──────────────────────────────────────────────────────┤
│  Tool Selection:                                     │
│    • Claude Code only                                │
│    • Codex/Windsurf only                            │
│    • Both tools                                      │
│                                                      │
│  Setup Level:                                        │
│    • System (~/.claude, ~/.codex)                    │
│    • Project (./.claude, ./.codex)                   │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│          📝 Apply Configuration                      │
├──────────────────────────────────────────────────────┤
│  • Create/update config files                        │
│  • Set environment variables                         │
│  • Backup existing configs                           │
│  • Reload shell if needed                            │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│                  ✅ Complete!                        │
└──────────────────────────────────────────────────────┘
```

</div>

## 📦 Installation Options

<details>
<summary><b>🚀 Quick Run (Recommended)</b></summary>

```bash
# Latest version
npx megallm@latest

# Specific version
npx megallm@1.0.0
```
</details>

<details>
<summary><b>💻 Global Installation</b></summary>

```bash
# Install globally
npm install -g megallm

# Run from anywhere
megallm
```
</details>

<details>
<summary><b>🪟 Windows PowerShell</b></summary>

```powershell
# Clear cache if needed
npm cache clean --force

# Run with explicit version
npx megallm@latest

# Alternative: Use CMD
cmd /c "npx megallm"
```
</details>

## 🔧 Configuration Details

### Configuration Levels

| Level | Claude Code | Codex/Windsurf | Scope |
|-------|------------|----------------|-------|
| **System** | `~/.claude/settings.json` | `~/.codex/config.toml` | All projects |
| **Project** | `./.claude/settings.json` | `./.codex/config.toml` | Current project only |

### What Gets Configured

<table>
<tr>
<th>Claude Code (JSON)</th>
<th>Codex/Windsurf (TOML)</th>
</tr>
<tr>
<td>

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai.megallm.io",
    "ANTHROPIC_API_KEY": "your-key"
  },
  "customApiKeyResponses": {
    "approved": ["last-20-chars"]
  }
}
```

</td>
<td>

```toml
[api]
base_url = "https://ai.megallm.io"
api_key = "your-key"
provider = "custom"

[auth]
provider = "custom"
endpoint = "https://ai.megallm.io"
```

</td>
</tr>
</table>

## 🚦 Setup Flow

### Step 1: Get Your API Key

<div align="center">

#### 🔐 API Key Creation Process

```
┌──────────────────────────────────────────────────────┐
│              User runs: npx megallm                  │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│      Tool asks: "Do you have an API key?"            │
└──────┬────────────────────────────────────┬──────────┘
       ▼                                    ▼
  ┌─────────┐                          ┌─────────┐
  │ No Key  │                          │ Has Key │
  └────┬────┘                          └────┬────┘
       ▼                                    │
┌──────────────────────────────┐            │
│    🌐 Browser Opens          │            │
│       megallm.io             │            │
└──────────┬───────────────────┘            │
           ▼                                │
┌──────────────────────────────┐            │
│    Create Account            │            │
│    Generate API Key          │            │
└──────────┬───────────────────┘            │
           ▼                                │
┌──────────────────────────────┐            │
│    Copy API Key              │            │
└──────────┬───────────────────┘            │
           ▼                                ▼
┌──────────────────────────────────────────────────────┐
│    📝 Enter API Key in Terminal                      │
└────────────────────────┬─────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────┐
│          ✅ API Key Validated & Saved                │
└──────────────────────────────────────────────────────┘
```

**📋 Quick Steps:**
1. **No API Key?** → Tool opens [megallm.io](https://megallm.io) automatically
2. **Sign up** → Create your account (free tier available)
3. **Generate** → Click "Create New API Key"
4. **Copy** → Copy your key to clipboard
5. **Paste** → Return to terminal and paste your key
6. **Done** → Tool validates and saves your configuration

</div>

### Step 2: Choose Your Configuration

| Question | Options | Result |
|----------|---------|--------|
| **Which tool?** | Claude Code / Codex / Both | Configures selected tools |
| **Setup level?** | System / Project | Determines config location |
| **Confirm?** | Yes / No | Applies configuration |

## 📋 Prerequisites

Before running the setup tool, ensure you have installed:

<table>
<tr>
<td align="center">

  ### Claude Code

  [Download](https://claude.ai/code)

  Desktop AI coding assistant

</td>
<td align="center">

  ### Codex/Windsurf

  [Download](https://openai.com/codex)

  AI-powered code editor

</td>
</tr>
</table>

## 🛠️ Advanced Usage

### Environment Variables

```bash
# Enable debug output
DEBUG=* npx megallm

# Skip welcome banner
NO_BANNER=1 npx megallm

# Combine options
DEBUG=* NO_BANNER=1 npx megallm
```

### Manual Configuration

If you prefer manual setup, edit these files directly:

<details>
<summary><b>Claude Code Configuration</b></summary>

Location: `~/.claude/settings.json`

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
</details>

<details>
<summary><b>Codex/Windsurf Configuration</b></summary>

Location: `~/.codex/config.toml`

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
</details>

## 🐛 Troubleshooting

<details>
<summary><b>Tool Not Detected</b></summary>

- Ensure Claude Code or Codex is installed
- Check configuration directories exist:
  - Claude: `~/.claude/`
  - Codex: `~/.codex/`
- Try restarting your terminal
</details>

<details>
<summary><b>Configuration Not Applied</b></summary>

- Restart your terminal/shell
- For project configs, verify you're in the right directory
- Check file permissions: `ls -la ~/.claude/` or `~/.codex/`
</details>

<details>
<summary><b>API Key Issues</b></summary>

- Verify key is valid at [megallm.io](https://megallm.io)
- Check for extra spaces or characters
- Ensure key has proper permissions
- Try regenerating the key if needed
</details>

## 📚 Documentation

- 📖 [MegaLLM Documentation](https://docs.megallm.io/)
- ❓ [Frequently Asked Questions (FAQ)](FAQ.md)
- 🤖 [Claude Code Docs](https://docs.claude.com/claude-code)
- 💻 [API Reference](https://docs.megallm.io/api)

## 🤝 Contributing

We welcome contributions! Here's how to get started:

```bash
# Fork and clone
git clone https://github.com/yourusername/megallm-npm
cd megallm-npm

# Install dependencies
npm install

# Make changes and test
npm start

# Submit PR
git push origin feature/your-feature
```

## 💬 Support

<div align="center">

| Channel | Link |
|---------|------|
| 📧 **Email** | [support@megallm.io](mailto:support@megallm.io) |
| 🐛 **Issues** | [GitHub Issues](https://github.com/Megallm/megallm-npm/issues) |
| 💬 **Discord** | [Join Community](https://discord.gg/megallm) |
| 📚 **Docs** | [Documentation](https://docs.megallm.io) |

</div>

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">

  **Built with ❤️ by the [MegaLLM](https://megallm.io) Team**

  ⭐ Star us on [GitHub](https://github.com/Megallm/megallm-npm)

</div>