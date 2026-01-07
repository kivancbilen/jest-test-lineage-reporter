/**
 * CLI Command Router
 * Main CLI logic with commander.js
 */

const { Command } = require('commander');
const initCommand = require('./commands/init');
const testCommand = require('./commands/test');
const mutateCommand = require('./commands/mutate');
const reportCommand = require('./commands/report');
const queryCommand = require('./commands/query');
const analyzeCommand = require('./commands/analyze');
const pkg = require('../../package.json');

async function run(argv) {
  const program = new Command();

  program
    .name('jest-lineage')
    .description('Comprehensive test analytics with lineage tracking and mutation testing')
    .version(pkg.version, '-v, --version', 'Display version number');

  // Init command - Initialize project configuration
  program
    .command('init')
    .description('Initialize jest-test-lineage-reporter configuration')
    .option('--force', 'Overwrite existing configuration files')
    .option('--typescript', 'Configure for TypeScript project')
    .option('--verbose', 'Show detailed error messages')
    .action(initCommand);

  // Test command - Run Jest with lineage tracking
  program
    .command('test [jest-args...]')
    .description('Run Jest tests with lineage tracking enabled')
    .option('--no-lineage', 'Disable lineage tracking')
    .option('--no-performance', 'Disable performance tracking')
    .option('--no-quality', 'Disable quality analysis')
    .option('--config <path>', 'Path to Jest config file')
    .option('--quiet, -q', 'Suppress console output')
    .action(testCommand);

  // Mutate command - Run mutation testing standalone
  program
    .command('mutate')
    .description('Run mutation testing on existing lineage data')
    .option('--data <path>', 'Path to lineage data file', '.jest-lineage-data.json')
    .option('--threshold <number>', 'Mutation score threshold (%)', '80')
    .option('--timeout <ms>', 'Timeout per mutation (ms)', '5000')
    .option('--workers <number>', 'Number of parallel workers (1=serial, 0=auto)', '1')
    .option('--docker', 'Use Docker containers for parallel execution (faster!)')
    .option('--docker-workers <number>', 'Number of Docker containers (default: CPU cores - 1)')
    .option('--docker-image <name>', 'Docker image name', 'jest-lineage-mutation-worker')
    .option('--docker-tag <tag>', 'Docker image tag', 'latest')
    .option('--debug', 'Create debug mutation files instead of running tests')
    .option('--debug-dir <path>', 'Directory for debug files', './mutations-debug')
    .option('--operators <list>', 'Comma-separated mutation operators to enable')
    .option('--verbose', 'Enable debug logging')
    .action(mutateCommand);

  // Report command - Generate HTML report
  program
    .command('report')
    .description('Generate HTML report from existing lineage data')
    .option('--data <path>', 'Path to lineage data file', '.jest-lineage-data.json')
    .option('--output <path>', 'Output HTML file path', 'test-lineage-report.html')
    .option('--open', 'Open report in browser after generation')
    .option('--format <type>', 'Report format (html, json)', 'html')
    .action(reportCommand);

  // Query command - Query test coverage
  program
    .command('query <file> [line]')
    .description('Query which tests cover specific files or lines')
    .option('--data <path>', 'Path to lineage data file', '.jest-lineage-data.json')
    .option('--json', 'Output as JSON')
    .option('--format <type>', 'Output format (table, list, json)', 'table')
    .action(queryCommand);

  // Analyze command - Full workflow
  program
    .command('analyze')
    .description('Full workflow: test + mutation + report')
    .option('--config <path>', 'Path to Jest config file')
    .option('--threshold <number>', 'Mutation score threshold (%)', '80')
    .option('--output <path>', 'Output HTML file path', 'test-lineage-report.html')
    .option('--open', 'Open report in browser')
    .option('--skip-tests', 'Skip running tests (use existing data)')
    .option('--skip-mutation', 'Skip mutation testing')
    .option('--no-lineage', 'Disable lineage tracking')
    .option('--no-performance', 'Disable performance tracking')
    .option('--no-quality', 'Disable quality analysis')
    .action(analyzeCommand);

  // Show help if no command provided
  if (argv.length <= 2) {
    program.help();
  }

  // Parse and execute
  await program.parseAsync(argv);
}

module.exports = { run };
