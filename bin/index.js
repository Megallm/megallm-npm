#!/usr/bin/env node

// Entry point for the MegaLLM setup CLI
(async () => {
  try {
    const { default: main } = await import('../src/cli.js');

    // Call main function if it exists
    if (typeof main === 'function') {
      main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error('Failed to start MegaLLM CLI:', error.message);
    process.exit(1);
  }
})();