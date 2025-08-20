// Check if we're running during mutation testing to avoid infinite recursion
const isMutationTesting = process.env.JEST_LINEAGE_MUTATION_TESTING === 'false';

module.exports = {
  // Setup file to enable per-test tracking
  setupFilesAfterEnv: ['<rootDir>/src/testSetup.js'],

  // Set the reporter to our custom class
  reporters: [
    'default',
    [
      './src/TestCoverageReporter.js',
      {
        enableMutationTesting: !isMutationTesting, // Disable during mutation testing
        enableDebugLogging: true,
        debugMutations: false,                    // Enable debug mode
        debugMutationDir: './mutations-debug',  // Directory for debug files
        // ... other options
      }
    ]
  ],

  // Enable coverage to generate the data we need
  collectCoverage: true,

  // Specify where to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/TestCoverageReporter.ts',
    '!src/TestCoverageReporter.js',
    '!src/LineageTestEnvironment.js',
    '!src/testSetup.js',
    '!src/babel-plugin-lineage-tracker.js'
  ],

  // Use Babel for transformation (includes our instrumentation plugin)
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test environment
  testEnvironment: 'node',
};
