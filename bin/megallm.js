#!/usr/bin/env node
import('../src/cli.js').then(module => {
  const main = module.default;
  if (typeof main === 'function') {
    main().catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
  }
}).catch(error => {
  console.error('Failed to start MegaLLM CLI:', error.message);
  process.exit(1);
});