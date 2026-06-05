// Ink-rendered org picker.  Used by `megallm switch-org` (no argument) and
// by the hub when the user picks "Switch organization".
import { html, Box, Text, render, useApp, useState, useEffect, SelectInput } from './h.js';
import { Banner } from './components.js';
import { restoreStdinForPrompts } from './stdin.js';

function OrgPickerScreen({ orgs, currentOrgId, onPick }) {
  const { exit } = useApp();
  const [picked, setPicked] = useState(null);

  const items = orgs.map(o => ({
    label: `${o.org_id === currentOrgId ? '★ ' : '  '}${o.org_name}` +
           (o.role ? `  (${o.role})` : ''),
    value: o.org_id,
  }));

  function handleSelect({ value }) {
    setPicked(value);
    exit();
    onPick(value);
  }

  return html`
    <${Box} flexDirection="column">
      <${Banner} subtitle="Pick the organization you want to use" />
      <${Box} marginBottom=${1}>
        <${Text} color="cyan" bold>Organizations</>
      </>
      <${SelectInput} items=${items} onSelect=${handleSelect} />
      <${Box} marginTop=${1}>
        <${Text} color="gray">★ marks the currently active org. Press </>
        <${Text} color="white" bold>Ctrl+C</>
        <${Text} color="gray"> to cancel.</>
      </>
    </>
  `;
}

/**
 * @param {Array<{org_id:string, org_name:string, role?:string}>} orgs
 * @param {{ currentOrgId?: string }} [opts]
 * @returns {Promise<string|null>} the selected `org_id`, or null on cancel
 */
export function runInkOrgPicker(orgs, { currentOrgId } = {}) {
  return new Promise((resolve) => {
    let picked = null;
    const { waitUntilExit } = render(
      html`<${OrgPickerScreen} orgs=${orgs} currentOrgId=${currentOrgId} onPick=${(v) => { picked = v; }} />`,
      { exitOnCtrlC: true },
    );
    // Resolve only after Ink has fully unmounted and stdin has been restored,
    // otherwise the next inquirer prompt aborts with "User force closed".
    waitUntilExit()
      .then(async () => { await restoreStdinForPrompts(); resolve(picked); })
      .catch(async () => { await restoreStdinForPrompts(); resolve(null); });
  });
}
