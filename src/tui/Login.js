// Ink screen rendered while the device-flow login is in progress.
// Shows the verification URL + user code in a big bordered box, with a live
// spinner that updates with seconds-left and the current state.
import { html, Box, Text, render, useState, useEffect, useApp } from './h.js';
import { Panel, Banner, BrailleSpinner } from './components.js';
import { restoreStdinForPrompts } from './stdin.js';
import { startDeviceFlow, pollForToken, fetchUserInfo, openInBrowser } from '../auth/oauth.js';
import { listOrgs } from '../auth/api.js';
import { writeAuth, writeState, ensureMegallmHome } from '../auth/store.js';
import { OAUTH_CLIENT_ID, OAUTH_SCOPES, DEFAULT_PROFILE } from '../constants.js';
import { maskApiKey } from '../auth/store.js';

const STATES = {
  REQUESTING: 'requesting',     // POST /device/code
  WAITING:    'waiting',        // polling /token
  FETCHING:   'fetching',       // userinfo + orgs
  SUCCESS:    'success',
  FAILED:     'failed',
};

function LoginScreen({ profile, onComplete }) {
  const { exit } = useApp();
  const [state, setState] = useState(STATES.REQUESTING);
  const [device, setDevice] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Subtle 3-frame celebration on success: green → cyan → green, then settle.
  const [shimmerColor, setShimmerColor] = useState('green');

  // Drive the OAuth flow.
  useEffect(() => {
    let cancelled = false;
    let abort = new AbortController();

    (async () => {
      try {
        await ensureMegallmHome();

        const dev = await startDeviceFlow({ clientId: OAUTH_CLIENT_ID, scopes: OAUTH_SCOPES });
        if (cancelled) return;
        setDevice(dev);
        setSecondsLeft(dev.expires_in || 900);
        setState(STATES.WAITING);

        const url = dev.verification_uri_complete || dev.verification_uri;
        if (url) openInBrowser(url);

        const token = await pollForToken({
          device_code: dev.device_code,
          interval: dev.interval || 5,
          expires_in: dev.expires_in || 900,
          clientId: OAUTH_CLIENT_ID,
          signal: abort.signal,
          onTick: ({ secondsLeft: s }) => { if (!cancelled) setSecondsLeft(s); },
        });
        if (cancelled) return;

        setState(STATES.FETCHING);

        const apiKey = token.api_key;
        let user = null;
        try { user = await fetchUserInfo(apiKey); } catch { /* tolerate */ }
        let orgs = [];
        try { orgs = await listOrgs(apiKey); } catch { /* tolerate */ }
        const activeOrg = orgs[0] || null;

        const record = {
          apiKey,
          keyPrefix: token.key_prefix || apiKey.slice(0, 16),
          scopes: token.scopes || OAUTH_SCOPES,
          user: user || null,
          orgId: activeOrg?.org_id || null,
          orgName: activeOrg?.org_name || null,
          clientId: OAUTH_CLIENT_ID,
        };
        await writeAuth(record, profile);
        await writeState({
          current_org_id: record.orgId,
          current_org_name: record.orgName,
          orgs,
        }, profile);

        if (cancelled) return;
        setResult(record);
        setState(STATES.SUCCESS);
        // Brief, restrained celebration: cycle the success-line colour through
        // green → cyan → green over ~900ms, then settle and unmount.
        const frames = ['cyan', 'green', 'cyan', 'green'];
        let f = 0;
        const shimmer = setInterval(() => {
          f += 1;
          if (f >= frames.length) { clearInterval(shimmer); return; }
          setShimmerColor(frames[f]);
        }, 220);
        setTimeout(() => { clearInterval(shimmer); exit(); onComplete?.(null, record); }, 1200);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || String(err));
        setState(STATES.FAILED);
        setTimeout(() => { exit(); onComplete?.(err, null); }, 800);
      }
    })();

    return () => { cancelled = true; abort.abort(); };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────
  if (state === STATES.REQUESTING) {
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Box}>
          <${BrailleSpinner} name="dna" color="cyan" />
          <${Text}> Requesting a device code from MegaLLM…</>
        </>
      </>
    `;
  }

  if (state === STATES.WAITING && device) {
    const url = device.verification_uri || '';
    const code = device.user_code || '';
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Banner} subtitle="Sign in to MegaLLM" />
        <${Panel} title="Open this URL in your browser" color="cyan" marginBottom=${1}>
          <${Text} color="white" bold>  ${url}</>
        </>
        <${Panel} title="And enter this code" color="yellow" marginBottom=${1}>
          <${Text} color="yellow" bold>  ${code}</>
        </>
        <${Box}>
          <${BrailleSpinner} name="pulse" color="cyan" />
          <${Text}> Waiting for authorization… <${Text} color="gray">(${secondsLeft}s left)</></>
        </>
        <${Box} marginTop=${1}>
          <${Text} color="gray">Press </>
          <${Text} color="white" bold>Ctrl+C</>
          <${Text} color="gray"> to cancel.</>
        </>
      </>
    `;
  }

  if (state === STATES.FETCHING) {
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Box}>
          <${Text} color="green">✓</>
          <${Text}> Authorized</>
        </>
        <${Box}>
          <${BrailleSpinner} name="braillewave" color="cyan" />
          <${Text}> Loading account & organizations…</>
        </>
      </>
    `;
  }

  if (state === STATES.SUCCESS && result) {
    const who = result.user?.name || result.user?.email || 'MegaLLM user';
    const where = result.orgName ? ` · org: ${result.orgName}` : '';
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Box}>
          <${Text} color=${shimmerColor} bold>✓ Signed in as ${who}${where}</>
        </>
        <${Box}>
          <${Text} color="gray">  Key: ${maskApiKey(result.apiKey)}  ·  Profile: ${profile}</>
        </>
      </>
    `;
  }

  if (state === STATES.FAILED) {
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Text} color="red" bold>✗ Login failed</>
        <${Text} color="gray">  ${error}</>
      </>
    `;
  }

  return null;
}

/**
 * Render the Ink login screen. Resolves with the saved auth record on success.
 *
 * @param {{ profile?: string }} opts
 * @returns {Promise<object>}
 */
export function runInkLogin({ profile = DEFAULT_PROFILE } = {}) {
  return new Promise((resolve, reject) => {
    // Stash the result locally; the outer promise only settles once Ink has
    // fully unmounted (waitUntilExit) AND stdin has been restored. Resolving
    // earlier would race with Ink's teardown and leave raw-mode listeners
    // attached, which then cause @inquirer/prompts to abort with
    // "User force closed the prompt".
    let savedErr = null;
    let savedRec = null;

    const { waitUntilExit } = render(
      html`<${LoginScreen} profile=${profile} onComplete=${(err, rec) => {
        savedErr = err; savedRec = rec;
      }} />`,
      { exitOnCtrlC: true },
    );

    waitUntilExit()
      .then(async () => {
        await restoreStdinForPrompts();
        if (savedErr) reject(savedErr);
        else if (savedRec) resolve(savedRec);
        else reject(new Error('Login cancelled'));
      })
      .catch(async (err) => {
        await restoreStdinForPrompts();
        reject(savedErr || err);
      });
  });
}
