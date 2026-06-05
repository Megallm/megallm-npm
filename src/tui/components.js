// Reusable Ink building blocks shared across the hub, login, and wizard screens.
import gradient from 'gradient-string';
import spinners from 'unicode-animations';
import { html, Box, Text, useState, useEffect, useMemo } from './h.js';
import { buildWordmarkGrid, renderShimmerFrame, shimmerSpan } from './shimmer.js';

// Tasteful 2-stop gradient — stays in the cool blue/cyan family so the banner
// reads as "premium tooling" rather than "rainbow toy".  Falls back to plain
// cyan on terminals that can't render truecolor (gradient-string handles that).
const BRAND_GRADIENT = gradient(['#22d3ee', '#3b82f6']); // cyan-400 → blue-500

// Build the plain-text "MegaLLM" wordmark grid once at module-load. The
// `<ShimmerWordmark/>` component re-colours it per frame for the diagonal
// sweep, so we don't bake any colour in here.
const WORDMARK_GRID = buildWordmarkGrid('MegaLLM');

// Width of the wordmark (used to size the rule under the banner).
const WORDMARK_W = 70;

/**
 * Animated cfonts wordmark with a translucent diagonal shimmer that travels
 * top-left → bottom-right while the base colour stays brand-blue.
 */
export function ShimmerWordmark() {
  const span = useMemo(() => shimmerSpan(WORDMARK_GRID), []);
  const [pos, setPos] = useState(span.start);
  useEffect(() => {
    const t = setInterval(() => {
      setPos((p) => (p + span.step > span.end ? span.start : p + span.step));
    }, span.intervalMs);
    return () => clearInterval(t);
  }, [span]);
  const lines = renderShimmerFrame(WORDMARK_GRID, pos);
  return html`
    <${Box} flexDirection="column">
      ${lines.map((line, i) => html`<${Text} key=${i}>${line}</>`)}
    </>
  `;
}

/**
 * Animated braille loading indicator driven by `unicode-animations`.
 * Default `braille` spinner is a 1-char drop-in for `<Spinner type="dots" />`.
 * Pass `name="dna" | "pulse" | "braillewave" | …` for richer animations.
 */
export function BrailleSpinner({ name = 'braille', color = 'cyan' }) {
  const sp = spinners[name] || spinners.braille;
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % sp.frames.length), sp.interval);
    return () => clearInterval(t);
  }, [name]);
  return html`<${Text} color=${color}>${sp.frames[frame]}</>`;
}

/** Compact, themed panel with a coloured title bar. */
export function Panel({ title, color = 'cyan', children, marginBottom = 0 }) {
  return html`
    <${Box}
      flexDirection="column"
      borderStyle="round"
      borderColor=${color}
      paddingX=${1}
      marginBottom=${marginBottom}
    >
      ${title
        ? html`<${Box} marginBottom=${0}><${Text} bold color=${color}>${title}</></>`
        : null}
      ${children}
    </>
  `;
}

/** A two-column "label : value" row used in status / whoami / hub panels. */
export function Row({ label, value, valueColor = 'white', labelWidth = 14 }) {
  return html`
    <${Box}>
      <${Box} width=${labelWidth}>
        <${Text} color="gray">${label}</>
      </>
      <${Text} color=${valueColor}>${value || '—'}</>
    </>
  `;
}

/** ✓ / ✗ tool-status line for the tools panel. */
export function ToolRow({ label, ok, detail }) {
  return html`
    <${Box}>
      <${Text} color=${ok ? 'green' : 'gray'}>${ok ? '✓' : '✗'} </>
      <${Box} width=${14}>
        <${Text} color=${ok ? 'white' : 'gray'}>${label}</>
      </>
      <${Text} color="gray">${detail || (ok ? 'configured' : 'not configured')}</>
    </>
  `;
}

/**
 * Big branded welcome banner: animated shimmer wordmark, a thick gradient
 * rule, and a two-row tagline.
 */
export function Banner({
  subtitle = 'Sign in once. Use Claude Code, Codex, OpenCode.',
  hint = 'Docs at megallm.io  ·  /help inside any tool',
} = {}) {
  const rule = BRAND_GRADIENT('━'.repeat(WORDMARK_W));
  return html`
    <${Box} flexDirection="column" marginBottom=${1}>
      <${ShimmerWordmark} />
      <${Text}>${rule}</>
      <${Box} marginTop=${1}>
        <${Text} color="cyan" bold> ✻  </>
        <${Text} bold>${subtitle}</>
      </>
      <${Box}>
        <${Text} color="gray">    ${hint}</>
      </>
    </>
  `;
}

/** Loading skeleton for sections that haven't resolved yet. */
export function PanelLoading({ label }) {
  return html`<${Text} color="gray">  ${label}…</>`;
}



