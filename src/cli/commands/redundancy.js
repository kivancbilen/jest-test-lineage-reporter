/**
 * Redundancy Command
 * Find `it` blocks that exercise almost the same lines, and say what to do
 * about each one. Works off existing lineage data — no test re-run needed.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { loadLineageData } = require("../utils/data-loader");
const { section, error } = require("../utils/output-formatter");
const OverlapAnalyzer = require("../../OverlapAnalyzer");
const RedundancyReport = require("../../RedundancyReport");
const logger = require("../../logger");

/**
 * Build the reporter's coverageData shape straight from the raw lineage file.
 * Kept local rather than reusing processLineageDataForMutation so that the
 * metadata suffixes (:depth/:meta/:performance) are filtered identically to the
 * HTML path and both entry points report the same findings.
 */
function toCoverageData(rawData) {
  const coverage = {};

  for (const test of rawData.tests || []) {
    if (!test || !test.coverage) continue;

    for (const key of Object.keys(test.coverage)) {
      const parts = key.split(":");
      if (parts.length < 2) continue;

      const last = parts[parts.length - 1];
      // Metadata entries end in a word suffix rather than a line number.
      if (!/^\d+$/.test(last)) continue;

      const lineNumber = parts.pop();
      const filePath = parts.join(":");

      if (
        filePath.includes("__tests__") ||
        filePath.includes(".test.") ||
        filePath.includes(".spec.") ||
        filePath.includes("node_modules")
      ) {
        continue;
      }

      coverage[filePath] = coverage[filePath] || {};
      coverage[filePath][lineNumber] = coverage[filePath][lineNumber] || [];
      coverage[filePath][lineNumber].push({
        name: test.name,
        file: test.testFile || "unknown-test-file",
        duration: test.duration || 0,
      });
    }
  }

  return coverage;
}

async function redundancyCommand(options = {}) {
  try {
    const rawData = loadLineageData(options.data);
    const coverageData = toCoverageData(rawData);

    const analyzerOptions = {};
    if (options.minSimilarity !== undefined) {
      analyzerOptions.minWeightedSimilarity = Number(options.minSimilarity);
    }
    if (options.minLines !== undefined) {
      analyzerOptions.minLinesPerTest = Number(options.minLines);
    }

    const analysis = new OverlapAnalyzer(
      coverageData,
      analyzerOptions,
    ).analyze();
    const report = new RedundancyReport(analysis);

    // --json prints the machine-readable payload to stdout and nothing else, so
    // it can be piped straight into a tool or an agent.
    if (options.json) {
      process.stdout.write(JSON.stringify(report.toJSON(), null, 2) + "\n");
      return;
    }

    if (options.markdown) {
      process.stdout.write(report.toMarkdown() + "\n");
      return;
    }

    const outputDir = options.out ? path.resolve(options.out) : process.cwd();
    if (options.out && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const { jsonPath, markdownPath, findings } = report.write(outputDir);

    const data = report.toJSON();
    section("🔁 Test Redundancy");
    logger.info(
      `${data.summary.testsAnalysed} tests analysed · ` +
        `${chalk.bold(findings)} findings · ` +
        `${data.summary.removableTests} tests could go · ` +
        `${(data.summary.removableDurationMs / 1000).toFixed(1)}s of runtime`,
    );
    logger.info("");

    for (const finding of data.findings.slice(0, 10)) {
      const colour =
        finding.verdict === "identical"
          ? chalk.red
          : finding.verdict === "near-identical"
            ? chalk.yellow
            : chalk.cyan;
      logger.info(`${colour(finding.verdict.padEnd(15))} ${finding.headline}`);
      for (const test of finding.tests) {
        const tag =
          test.role === "keep" ? chalk.green("keep  ") : chalk.red("remove");
        logger.info(`  ${tag} ${test.name}`);
        logger.info(`         ${chalk.gray(test.location)}`);
      }
      logger.info("");
    }

    if (data.findings.length > 10) {
      logger.info(
        chalk.gray(`… ${data.findings.length - 10} more in the JSON.`),
      );
    }

    logger.info(`📄 ${jsonPath}`);
    logger.info(`📝 ${markdownPath}`);
  } catch (err) {
    error(err.message);
    if (options.verbose) logger.error(err.stack);
    process.exitCode = 1;
  }
}

module.exports = redundancyCommand;
module.exports.toCoverageData = toCoverageData;
