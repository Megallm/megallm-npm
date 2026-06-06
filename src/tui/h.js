// Tiny ergonomic wrapper around `htm` + `react` so we can author Ink screens
// without a JSX build step. Re-exports the Ink primitives we use most often
// so individual screens only need to import from here.
import { createElement } from 'react';
import htmFactory from 'htm';

export {
  Box,
  Text,
  Newline,
  useApp,
  useInput,
  useFocus,
  useStdin,
  render,
} from 'ink';

export { default as SelectInput } from 'ink-select-input';
export { default as Spinner } from 'ink-spinner';

export { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Tagged-template renderer. Usage:
 *   import { html, Box, Text } from './h.js';
 *   const App = () => html`<${Box}><${Text} color="cyan">hi</></>`;
 */
export const html = htmFactory.bind(createElement);
