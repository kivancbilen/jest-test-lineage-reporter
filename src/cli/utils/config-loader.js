/**
 * Configuration Loader
 * Load and merge configuration from multiple sources
 * Priority: CLI args > env vars > config file > package.json > defaults
 */

const { loadConfig } = require('../../config');
const path = require('path');
const fs = require('fs');

/**
 * Load full configuration with proper priority
 * @param {object} cliOptions - Options from CLI arguments
 * @returns {object} Merged configuration
 */
function loadFullConfig(cliOptions = {}) {
  // Start with defaults from config.js (includes env var processing)
  let config = loadConfig();

  // Load from package.json if available
  const pkgConfig = loadPackageJsonConfig();
  if (pkgConfig) {
    config = { ...config, ...pkgConfig };
  }

  // Override with CLI options (highest priority)
  const cliConfig = mapCliOptionsToConfig(cliOptions);
  config = { ...config, ...cliConfig };

  return config;
}

/**
 * Map CLI options to config object
 * @param {object} cliOptions - CLI options
 * @returns {object} Config object
 */
function mapCliOptionsToConfig(cliOptions) {
  const config = {};

  // Feature toggles
  if (cliOptions.lineage === false) config.enableLineageTracking = false;
  if (cliOptions.performance === false) config.enablePerformanceTracking = false;
  if (cliOptions.quality === false) config.enableQualityAnalysis = false;

  // Mutation testing settings
  if (cliOptions.threshold !== undefined) {
    config.mutationThreshold = parseInt(cliOptions.threshold);
  }
  if (cliOptions.timeout !== undefined) {
    config.mutationTimeout = parseInt(cliOptions.timeout);
  }
  if (cliOptions.workers !== undefined) {
    config.workers = parseInt(cliOptions.workers);
  }

  // Docker settings
  if (cliOptions.docker === true) {
    config.enableDocker = true;
  }
  if (cliOptions.dockerWorkers !== undefined) {
    config.dockerWorkers = parseInt(cliOptions.dockerWorkers);
  }
  if (cliOptions.dockerImage !== undefined) {
    config.dockerImage = cliOptions.dockerImage;
  }
  if (cliOptions.dockerTag !== undefined) {
    config.dockerImageTag = cliOptions.dockerTag;
  }

  if (cliOptions.debug === true) {
    config.debugMutations = true;
  }
  if (cliOptions.debugDir !== undefined) {
    config.debugMutationDir = cliOptions.debugDir;
  }
  if (cliOptions.operators !== undefined) {
    // Parse comma-separated operators
    const operators = cliOptions.operators.split(',').map(o => o.trim());
    config.mutationOperators = {
      arithmetic: operators.includes('arithmetic'),
      comparison: operators.includes('comparison'),
      logical: operators.includes('logical'),
      conditional: operators.includes('conditional'),
      assignment: operators.includes('assignment'),
      literals: operators.includes('literals'),
      returns: operators.includes('returns'),
      increments: operators.includes('increments')
    };
  }

  // Output settings
  if (cliOptions.output !== undefined) {
    config.outputFile = cliOptions.output;
  }
  if (cliOptions.verbose === true) {
    config.enableDebugLogging = true;
  }
  if (cliOptions.quiet === true) {
    config.enableConsoleOutput = false;
  }

  // Skip options
  if (cliOptions.skipMutation === true) {
    config.enableMutationTesting = false;
  }

  return config;
}

/**
 * Load config from package.json "jest-lineage" field
 * @returns {object|null} Config from package.json or null
 */
function loadPackageJsonConfig() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg['jest-lineage'] || null;
    }
  } catch (error) {
    // Silently ignore errors
  }
  return null;
}

module.exports = {
  loadFullConfig,
  mapCliOptionsToConfig,
  loadPackageJsonConfig
};
