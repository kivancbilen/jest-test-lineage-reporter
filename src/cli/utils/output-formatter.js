/**
 * Output Formatter
 * Format console output with colors and formatting
 */

const chalk = require('chalk');
const ora = require('ora');

/**
 * Print success message
 * @param {string} message - Success message
 */
function success(message) {
  console.log(chalk.green(`✅ ${message}`));
}

/**
 * Print error message
 * @param {string} message - Error message
 */
function error(message) {
  console.error(chalk.red(`❌ ${message}`));
}

/**
 * Print warning message
 * @param {string} message - Warning message
 */
function warning(message) {
  console.log(chalk.yellow(`⚠️  ${message}`));
}

/**
 * Print info message
 * @param {string} message - Info message
 */
function info(message) {
  console.log(chalk.cyan(`ℹ️  ${message}`));
}

/**
 * Print section header
 * @param {string} title - Section title
 */
function section(title) {
  console.log(chalk.bold.cyan(`\n${title}`));
  console.log(chalk.gray('═'.repeat(title.length + 2)));
}

/**
 * Create a spinner for long operations
 * @param {string} text - Spinner text
 * @returns {object} Ora spinner instance
 */
function spinner(text) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots'
  });
}

/**
 * Print mutation results summary
 * @param {object} results - Mutation test results
 */
function printMutationSummary(results) {
  section('🧬 Mutation Testing Results');

  console.log(`📊 ${chalk.bold('Total Mutations:')} ${results.totalMutations}`);
  console.log(`${chalk.green('✅ Killed:')} ${results.killedMutations}`);
  console.log(`${chalk.red('🔴 Survived:')} ${results.survivedMutations}`);
  console.log(`${chalk.yellow('⏰ Timeout:')} ${results.timeoutMutations || 0}`);
  console.log(`${chalk.gray('❌ Error:')} ${results.errorMutations || 0}`);
  console.log(`${chalk.bold.cyan('🎯 Mutation Score:')} ${chalk.bold(results.mutationScore.toFixed(1))}%`);

  if (results.mutationScore >= 80) {
    console.log(chalk.green('\n✅ Excellent mutation score!'));
  } else if (results.mutationScore >= 60) {
    console.log(chalk.yellow('\n⚠️  Good mutation score, but room for improvement'));
  } else {
    console.log(chalk.red('\n❌ Low mutation score - consider improving test quality'));
  }
}

/**
 * Print lineage data summary
 * @param {object} data - Lineage data
 */
function printLineageDataSummary(data) {
  const testCount = data.tests.length;
  const failedTests = data.tests.filter(t => t.failed).length;
  const passedTests = testCount - failedTests;

  console.log(chalk.cyan(`\n📊 Lineage data loaded:`));
  console.log(`  ${chalk.green('✓')} ${passedTests} tests passed`);
  if (failedTests > 0) {
    console.log(`  ${chalk.red('✗')} ${failedTests} tests failed`);
  }
  console.log(`  ${chalk.gray('📅')} Generated: ${new Date(data.timestamp).toLocaleString()}`);
}

/**
 * Format file path for display
 * @param {string} filePath - File path
 * @returns {string} Formatted path
 */
function formatPath(filePath) {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    return chalk.gray(filePath.replace(cwd, '.'));
  }
  return chalk.gray(filePath);
}

module.exports = {
  success,
  error,
  warning,
  info,
  section,
  spinner,
  printMutationSummary,
  printLineageDataSummary,
  formatPath
};
