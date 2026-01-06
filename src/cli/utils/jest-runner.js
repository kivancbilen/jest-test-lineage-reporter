/**
 * Jest Runner
 * Orchestrate Jest execution with proper environment variables
 */

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');

/**
 * Run Jest with lineage tracking enabled
 * @param {object} options - Jest run options
 * @returns {Promise<object>} Result object with success status and exit code
 */
async function runJest(options = {}) {
  const {
    args = [],                     // Jest arguments
    config = null,                 // Path to Jest config
    enableLineage = true,          // Enable lineage tracking
    enablePerformance = true,      // Enable performance tracking
    enableQuality = true,          // Enable quality analysis
    enableMutation = false,        // Enable mutation mode
    cwd = process.cwd(),           // Working directory
    stdio = 'inherit',             // Stdio handling
    quiet = false                  // Suppress output
  } = options;

  // Build Jest command
  const jestPath = 'jest'; // Use npx/global jest
  const jestArgs = [...args];

  // Add config if specified
  if (config) {
    jestArgs.push('--config', config);
  }

  // Ensure coverage is collected (required for lineage tracking)
  if (!jestArgs.includes('--coverage') && !jestArgs.includes('--no-coverage')) {
    jestArgs.push('--coverage');
  }

  // Set environment variables for lineage tracking
  const env = {
    ...process.env,
    JEST_LINEAGE_ENABLED: enableLineage ? 'true' : 'false',
    JEST_LINEAGE_TRACKING: enableLineage ? 'true' : 'false',
    JEST_LINEAGE_PERFORMANCE: enablePerformance ? 'true' : 'false',
    JEST_LINEAGE_QUALITY: enableQuality ? 'true' : 'false',
    JEST_LINEAGE_MUTATION: enableMutation ? 'true' : 'false',
    JEST_LINEAGE_MUTATION_TESTING: 'false', // Not in mutation testing mode
  };

  if (!quiet) {
    console.log(chalk.cyan('\n🧪 Running Jest with lineage tracking...\n'));
    console.log(chalk.gray(`Command: ${jestPath} ${jestArgs.join(' ')}\n`));
  }

  return new Promise((resolve, reject) => {
    const jest = spawn(jestPath, jestArgs, {
      cwd,
      env,
      stdio,
      shell: true
    });

    jest.on('close', (code) => {
      if (code === 0) {
        if (!quiet) {
          console.log(chalk.green('\n✅ Tests completed successfully'));
        }
        resolve({ success: true, exitCode: code });
      } else {
        if (!quiet) {
          console.log(chalk.red(`\n❌ Tests failed with exit code ${code}`));
        }
        resolve({ success: false, exitCode: code });
      }
    });

    jest.on('error', (error) => {
      console.error(chalk.red('\n❌ Failed to run Jest:'), error.message);
      console.error(chalk.yellow('\nMake sure Jest is installed:'));
      console.error(chalk.gray('  npm install --save-dev jest\n'));
      reject(error);
    });
  });
}

/**
 * Validate that Jest is available
 * @returns {boolean} True if Jest is available
 */
function isJestAvailable() {
  try {
    require.resolve('jest');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  runJest,
  isJestAvailable
};
