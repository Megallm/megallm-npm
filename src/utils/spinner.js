// Wraps ora with a unicode-animations braille spinner so every loading state
// in the CLI shares the same animated braille style.
import ora from 'ora';
import spinners from 'unicode-animations';

const DEFAULT_NAME = 'dna';

/**
 * Drop-in replacement for `ora(text)` / `ora({ text, ... })` that renders with
 * a braille spinner from `unicode-animations`.
 *
 * @param {string|object} opts Either a text string or full ora options.
 * @param {string} [name='dna'] Any unicode-animations spinner name
 *   (`braille`, `braillewave`, `dna`, `pulse`, `orbit`, `sparkle`, …).
 */
export function brailleOra(opts = {}, name = DEFAULT_NAME) {
  if (typeof opts === 'string') opts = { text: opts };
  const sp = spinners[name] || spinners[DEFAULT_NAME];
  return ora({
    ...opts,
    spinner: { frames: sp.frames, interval: sp.interval },
  });
}

export default brailleOra;
