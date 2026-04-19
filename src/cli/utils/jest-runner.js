/**
 * Jest Runner
 * Orchestrate Jest execution with proper environment variables
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const logger = require("../../logger");

/**
 * Run Jest with lineage tracking enabled
 * @param {object} options - Jest run options
 * @returns {Promise<object>} Result object with success status and exit code
 */
async function runJest(options = {}) {
  const {
    args = [], // Jest arguments
    config = null, // Path to Jest config
    enableLineage = true, // Enable lineage tracking
    enablePerformance = true, // Enable performance tracking
    enableQuality = true, // Enable quality analysis
    enableMutation = false, // Enable mutation mode
    cwd = process.cwd(), // Working directory
    stdio = "inherit", // Stdio handling
    quiet = false, // Suppress output
  } = options;

  // Build Jest command
  const jestPath = "jest"; // Use npx/global jest
  const jestArgs = [...args];

  // Add config if specified
  if (config) {
    jestArgs.push("--config", config);
  }

  // Ensure coverage is collected (required for lineage tracking)
  if (!jestArgs.includes("--coverage") && !jestArgs.includes("--no-coverage")) {
    jestArgs.push("--coverage");
  }

  // Run tests serially when lineage tracking is enabled to avoid race conditions
  // with file writes from parallel workers
  if (
    enableLineage &&
    !jestArgs.includes("--runInBand") &&
    !jestArgs.includes("--maxWorkers")
  ) {
    jestArgs.push("--runInBand");
  }

  // Set environment variables for lineage tracking
  const env = {
    ...process.env,
    JEST_LINEAGE_ENABLED: enableLineage ? "true" : "false",
    JEST_LINEAGE_TRACKING: enableLineage ? "true" : "false",
    JEST_LINEAGE_PERFORMANCE: enablePerformance ? "true" : "false",
    JEST_LINEAGE_QUALITY: enableQuality ? "true" : "false",
    JEST_LINEAGE_MUTATION: enableMutation ? "true" : "false",
    JEST_LINEAGE_MUTATION_TESTING: "false", // Not in mutation testing mode
  };

  if (!quiet) {
    logger.info(chalk.cyan("\n🧪 Running Jest with lineage tracking...\n"));
    logger.debug(chalk.gray(`Command: ${jestPath} ${jestArgs.join(" ")}\n`));
  }

  // Resolve jest binary from node_modules to avoid shell: true
  const jestBin = path.resolve(cwd, "node_modules", ".bin", "jest");
  const resolvedPath = fs.existsSync(jestBin) ? jestBin : jestPath;

  return new Promise((resolve, reject) => {
    const jest = spawn(resolvedPath, jestArgs, {
      cwd,
      env,
      stdio,
    });

    jest.on("close", (code) => {
      if (code === 0) {
        if (!quiet) {
          logger.info(chalk.green("\n✅ Tests completed successfully"));
        }
        resolve({ success: true, exitCode: code });
      } else {
        if (!quiet) {
          logger.info(chalk.red(`\n❌ Tests failed with exit code ${code}`));
        }
        resolve({ success: false, exitCode: code });
      }
    });

    jest.on("error", (error) => {
      logger.error(chalk.red("\n❌ Failed to run Jest:"), error.message);
      logger.error(chalk.yellow("\nMake sure Jest is installed:"));
      logger.error(chalk.gray("  npm install --save-dev jest\n"));
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
    require.resolve("jest");
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  runJest,
  isJestAvailable,
};
