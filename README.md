# MegaLLM CLI

<div align="center">

  <h3>Sign in once. Use Claude Code, Codex, and OpenCode through MegaLLM.</h3>

  [![NPM Version](https://img.shields.io/npm/v/megallm.svg)](https://www.npmjs.com/package/megallm)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](https://github.com/Megallm/megallm-npm)

  [**Quick Start**](#quick-start) • [**Commands**](#commands) • [**OpenCode**](#configuring-opencode) • [**Profiles**](#profiles) • [**Troubleshooting**](#troubleshooting)

</div>

---

## Quick Start

```bash
npx megallm@latest
```

Lands on the interactive hub: shows your current account, detects installed tools, and lets you sign in or configure them with a single arrow-key choice.

Prefer a one-shot command? All of these work too:

```bash
npx megallm login              # OAuth device flow → saves a key
npx megallm setup              # Full wizard (sign in or paste a key, configure tools)
npx megallm link claude        # Wire one tool with the saved key
npx megallm doctor             # Diagnose every check
```

---

## Why MegaLLM CLI

- **Single sign-in** for Claude Code, Codex, and OpenCode — no copy-pasting keys per tool.
- **OAuth device flow** (RFC 8628) opens the browser, lands on `/activate`, mints a per-org API key.
- **Surgical config edits** — your existing settings (other providers, custom plugins, model overrides) are preserved.
- **Multi-profile** — keep work and personal accounts side-by-side under `~/.megallm/profiles/`.
- **Scriptable** — every interactive screen has a non-TTY plain-text equivalent for CI.

---

## Commands

| Command | What it does |
|---|---|
| `megallm` | Open the interactive hub (auto-detects TTY; prints `--help` when piped). |
| `megallm setup` | Full wizard: sign in or paste a key, then configure detected tools. |
| `megallm login` | OAuth device flow. After success, asks if you want to wire detected tools. |
| `megallm logout` | Revoke the saved key on the server and clear local creds. |
| `megallm whoami` | Identity behind the current saved key. |
| `megallm status` | Plain-text snapshot of identity + detected tools. |
| `megallm doctor` | Run every health check (creds, tool configs, env vars). |
| `megallm orgs` | List orgs you can switch into. |
| `megallm switch-org [<id>]` | Switch active org and mint a fresh per-org key. Picker is interactive. |
| `megallm keys list [--org <id>]` | List API keys in the active (or given) org. |
| `megallm keys revoke <key_id>` | Revoke a key by id. |
| `megallm link <tool>` | Wire one tool (`claude`, `codex`, `opencode`). |
| `megallm unlink <tool>` | Surgically remove the MegaLLM keys from one tool. |
| `megallm profile list` | List saved credential profiles. |
| `megallm profile use <name>` | Make `<name>` the active profile. |
| `megallm profile rm <name>` | Delete a saved profile. |

Global flags: `--profile <name>` (or `-p`, also `MEGALLM_PROFILE` env), `--help`, `--version`.

---

## How It Works

```
            ┌─────────────────────────────────┐
            │  npx megallm  (interactive hub) │
            └────────────────┬────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   megallm login       megallm setup        megallm link <tool>
        │                    │                    │
        ▼                    ▼                    ▼
   /activate page     wizard chooses     wire one tool only
   browser approve   tools + level + key
        │                    │                    │
        └─────── api key ────┴──── apiKey ────────┘
                             │
                             ▼
            ┌─────────────────────────────────┐
            │ ~/.megallm/profiles/<name>/     │
            │   auth.json   (chmod 0600)      │
            │   state.json                    │
            └────────────────┬────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
   Claude Code           Codex                 OpenCode
   ~/.claude/         ~/.codex/             ~/.config/opencode/
   settings.json      config.toml           opencode.json
```

---

## What Gets Written Where

### Claude Code — `~/.claude/settings.json`

The CLI **adds** these two env keys, leaves everything else untouched:

```jsonc
{
  // …your existing config (theme, model, plugins) is preserved…
  "env": {
    "ANTHROPIC_BASE_URL": "https://ai.megallm.io",
    "ANTHROPIC_API_KEY": "sk-mega-…"
  }
}
```

It also approves the key prefix in `~/.claude.json` so Claude Code stops re-prompting.

### Codex — `~/.codex/config.toml`

Adds a `megallm` provider, switches `model_provider` to it, leaves your other providers in place:

```toml
model_provider = "megallm"
model = "gpt-5"

[model_providers.megallm]
name = "OpenAI using Chat Completions"
base_url = "https://ai.megallm.io/v1"
env_key = "MEGALLM_API_KEY"
query_params = {}
```

The key is **not written into the TOML** — it's read from `MEGALLM_API_KEY`, which the CLI exports into your shell rc (`~/.zshrc`, `~/.bashrc`, etc.).

### OpenCode — `~/.config/opencode/opencode.json`

Adds `provider.anthropic` pointing at MegaLLM, plus a fallback list of non-Anthropic models. Other providers (e.g. `chutes`, `google`) are preserved:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    // …other providers untouched…
    "anthropic": {
      "models": {
        "gpt-5":      { "id": "gpt-5",      "name": "GPT-5 (Via MegaLLM)" },
        "gpt-4o":     { "id": "gpt-4o",     "name": "GPT-4o (Via MegaLLM)" },
        "gpt-4o-mini":{ "id": "gpt-4o-mini","name": "GPT-4o Mini (Via MegaLLM)" }
      },
      "options": {
        "apiKey": "{env:MEGALLM_API_KEY}",
        "baseURL": "https://ai.megallm.io/v1"
      }
    }
  }
}
```

When `MegaLLM` reaches your account, the CLI fetches the **live model list** from `https://ai.megallm.io/models` and writes those instead of the three-model fallback above.

---

## Configuring OpenCode

Two equivalent paths:

```bash
# A — explicit, single tool
npx megallm login            # one-time sign-in
npx megallm link opencode    # writes the provider block above

# B — interactive
npx megallm                  # pick "Configure / re-configure tools"
```

Verify:

```bash
npx megallm doctor           # → "✓ OpenCode configured for MegaLLM"
```

To remove just the MegaLLM provider from OpenCode (keeps everything else):

```bash
npx megallm unlink opencode
```

---

## Profiles

Multiple accounts? Pass `--profile` to any command, or set `MEGALLM_PROFILE`:

```bash
megallm login --profile work
megallm login --profile personal

megallm profile list              # ★ marks the active one
megallm profile use work          # switch
megallm whoami --profile personal # one-shot override
```

Profiles live in `~/.megallm/profiles/<name>/`:

```
~/.megallm/
├── config.json              # { "current_profile": "work" }
└── profiles/
    ├── work/
    │   ├── auth.json        # chmod 0600 — apiKey, scopes, user, orgId
    │   └── state.json       # cached orgs list
    └── personal/
        ├── auth.json
        └── state.json
```

---

## Doctor

`megallm doctor` runs every check the CLI knows about and prints a green/yellow/red report:

- Node 18+
- `~/.megallm` exists with `0700`, `auth.json` with `0600`
- Saved key is accepted by the backend (`/oauth/userinfo`)
- All four scopes present (`api:use`, `profile:read`, `keys:read`, `keys:manage`)
- Each tool installed, with config that points at MegaLLM
- Env vars `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `MEGALLM_API_KEY` are exported

Exits non-zero on any critical failure — wire it into CI to catch drift.

---

## Installation Options

```bash
# One-shot (recommended)
npx megallm@latest

# Globally
npm install -g megallm
megallm

# Pin a version
npx megallm@2.8.0
```

Requires **Node 18 or newer** (Ink uses ESM).

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `MEGALLM_PROFILE` | Active credential profile | `default` |
| `MEGALLM_WEB_URL` | Web app URL (OAuth host) | `https://megallm.io` |
| `MEGALLM_CLI_CLIENT_ID` | OAuth `client_id` for the CLI | `mega_pub_cli` |
| `DEBUG` | Print stack traces on error | unset |

The CLI exports these into your shell rc when it wires up tools:

| Variable | Read by |
|---|---|
| `ANTHROPIC_BASE_URL` | Claude Code |
| `ANTHROPIC_API_KEY` | Claude Code |
| `MEGALLM_API_KEY` | Codex, OpenCode |

After install, `source ~/.zshrc` (or open a new shell) to pick them up.

---

## Troubleshooting

<details>
<summary><b>"Saved key is no longer valid"</b></summary>

The server rejected the bearer key. Either you revoked it from the dashboard, or the OAuth app is missing scopes. Re-login:

```bash
megallm logout
megallm login
```

Make sure your OAuth app at `/dashboard/developers` has all four scopes ticked: `api:use`, `profile:read`, `keys:read`, `keys:manage`.
</details>

<details>
<summary><b>Tool detected but doctor says "not configured for MegaLLM"</b></summary>

The tool's config file exists but doesn't have the MegaLLM block. Wire it:

```bash
megallm link claude
megallm link codex
megallm link opencode
```
</details>

<details>
<summary><b>"MEGALLM_API_KEY environment variable not set" warning</b></summary>

Codex and OpenCode read the key from the env, not the config file. The CLI writes the export to your shell rc; you just need to reload:

```bash
source ~/.zshrc       # or ~/.bashrc
```

Or open a new terminal.
</details>

<details>
<summary><b>I want to keep my existing Codex / OpenCode setup</b></summary>

You can. The configurators **merge** instead of overwriting — your other providers, models, plugins, and tools stay intact. To verify, diff before/after:

```bash
cp ~/.config/opencode/opencode.json /tmp/before.json
megallm link opencode
diff /tmp/before.json ~/.config/opencode/opencode.json
```
</details>

<details>
<summary><b>Switch organizations</b></summary>

```bash
megallm switch-org           # interactive picker
megallm switch-org org_abc   # direct
```

Switching mints a fresh per-org API key, replaces the saved key, and rewrites all linked tools to use it.
</details>

---

## Documentation

- [MegaLLM Docs](https://docs.megallm.io/)
- [FAQ](FAQ.md)
- [Claude Code](https://docs.claude.com/claude-code)
- [OpenCode](https://opencode.ai)

---

## Support

| | |
|---|---|
| Email | [support@megallm.io](mailto:support@megallm.io) |
| Issues | [GitHub Issues](https://github.com/Megallm/megallm-npm/issues) |
| Discord | [Join Community](https://discord.gg/megallm) |
| Docs | [docs.megallm.io](https://docs.megallm.io) |

---

## License

MIT — see [LICENSE](LICENSE).

<div align="center">

  Built by the [MegaLLM](https://megallm.io) team.
  Star us on [GitHub](https://github.com/Megallm/megallm-npm).

</div>
