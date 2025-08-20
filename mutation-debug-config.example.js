/**
 * Example configuration for debugging mutation testing
 * Copy this to your jest.config.js or use as a separate config file
 */

module.exports = {
  // ... your existing Jest configuration ...
  
  // Jest Test Lineage Reporter configuration
  reporters: [
    'default',
    [
      './src/TestCoverageReporter.js',
      {
        // Enable mutation testing
        enableMutationTesting: true,
        
        // DEBUG MODE: Create mutation files for inspection instead of running tests
        debugMutations: true,
        debugMutationDir: './mutations-debug',
        
        // Other mutation testing options
        mutationTimeout: 10000,  // Longer timeout for debugging
        maxMutationsPerLine: 1,  // Limit mutations for easier debugging
        
        // Regular lineage tracking options
        enableLineageTracking: true,
        outputFile: 'test-lineage-report.html',
        includeSourceCode: true,
        trackTestDepth: true,
        
        // File filtering
        includePatterns: [
          '**/*.js',
          '**/*.ts'
        ],
        excludePatterns: [
          '**/node_modules/**',
          '**/dist/**',
          '**/*.test.js',
          '**/*.test.ts'
        ]
      }
    ]
  ]
};
