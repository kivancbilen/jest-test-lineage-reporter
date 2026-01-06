#!/usr/bin/env node

/**
 * Jest Test Lineage Reporter CLI
 * Main entry point for command-line interface
 */

const cli = require('../src/cli');

// Run CLI with error handling
cli.run(process.argv).catch((error) => {
  console.error('\n❌ Error:', error.message);

  if (process.env.JEST_LINEAGE_DEBUG === 'true') {
    console.error('\nStack trace:');
    console.error(error.stack);
  }

  process.exit(1);
});
