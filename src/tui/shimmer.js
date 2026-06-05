// Diagonal shimmer animation over the cfonts "MegaLLM" wordmark.
//
// Strategy: render the wordmark once with cfonts as plain text (white-only),
// strip the ANSI to get a 2D char grid, then per frame build a coloured
// version of each line where the base colour is brand-blue and a translucent
// "stripe" — diagonal index `col + row*2 - shimmerPos` within ±STRIPE/2 —
// brightens those characters toward white. Negative-space chars are skipped
// so only the block letters animate.

import cfonts from 'cfonts';

// Brand blue (always-on) and the highlight the stripe sweeps in.
const BASE      = [59, 130, 246];   // tailwind blue-500
const HIGHLIGHT = [212, 240, 255];  // cool-white shimmer

const STRIPE = 16;            // width of the bright band
const FRAME_STEP = 2;         // chars-of-diagonal per frame
const FRAME_MS = 55;          // ms per frame

const ANSI_RE = /\x1B\[[0-9;]*m/g;
const stripAnsi = (s) => s.replace(ANSI_RE, '');
const ansi = ([r, g, b]) => `\x1B[38;2;${r};${g};${b}m`;
const RESET = '\x1B[0m';

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Render the wordmark and return it as an array of plain-text lines. */
export function buildWordmarkGrid(text = 'MegaLLM') {
  const raw = cfonts.render(text, {
    font: 'block',
    colors: ['white'],
    align: 'left',
    space: false,
    lineHeight: 0,
    env: 'node',
  });
  // Drop the leading blank line cfonts emits.
  return raw.array
    .map(stripAnsi)
    .filter((l, i, arr) => !(i === 0 && l.trim() === '') && !(i === arr.length - 1 && l.trim() === ''));
}

/** Total diagonal travel distance from off-screen-left to off-screen-right. */
export function shimmerSpan(grid) {
  const cols = Math.max(...grid.map((l) => l.length));
  const rows = grid.length;
  return {
    start: -STRIPE,
    end:   cols + rows * 2 + STRIPE,
    rows,
    cols,
    step: FRAME_STEP,
    intervalMs: FRAME_MS,
  };
}

/**
 * Build the ANSI-coloured version of `grid` for a given shimmer position.
 * Returns one string per row.
 */
export function renderShimmerFrame(grid, shimmerPos) {
  return grid.map((line, row) => {
    let out = '';
    let lastKey = null;
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === ' ' || ch === '\t') {
        if (lastKey !== null) { out += RESET; lastKey = null; }
        out += ch;
        continue;
      }
      // Diagonal index: row*2 keeps the slope visually 45° given that block
      // characters are about twice as tall as wide.
      const d = col + row * 2 - shimmerPos;
      let color = BASE;
      if (d >= 0 && d <= STRIPE) {
        // Bell curve across the stripe so edges fade nicely.
        const t = 1 - Math.abs((d - STRIPE / 2) / (STRIPE / 2));
        color = lerp(BASE, HIGHLIGHT, t);
      }
      const key = color[0] * 65536 + color[1] * 256 + color[2];
      if (key !== lastKey) {
        out += ansi(color);
        lastKey = key;
      }
      out += ch;
    }
    return out + RESET;
  });
}

/**
 * Drive a one-shot shimmer pass on stdout (used by the wizard's banner).
 * Resolves once the stripe has crossed the wordmark and the final all-blue
 * frame is on screen. Non-TTY environments fall back to a static frame.
 */
export async function playShimmerOnce(grid, { passes = 1 } = {}) {
  if (!process.stdout.isTTY) {
    process.stdout.write(grid.map((l) => ansi(BASE) + l + RESET).join('\n') + '\n');
    return;
  }
  const span = shimmerSpan(grid);
  const lineCount = grid.length;

  // Reserve `lineCount` blank lines we'll overwrite each frame.
  process.stdout.write('\n'.repeat(lineCount));

  const writeFrame = (pos) => {
    const lines = renderShimmerFrame(grid, pos);
    process.stdout.write(`\x1B[${lineCount}A`); // cursor up
    for (const l of lines) process.stdout.write('\r' + l + '\x1B[K\n');
  };

  for (let p = 0; p < passes; p++) {
    for (let pos = span.start; pos <= span.end; pos += span.step) {
      writeFrame(pos);
      await new Promise((r) => setTimeout(r, span.intervalMs));
    }
  }
  // Settle on a clean all-blue frame.
  writeFrame(span.end + 999);
}
