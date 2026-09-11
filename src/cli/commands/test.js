/**
 * Test Command
 * Run Jest tests with lineage tracking
 */

const { runJest } = require("../utils/jest-runner");
const { loadFullConfig } = require("../utils/config-loader");
const { lineageDataExists } = require("../utils/data-loader");
const { success, error, info } = require("../utils/output-formatter");
const fs = require("fs");
const path = require("path");
const logger = require("../../logger");
const lineageStore = require("../../lineageStore");

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
      quiet: options.quiet,
    });

    // Check if lineage data was generated
    const dataPath = path.join(process.cwd(), ".jest-lineage-data.json");
    // This summary is best-effort: on a very large run the file is too big to
    // parse in one piece, and that must not fail a run that otherwise succeeded.
    const summarizable =
      fs.existsSync(dataPath) &&
      fs.statSync(dataPath).size <= lineageStore.MAX_SAFE_JSON_BYTES;
    if (result.success && summarizable) {
      const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      const testCount = data.tests ? data.tests.length : 0;
      const fileCount = data.tests
        ? new Set(
            data.tests.flatMap((t) =>
              Object.keys(t.coverage || {}).map((k) => k.split(":")[0]),
            ),
          ).size
        : 0;

      if (!options.quiet) {
        info(`Lineage data saved to: ${dataPath}`);
        logger.info(`   - ${testCount} tests tracked`);
        logger.info(`   - ${fileCount} files analyzed\n`);
      }
    } else if (!result.success) {
      error("Tests failed. Lineage data may be incomplete.");
    } else if (fs.existsSync(dataPath) && !options.quiet) {
      info(`Lineage data saved to: ${dataPath}`);
      logger.info(`   - too large to summarize here\n`);
    }

    // Exit with Jest's exit code
    process.exit(result.exitCode);
  } catch (err) {
    error(`Failed to run tests: ${err.message}`);
    process.exit(1);
  }
}

module.exports = testCommand;
