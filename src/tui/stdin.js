// Hand stdin back to plain readline-style prompts (e.g. @inquirer/prompts)
// after an Ink screen has unmounted.
//
// Two real issues we have to work around:
//
// 1. Ink switches the TTY into raw mode and adds 'data' / 'keypress'
//    listeners.  Even after `useApp().exit()` resolves `waitUntilExit`, those
//    handlers can linger for a microtask.
//
// 2. More importantly, between Ink's unmount and the moment a follow-up
//    `@inquirer/prompts.confirm` actually attaches its readline interface,
//    Node's event loop can briefly have no pending work.  When that happens
//    Node fires `process.emit('exit')`, which the `signal-exit` package
//    (used by both Ink AND @inquirer/core) interprets as a real shutdown and
//    rejects every active prompt with "User force closed the prompt with 0 null".
//
// To prevent that, we run a no-op heartbeat interval that keeps the loop
// alive across the handoff.  Callers can release it with `releaseStdinHandoff`.
let heartbeat = null;

export function restoreStdinForPrompts() {
  return new Promise((resolve) => {
    try {
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      // Strip Ink's lingering keystroke listeners. We deliberately do NOT
      // pause stdin; inquirer needs it open and flowing.
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('keypress');
      process.stdin.removeAllListeners('readable');
      process.stdin.resume();
    } catch { /* not a TTY — nothing to restore */ }

    // Heartbeat keeps the event loop pinned so 'exit' isn't spuriously
    // emitted during the Ink → inquirer transition. The first inquirer prompt
    // (or anything else holding stdin open) supersedes it; we just need to
    // bridge the gap. The interval is short-lived in practice — once the
    // caller suspends on a prompt, this fires harmlessly until released.
    if (!heartbeat) heartbeat = setInterval(() => {}, 1000);

    // One event-loop turn lets Ink's teardown finish before we hand off.
    setTimeout(resolve, 50);
  });
}

/** Stop the keep-alive heartbeat (call once your CLI is fully done). */
export function releaseStdinHandoff() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}
