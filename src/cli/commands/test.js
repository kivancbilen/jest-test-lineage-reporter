/**
 * Test Command
 * Run Jest tests with lineage tracking
 */

const { runJest } = require('../utils/jest-runner');
const { loadFullConfig } = require('../utils/config-loader');
const { lineageDataExists } = require('../utils/data-loader');
const { success, error, info } = require('../utils/output-formatter');
const fs = require('fs');
const path = require('path');

async function testCommand(jestArgs, options) {
  try {
    // Load configuration
    const config = loadFullConfig(options);

    // Run Jest with lineage tracking
    const result = await runJest({
      args: jestArgs || [],
      config: options.config,
      enableLineage: options.lineage !== false,
      enablePerformance: options.performance !== false,
      enableQuality: options.quality !== false,
      quiet: options.quiet
    });

    // Check if lineage data was generated
    const dataPath = path.join(process.cwd(), '.jest-lineage-data.json');
    if (result.success && fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const testCount = data.tests ? data.tests.length : 0;
      const fileCount = data.tests
        ? new Set(data.tests.flatMap(t =>
            Object.keys(t.coverage || {}).map(k => k.split(':')[0])
          )).size
        : 0;

      if (!options.quiet) {
        info(`Lineage data saved to: ${dataPath}`);
        console.log(`   - ${testCount} tests tracked`);
        console.log(`   - ${fileCount} files analyzed\n`);
      }
    } else if (!result.success) {
      error('Tests failed. Lineage data may be incomplete.');
    }

    // Exit with Jest's exit code
    process.exit(result.exitCode);
  } catch (err) {
    error(`Failed to run tests: ${err.message}`);
    process.exit(1);
  }
}

module.exports = testCommand;
