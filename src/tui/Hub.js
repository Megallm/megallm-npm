// `npx megallm` (no args) interactive hub.
// Loads current state once at mount (profile, identity, tools), shows it as
// status panels, and offers a menu that dispatches to subcommand handlers.
import {
  html, Box, Text, render, useApp, useState, useEffect, SelectInput,
} from './h.js';
import { Banner, Panel, Row, ToolRow, PanelLoading } from './components.js';
import { restoreStdinForPrompts } from './stdin.js';
import {
  readAuth, resolveProfileName, maskApiKey,
} from '../auth/store.js';
import { fetchUserInfo } from '../auth/oauth.js';
import { checkToolsStatus } from '../detectors/tools.js';

function HubScreen({ profile, onPick }) {
  const { exit } = useApp();
  const [auth, setAuth] = useState(undefined);     // undefined = loading; null = signed out
  const [identity, setIdentity] = useState(undefined);
  const [tools, setTools] = useState(undefined);
  const [tipIdx, setTipIdx] = useState(0);

  // Rotating tip footer — cycles a fresh hint every 5s. setInterval is cheap
  // and Ink's reconciler diffs on each tick so only the footer line repaints.
  const TIPS = [
    'every menu item has a direct command — try "megallm --help".',
    'switch profiles with "megallm profile use <name>".',
    'see what\u2019s wired with "megallm doctor".',
    'switch orgs anytime with "megallm switch-org".',
    'list and revoke keys with "megallm keys list".',
  ];
  useEffect(() => {
    const id = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = await readAuth(profile);
      if (cancelled) return;
      setAuth(a);
      if (a?.apiKey) {
        try {
          const u = await fetchUserInfo(a.apiKey);
          if (!cancelled) setIdentity(u || null);
        } catch { if (!cancelled) setIdentity(null); }
      } else {
        setIdentity(null);
      }
      try { setTools(checkToolsStatus()); } catch { setTools({}); }
    })();
    return () => { cancelled = true; };
  }, [profile]);

  const loading = auth === undefined || tools === undefined;

  const items = !auth?.apiKey
    ? [
        { label: 'Sign in to MegaLLM',                            value: 'login' },
        { label: 'Configure tools (paste a key or sign in)',      value: 'setup' },
        { label: 'Exit',                                          value: 'exit' },
      ]
    : [
        { label: 'Configure / re-configure tools',                value: 'setup' },
        { label: 'Switch organization',                           value: 'switch-org' },
        { label: 'Manage API keys',                               value: 'keys' },
        { label: 'Show status',                                   value: 'status' },
        { label: 'Run doctor (diagnose)',                         value: 'doctor' },
        { label: 'Repair tool configs (doctor fix)',              value: 'doctor-fix' },
        { label: 'Sign out',                                      value: 'logout' },
        { label: 'Exit',                                          value: 'exit' },
      ];

  function handleSelect({ value }) {
    exit();
    onPick(value);
  }

  return html`
    <${Box} flexDirection="column">
      <${Banner} />

      <${Panel} title="Account" color=${auth?.apiKey ? 'green' : 'yellow'} marginBottom=${1}>
        ${loading ? html`<${PanelLoading} label="Loading account" />` : (
          !auth?.apiKey
            ? html`<${Text} color="gray">Not signed in. Pick "Sign in" below to begin.</>`
            : html`
                <${Box} flexDirection="column">
                  <${Box} marginBottom=${0}>
                    <${Text} color="green" bold>Welcome back, ${
                      identity?.name || identity?.email || auth.user?.name || auth.user?.email || 'friend'
                    }.</>
                  </>
                  <${Row} label="Email"     value=${identity?.email || auth.user?.email} />
                  <${Row} label="Profile"   value=${profile} />
                  <${Row} label="Org"       value=${auth.orgName || auth.orgId || '(default)'} />
                  <${Row} label="Key"       value=${maskApiKey(auth.apiKey)} />
                </>
              `
        )}
      </>

      <${Panel} title="Tools" color="cyan" marginBottom=${1}>
        ${loading ? html`<${PanelLoading} label="Detecting tools" />` : html`
          <${Box} flexDirection="column">
            <${ToolRow} label="Claude Code" ok=${!!tools?.claude?.installed} detail=${
              tools?.claude?.installed ? (tools.claude.configPath || 'detected') : 'not installed'
            } />
            <${ToolRow} label="Codex"       ok=${!!tools?.codex?.installed} detail=${
              tools?.codex?.installed ? (tools.codex.configPath || 'detected') : 'not installed'
            } />
            <${ToolRow} label="OpenCode"    ok=${!!tools?.opencode?.installed} detail=${
              tools?.opencode?.installed ? (tools.opencode.configPath || 'detected') : 'not installed'
            } />
          </>
        `}
      </>

      <${Box} marginTop=${0}>
        <${Text} color="cyan" bold>What would you like to do?</>
      </>
      <${SelectInput} items=${items} onSelect=${handleSelect} />

      <${Box} marginTop=${1}>
        <${Text} color="gray">Tip: ${TIPS[tipIdx]}</>
      </>
    </>
  `;
}

/**
 * Render the hub and return the user's menu pick once they confirm one.
 *
 * @returns {Promise<'login'|'paste'|'setup'|'switch-org'|'keys'|'status'|'logout'|'exit'>}
 */
export function runInkHub({ profile } = {}) {
  const resolvedProfile = resolveProfileName(profile);
  return new Promise((resolve) => {
    let picked = 'exit';
    const { waitUntilExit } = render(
      html`<${HubScreen} profile=${resolvedProfile} onPick=${(v) => { picked = v; }} />`,
      { exitOnCtrlC: true },
    );
    // Resolve only after Ink has fully unmounted AND stdin has been restored
    // — otherwise the next inquirer prompt opens against raw-mode stdin and
    // immediately aborts with "User force closed the prompt".
    waitUntilExit()
      .then(async () => { await restoreStdinForPrompts(); resolve(picked); })
      .catch(async () => { await restoreStdinForPrompts(); resolve('exit'); });
  });
}
