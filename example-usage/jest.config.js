// Example Jest configuration for using jest-test-lineage-reporter
module.exports = {
  // Standard Jest configuration
  testEnvironment: 'node',
  
  // Add the lineage reporter alongside default reporter
  reporters: [
    'default',                           // Keep standard Jest output
    'jest-test-lineage-reporter'         // Add our custom reporter
  ],
  
  // Enable coverage collection (required for the reporter to work)
  collectCoverage: true,
  
  // Specify which files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',         // Include all source files
    '!src/**/*.d.ts',                   // Exclude TypeScript declaration files
    '!src/**/*.test.{js,ts}',           // Exclude test files
    '!src/**/*.spec.{js,ts}',           // Exclude spec files
    '!src/index.js',                    // Exclude entry point (optional)
  ],
  
  // Coverage output directory (optional)
  coverageDirectory: 'coverage',
  
  // Coverage reporters (optional - for additional coverage formats)
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test file patterns (optional)
  testMatch: [
    '**/__tests__/**/*.(js|ts)',
    '**/*.(test|spec).(js|ts)'
  ],
  
  // For TypeScript projects, add:
  // preset: 'ts-jest',
  
  // For React projects, add:
  // testEnvironment: 'jsdom',
  // setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
};
