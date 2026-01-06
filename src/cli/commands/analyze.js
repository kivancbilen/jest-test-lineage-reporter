/**
 * Analyze Command
 * Full workflow: test + mutation + report
 */

const testCommand = require('./test');
const mutateCommand = require('./mutate');
const reportCommand = require('./report');
const { lineageDataExists } = require('../utils/data-loader');
const { section, success, error, info } = require('../utils/output-formatter');
const chalk = require('chalk');

async function analyzeCommand(options) {
  try {
    section('🚀 Full Analysis Workflow');

    // Step 1: Run tests (unless skip-tests is specified)
    if (!options.skipTests) {
      info('Step 1: Running tests with lineage tracking...\n');

      try {
        await testCommand([], {
          lineage: options.lineage !== false,
          performance: options.performance !== false,
          quality: options.quality !== false,
          config: options.config,
          quiet: false
        });
      } catch (err) {
        // testCommand handles its own exit, this catch is for safety
        error('Tests failed. Analysis stopped.');
        process.exit(1);
      }
    } else {
      // Verify lineage data exists
      if (!lineageDataExists()) {
        error('Lineage data not found. Remove --skip-tests or run jest-lineage test first.');
        process.exit(1);
      }
      info('Step 1: Skipped (using existing lineage data)\n');
    }

    // Step 2: Run mutation testing (unless skip-mutation is specified)
    if (!options.skipMutation) {
      console.log(); // Add spacing
      info('Step 2: Running mutation testing...\n');

      try {
        await mutateCommand({
          data: '.jest-lineage-data.json',
          threshold: options.threshold,
          timeout: options.timeout || '5000',
          verbose: false
        });
      } catch (err) {
        // Don't fail the entire workflow if mutation testing fails
        error('Mutation testing failed, but continuing with report generation...');
      }
    } else {
      info('Step 2: Skipped mutation testing\n');
    }

    // Step 3: Generate report
    console.log(); // Add spacing
    info('Step 3: Generating HTML report...\n');

    await reportCommand({
      data: '.jest-lineage-data.json',
      output: options.output,
      open: options.open
    });

    // Success summary
    console.log();
    section('✨ Analysis Complete');
    success('Full analysis workflow completed successfully!');
    console.log(chalk.gray(`\nGenerated files:`));
    console.log(chalk.gray(`  • .jest-lineage-data.json (lineage data)`));
    console.log(chalk.gray(`  • ${options.output} (HTML report)`));

    process.exit(0);
  } catch (err) {
    error(`Analysis workflow failed: ${err.message}`);
    if (process.env.JEST_LINEAGE_DEBUG === 'true') {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

module.exports = analyzeCommand;
