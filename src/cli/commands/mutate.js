/**
 * Mutate Command
 * Run mutation testing on existing lineage data
 */

const MutationTester = require('../../MutationTester');
const { loadLineageData, processLineageDataForMutation } = require('../utils/data-loader');
const { loadFullConfig } = require('../utils/config-loader');
const { spinner, printMutationSummary, error, success, info, printLineageDataSummary } = require('../utils/output-formatter');
const chalk = require('chalk');

async function mutateCommand(options) {
  let mutationTester = null;

  try {
    // Load configuration
    const config = loadFullConfig(options);

    // Load lineage data
    info(`Loading lineage data from: ${chalk.yellow(options.data)}`);
    const rawData = loadLineageData(options.data);

    if (!options.verbose) {
      printLineageDataSummary(rawData);
    }

    // Process data for mutation testing
    const lineageData = processLineageDataForMutation(rawData);
    const fileCount = Object.keys(lineageData).length;
    const lineCount = Object.values(lineageData).reduce(
      (sum, lines) => sum + Object.keys(lines).length,
      0
    );

    if (fileCount === 0 || lineCount === 0) {
      error('No coverage data found in lineage file. Run tests first.');
      process.exit(1);
    }

    info(`Processing ${chalk.cyan(fileCount)} files with ${chalk.cyan(lineCount)} covered lines\n`);

    // Create mutation tester
    mutationTester = new MutationTester(config);
    mutationTester.setLineageData(lineageData);

    // Run mutation testing
    const spin = spinner('Running mutation testing...');
    if (!options.verbose) {
      spin.start();
    }

    const results = await mutationTester.runMutationTesting();

    if (!options.verbose) {
      spin.succeed('Mutation testing completed!');
    }

    // Print results
    printMutationSummary(results);

    // Check threshold
    const threshold = parseInt(options.threshold) || 80;
    if (results.mutationScore < threshold) {
      console.log(chalk.yellow(`\n⚠️  Mutation score ${results.mutationScore.toFixed(1)}% is below threshold ${threshold}%`));
      process.exit(1);
    } else {
      success(`Mutation score meets threshold (${threshold}%)`);
      process.exit(0);
    }
  } catch (err) {
    error(`Mutation testing failed: ${err.message}`);
    if (options.verbose) {
      console.error(err.stack);
    }

    // Cleanup on error
    if (mutationTester) {
      try {
        await mutationTester.cleanup();
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
    }

    process.exit(1);
  }
}

module.exports = mutateCommand;
