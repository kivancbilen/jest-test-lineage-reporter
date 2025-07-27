/**
 * Configuration for Jest Test Lineage Reporter
 */

const DEFAULT_CONFIG = {
  // Feature toggles
  enabled: true, // Master switch to enable/disable entire system
  enableLineageTracking: true, // Enable detailed line-by-line tracking
  enablePerformanceTracking: true, // Enable CPU/memory monitoring
  enableQualityAnalysis: true, // Enable test quality scoring

  // Output settings
  outputFile: 'test-lineage-report.html',
  enableConsoleOutput: true,
  enableDebugLogging: false,
  
  // Performance thresholds
  memoryLeakThreshold: 50 * 1024, // 50KB - allocations above this trigger memory leak alerts
  gcPressureThreshold: 5, // Number of small allocations that trigger GC pressure alerts
  slowExecutionThreshold: 2.0, // Multiplier for average execution time to trigger slow alerts
  
  // Quality thresholds
  qualityThreshold: 60, // Minimum quality score (0-100)
  reliabilityThreshold: 60, // Minimum reliability score (0-100)
  maintainabilityThreshold: 60, // Minimum maintainability score (0-100)
  maxTestSmells: 2, // Maximum number of test smells before flagging
  
  // Test quality scoring weights
  qualityWeights: {
    assertions: 5, // Points per assertion (up to 30 points)
    errorHandling: 10, // Points per error handling pattern (up to 20 points)
    edgeCases: 3, // Points per edge case test (up to 15 points)
    testSmellPenalty: 5, // Points deducted per test smell
    complexityPenalty: 2, // Points deducted per complexity point
    lengthPenalty: 0.5 // Points deducted per line over 50
  },
  
  // Performance tracking
  enableCpuCycleTracking: true,
  enableMemoryTracking: true,
  enableCallDepthTracking: true,
  maxCallDepthTracking: 10, // Maximum call depth to track
  
  // HTML report settings
  enableInteractiveFeatures: true,
  enablePerformanceDashboard: true,
  enableQualityDashboard: true,
  maxLinesInReport: 10000, // Maximum number of lines to include in HTML report
  
  // File filtering
  includePatterns: [
    '**/*.js',
    '**/*.ts',
    '**/*.jsx',
    '**/*.tsx'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ]
};

/**
 * Validates and merges user configuration with defaults
 * @param {Object} userConfig - User provided configuration
 * @returns {Object} Merged and validated configuration
 */
function validateAndMergeConfig(userConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
  // Validate numeric thresholds
  if (typeof config.memoryLeakThreshold !== 'number' || config.memoryLeakThreshold < 0) {
    console.warn('Invalid memoryLeakThreshold, using default:', DEFAULT_CONFIG.memoryLeakThreshold);
    config.memoryLeakThreshold = DEFAULT_CONFIG.memoryLeakThreshold;
  }
  
  if (typeof config.gcPressureThreshold !== 'number' || config.gcPressureThreshold < 1) {
    console.warn('Invalid gcPressureThreshold, using default:', DEFAULT_CONFIG.gcPressureThreshold);
    config.gcPressureThreshold = DEFAULT_CONFIG.gcPressureThreshold;
  }
  
  if (typeof config.qualityThreshold !== 'number' || config.qualityThreshold < 0 || config.qualityThreshold > 100) {
    console.warn('Invalid qualityThreshold, using default:', DEFAULT_CONFIG.qualityThreshold);
    config.qualityThreshold = DEFAULT_CONFIG.qualityThreshold;
  }
  
  // Validate file patterns
  if (!Array.isArray(config.includePatterns)) {
    console.warn('Invalid includePatterns, using default');
    config.includePatterns = DEFAULT_CONFIG.includePatterns;
  }
  
  if (!Array.isArray(config.excludePatterns)) {
    console.warn('Invalid excludePatterns, using default');
    config.excludePatterns = DEFAULT_CONFIG.excludePatterns;
  }
  
  // Validate quality weights
  if (typeof config.qualityWeights !== 'object') {
    console.warn('Invalid qualityWeights, using default');
    config.qualityWeights = DEFAULT_CONFIG.qualityWeights;
  }
  
  return config;
}

/**
 * Gets configuration from environment variables
 * @returns {Object} Configuration from environment
 */
function getConfigFromEnv() {
  return {
    // Feature toggles
    enabled: process.env.JEST_LINEAGE_ENABLED !== 'false', // Default enabled, set to 'false' to disable
    enableLineageTracking: process.env.JEST_LINEAGE_TRACKING !== 'false',
    enablePerformanceTracking: process.env.JEST_LINEAGE_PERFORMANCE !== 'false',
    enableQualityAnalysis: process.env.JEST_LINEAGE_QUALITY !== 'false',

    // Output settings
    outputFile: process.env.JEST_LINEAGE_OUTPUT_FILE,
    enableDebugLogging: process.env.JEST_LINEAGE_DEBUG === 'true',

    // Thresholds
    memoryLeakThreshold: process.env.JEST_LINEAGE_MEMORY_THRESHOLD ?
      parseInt(process.env.JEST_LINEAGE_MEMORY_THRESHOLD) : undefined,
    gcPressureThreshold: process.env.JEST_LINEAGE_GC_THRESHOLD ?
      parseInt(process.env.JEST_LINEAGE_GC_THRESHOLD) : undefined,
    qualityThreshold: process.env.JEST_LINEAGE_QUALITY_THRESHOLD ?
      parseInt(process.env.JEST_LINEAGE_QUALITY_THRESHOLD) : undefined
  };
}

/**
 * Loads configuration from file, environment, and defaults
 * @param {Object} userConfig - User provided configuration
 * @returns {Object} Final configuration
 */
function loadConfig(userConfig = {}) {
  const envConfig = getConfigFromEnv();
  const mergedConfig = { ...userConfig, ...envConfig };
  return validateAndMergeConfig(mergedConfig);
}

module.exports = {
  DEFAULT_CONFIG,
  validateAndMergeConfig,
  getConfigFromEnv,
  loadConfig
};
