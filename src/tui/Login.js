// Ink screen rendered while the OAuth login is in progress.
//
// Default flow is RFC 8252 §7.3 loopback (CLI binds 127.0.0.1, opens the
// consent screen, exchanges the auth code on callback). Falls back to the
// device-code flow when the env clearly has no desktop browser (SSH boxes,
// headless Linux), or when the user passes --no-browser.
import { html, Box, Text, render, useState, useEffect, useApp } from './h.js';
import { Panel, Banner, BrailleSpinner } from './components.js';
import { restoreStdinForPrompts } from './stdin.js';
import {
  startDeviceFlow,
  pollForToken,
  fetchUserInfo,
  openInBrowser,
  loopbackLogin,
  canUseLoopback,
} from '../auth/oauth.js';
import { listOrgs } from '../auth/api.js';
import { writeAuth, writeState, ensureMegallmHome } from '../auth/store.js';
import { OAUTH_CLIENT_ID, OAUTH_SCOPES, DEFAULT_PROFILE } from '../constants.js';
import { maskApiKey } from '../auth/store.js';

const STATES = {
  STARTING:   'starting',       // deciding which flow + bootstrapping
  AWAITING:   'awaiting',       // browser open, waiting for callback / approval
  FETCHING:   'fetching',       // userinfo + orgs
  SUCCESS:    'success',
  FAILED:     'failed',
};

function LoginScreen({ profile, onComplete, forceDeviceFlow = false }) {
  const { exit } = useApp();
  const [state, setState] = useState(STATES.STARTING);
  const [flow, setFlow] = useState(null); // 'loopback' | 'device'
  const [device, setDevice] = useState(null);   // device-flow data
  const [authUrl, setAuthUrl] = useState('');   // loopback flow URL (fallback)
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

        const useLoopback = !forceDeviceFlow && canUseLoopback();
        setFlow(useLoopback ? 'loopback' : 'device');

        let token;
        if (useLoopback) {
          // Loopback: server starts, browser opens, we wait for the redirect.
          setState(STATES.AWAITING);
          token = await loopbackLogin({
            clientId: OAUTH_CLIENT_ID,
            scopes: OAUTH_SCOPES,
            signal: abort.signal,
            onAuthorizeUrl: (u) => { if (!cancelled) setAuthUrl(u); },
          });
        } else {
          // Device flow: show user_code + URL, poll until approved.
          const dev = await startDeviceFlow({
            clientId: OAUTH_CLIENT_ID,
            scopes: OAUTH_SCOPES,
          });
          if (cancelled) return;
          setDevice(dev);
          setSecondsLeft(dev.expires_in || 900);
          setState(STATES.AWAITING);

          const url = dev.verification_uri_complete || dev.verification_uri;
          if (url) openInBrowser(url);

          token = await pollForToken({
            device_code: dev.device_code,
            interval: dev.interval || 5,
            expires_in: dev.expires_in || 900,
            clientId: OAUTH_CLIENT_ID,
            signal: abort.signal,
            onTick: ({ secondsLeft: s }) => { if (!cancelled) setSecondsLeft(s); },
          });
        }
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
  if (state === STATES.STARTING) {
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Box}>
          <${BrailleSpinner} name="dna" color="cyan" />
          <${Text}> Starting MegaLLM login…</>
        </>
      </>
    `;
  }

  if (state === STATES.AWAITING && flow === 'loopback') {
    return html`
      <${Box} flexDirection="column" paddingY=${1}>
        <${Banner} subtitle="Sign in to MegaLLM" />
        <${Panel} title="Approve this login in your browser" color="cyan" marginBottom=${1}>
          <${Text} color="gray">  A new browser tab should have opened. If not, paste this URL:</>
          <${Text} color="white" bold>  ${authUrl}</>
        </>
        <${Box}>
          <${BrailleSpinner} name="pulse" color="cyan" />
          <${Text}> Waiting for browser approval…</>
        </>
        <${Box} marginTop=${1}>
          <${Text} color="gray">Press </>
          <${Text} color="white" bold>Ctrl+C</>
          <${Text} color="gray"> to cancel.</>
        </>
      </>
    `;
  }

  if (state === STATES.AWAITING && flow === 'device' && device) {
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
 * @param {{ profile?: string, forceDeviceFlow?: boolean }} opts
 * @returns {Promise<object>}
 */
export function runInkLogin({ profile = DEFAULT_PROFILE, forceDeviceFlow = false } = {}) {
  return new Promise((resolve, reject) => {
    // Stash the result locally; the outer promise only settles once Ink has
    // fully unmounted (waitUntilExit) AND stdin has been restored. Resolving
    // earlier would race with Ink's teardown and leave raw-mode listeners
    // attached, which then cause @inquirer/prompts to abort with
    // "User force closed the prompt".
    let savedErr = null;
    let savedRec = null;

    const { waitUntilExit } = render(
      html`<${LoginScreen}
        profile=${profile}
        forceDeviceFlow=${forceDeviceFlow}
        onComplete=${(err, rec) => { savedErr = err; savedRec = rec; }}
      />`,
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
