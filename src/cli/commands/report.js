/**
 * Report Command
 * Generate HTML report from existing lineage data
 */

const TestCoverageReporter = require('../../TestCoverageReporter');
const { loadLineageData, processLineageDataForMutation } = require('../utils/data-loader');
const { loadFullConfig } = require('../utils/config-loader');
const { spinner, success, error, info } = require('../utils/output-formatter');
const open = require('open');
const chalk = require('chalk');
const path = require('path');

async function reportCommand(options) {
  try {
    // Load configuration
    const config = loadFullConfig(options);

    // Load lineage data
    info(`Loading lineage data from: ${chalk.yellow(options.data)}`);
    const rawData = loadLineageData(options.data);

    const testCount = rawData.tests.length;
    info(`Loaded ${chalk.cyan(testCount)} tests`);

    // Process lineage data
    const lineageData = processLineageDataForMutation(rawData);

    // Load mutation results if available
    const fs = require('fs');
    const mutationResultsPath = path.join(process.cwd(), '.jest-lineage-mutation-results.json');
    let mutationResults = null;
    if (fs.existsSync(mutationResultsPath)) {
      try {
        mutationResults = JSON.parse(fs.readFileSync(mutationResultsPath, 'utf8'));
        info(`Loaded mutation results: ${chalk.cyan(mutationResults.totalMutations)} mutations tested`);
      } catch (e) {
        // Ignore errors loading mutation results
      }
    }

    // Create reporter instance with minimal config
    const reporter = new TestCoverageReporter(
      { rootDir: process.cwd() },
      { outputFile: options.output, ...config }
    );

    // Load data into reporter
    reporter.processLineageResults(lineageData, 'unknown');

    // Set mutation results if available
    if (mutationResults) {
      reporter.mutationResults = mutationResults;
    }

    // Generate HTML report
    const spin = spinner('Generating HTML report...');
    spin.start();

    await reporter.generateHtmlReport();

    spin.succeed('HTML report generated!');

    const reportPath = path.resolve(process.cwd(), options.output);
    success(`Report saved to: ${chalk.cyan(reportPath)}`);

    // Open in browser if requested
    if (options.open) {
      info('Opening report in browser...');
      await open(reportPath);
    }

    process.exit(0);
  } catch (err) {
    error(`Failed to generate report: ${err.message}`);
    if (process.env.JEST_LINEAGE_DEBUG === 'true') {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

module.exports = reportCommand;
