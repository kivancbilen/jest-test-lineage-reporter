/**
 * Jest setup file to enable precise per-test tracking
 */

// Test Quality Analysis Functions
function analyzeTestQuality(testFunction, testName) {
  const functionString = testFunction.toString();
  const qualityMetrics = {
    assertions: 0,
    asyncOperations: 0,
    mockUsage: 0,
    errorHandling: 0,
    edgeCases: 0,
    complexity: 0,
    maintainability: 0,
    reliability: 0,
    testSmells: [],
    codePatterns: [],
    dependencies: new Set(),
    isolationScore: 0,
    testLength: functionString.split('\n').length,
    setupTeardown: 0
  };

  // Count assertions - more comprehensive patterns
  const assertionPatterns = [
    /expect\(/g,                    // expect(value)
    /\.toBe\(/g,                   // .toBe(value)
    /\.toEqual\(/g,                // .toEqual(value)
    /\.toMatch\(/g,                // .toMatch(pattern)
    /\.toContain\(/g,              // .toContain(item)
    /\.toThrow\(/g,                // .toThrow()
    /\.toHaveLength\(/g,           // .toHaveLength(number)
    /\.toBeGreaterThan\(/g,        // .toBeGreaterThan(number)
    /\.toBeGreaterThanOrEqual\(/g, // .toBeGreaterThanOrEqual(number)
    /\.toBeLessThan\(/g,           // .toBeLessThan(number)
    /\.toBeLessThanOrEqual\(/g,    // .toBeLessThanOrEqual(number)
    /\.toBeCloseTo\(/g,            // .toBeCloseTo(number)
    /\.toHaveProperty\(/g,         // .toHaveProperty(key)
    /\.toBeNull\(/g,               // .toBeNull()
    /\.toBeUndefined\(/g,          // .toBeUndefined()
    /\.toBeDefined\(/g,            // .toBeDefined()
    /\.toBeTruthy\(/g,             // .toBeTruthy()
    /\.toBeFalsy\(/g,              // .toBeFalsy()
    /\.not\.toThrow\(/g,           // .not.toThrow()
    /\.not\.toBe\(/g,              // .not.toBe()
    /assert\(/g,                   // assert(condition)
    /should\./g,                   // should.be.true
    /\.to\./g,                     // chai assertions
    /\.be\./g                      // chai assertions
  ];

  let totalAssertions = 0;
  assertionPatterns.forEach(pattern => {
    const matches = functionString.match(pattern);
    if (matches) {
      totalAssertions += matches.length;
    }
  });
  qualityMetrics.assertions = totalAssertions;

  // Count async operations
  const asyncPatterns = [
    /await\s+/g, /\.then\(/g, /\.catch\(/g, /Promise\./g, /async\s+/g,
    /setTimeout\(/g, /setInterval\(/g, /requestAnimationFrame\(/g
  ];
  asyncPatterns.forEach(pattern => {
    const matches = functionString.match(pattern);
    if (matches) qualityMetrics.asyncOperations += matches.length;
  });

  // Count mock usage
  const mockPatterns = [
    /jest\.mock\(/g, /jest\.spyOn\(/g, /\.mockImplementation\(/g, /\.mockReturnValue\(/g,
    /\.mockResolvedValue\(/g, /\.mockRejectedValue\(/g, /sinon\./g, /stub\(/g, /spy\(/g
  ];
  mockPatterns.forEach(pattern => {
    const matches = functionString.match(pattern);
    if (matches) qualityMetrics.mockUsage += matches.length;
  });

  // Count error handling
  const errorPatterns = [
    /try\s*\{/g, /catch\s*\(/g, /throw\s+/g, /toThrow\(/g, /toThrowError\(/g,
    /\.rejects\./g, /\.resolves\./g
  ];
  errorPatterns.forEach(pattern => {
    const matches = functionString.match(pattern);
    if (matches) qualityMetrics.errorHandling += matches.length;
  });

  // Detect edge cases
  const edgeCasePatterns = [
    /null/g, /undefined/g, /empty/g, /zero/g, /negative/g, /boundary/g,
    /edge/g, /limit/g, /max/g, /min/g, /invalid/g, /error/g
  ];
  edgeCasePatterns.forEach(pattern => {
    const matches = functionString.match(pattern);
    if (matches) qualityMetrics.edgeCases += matches.length;
  });

  // Calculate complexity (cyclomatic complexity approximation)
  const complexityPatterns = [
    /if\s*\(/g, /else/g, /for\s*\(/g, /while\s*\(/g, /switch\s*\(/g,
    /case\s+/g, /catch\s*\(/g, /&&/g, /\|\|/g, /\?/g
  ];
  complexityPatterns.forEach(pattern => {
    const matches = functionString.match(pattern);
    if (matches) qualityMetrics.complexity += matches.length;
  });

  // Detect test smells
  if (qualityMetrics.testLength > 50) {
    qualityMetrics.testSmells.push('Long Test');
  }
  if (qualityMetrics.assertions === 0) {
    qualityMetrics.testSmells.push('No Assertions');
  }
  if (qualityMetrics.assertions > 10) {
    qualityMetrics.testSmells.push('Too Many Assertions');
  }
  if (functionString.includes('sleep') || functionString.includes('wait')) {
    qualityMetrics.testSmells.push('Sleep/Wait Usage');
  }
  if (qualityMetrics.mockUsage > 5) {
    qualityMetrics.testSmells.push('Excessive Mocking');
  }

  // Calculate maintainability score (0-100)
  let maintainabilityScore = 100;
  maintainabilityScore -= Math.min(qualityMetrics.testLength * 0.5, 25);
  maintainabilityScore -= Math.min(qualityMetrics.complexity * 2, 20);
  maintainabilityScore -= qualityMetrics.testSmells.length * 10;
  maintainabilityScore += Math.min(qualityMetrics.assertions * 2, 20);
  qualityMetrics.maintainability = Math.max(0, maintainabilityScore);

  // Calculate reliability score (0-100)
  let reliabilityScore = 50;
  reliabilityScore += Math.min(qualityMetrics.assertions * 5, 30);
  reliabilityScore += Math.min(qualityMetrics.errorHandling * 10, 20);
  reliabilityScore += Math.min(qualityMetrics.edgeCases * 3, 15);
  reliabilityScore -= qualityMetrics.testSmells.length * 5;
  qualityMetrics.reliability = Math.max(0, Math.min(100, reliabilityScore));

  // Calculate isolation score (0-100)
  let isolationScore = 100;
  isolationScore -= Math.min(qualityMetrics.mockUsage * 5, 30);
  isolationScore -= qualityMetrics.dependencies.size * 10;
  qualityMetrics.isolationScore = Math.max(0, isolationScore);

  return qualityMetrics;
}

// Global tracker for test coverage
global.__TEST_LINEAGE_TRACKER__ = {
  currentTest: null,
  testCoverage: new Map(),
  isTracking: false
};

// Store original test functions
const originalIt = global.it;
const originalTest = global.test;

// Enhanced test wrapper that tracks coverage per individual test
function createTestWrapper(originalFn, testType) {
  return function wrappedTest(testName, testFn, timeout) {
    // If no test function provided, it's a pending test
    if (!testFn) {
      return originalFn(testName, testFn, timeout);
    }

    // Wrap the test function with tracking
    const wrappedTestFn = async function(...args) {
      // Start tracking for this specific test
      global.__TEST_LINEAGE_TRACKER__.currentTest = {
        name: testName,
        type: testType,
        startTime: Date.now(),
        coverage: new Map(),
        qualityMetrics: {
          assertions: 0,
          asyncOperations: 0,
          mockUsage: 0,
          errorHandling: 0,
          edgeCases: 0,
          complexity: 0,
          maintainability: 0,
          reliability: 0,
          testSmells: [],
          codePatterns: [],
          dependencies: new Set(),
          isolationScore: 0,
          testLength: 0,
          setupTeardown: 0
        },
        startMetrics: capturePerformanceMetrics()
      };
      global.__TEST_LINEAGE_TRACKER__.isTracking = true;

      // Analyze test quality
      if (typeof testFn === 'function') {
        global.__TEST_LINEAGE_TRACKER__.currentTest.qualityMetrics = analyzeTestQuality(testFn, testName);
      }

      try {
        // Execute the actual test
        const result = await testFn.apply(this, args);
        
        // Store the coverage data for this test
        const testId = `${testName}::${Date.now()}`;
        const testData = {
          name: testName,
          type: testType,
          duration: Date.now() - global.__TEST_LINEAGE_TRACKER__.currentTest.startTime,
          coverage: new Map(global.__TEST_LINEAGE_TRACKER__.currentTest.coverage)
        };

        global.__TEST_LINEAGE_TRACKER__.testCoverage.set(testId, testData);

        // Also store in a more persistent way for the reporter
        if (!global.__LINEAGE_PERSISTENT_DATA__) {
          global.__LINEAGE_PERSISTENT_DATA__ = [];
        }
        global.__LINEAGE_PERSISTENT_DATA__.push(testData);

        // Write to file for reporter to read
        writeTrackingDataToFile();

        return result;
      } catch (error) {
        // Still store coverage data even if test fails
        const testId = `${testName}::${Date.now()}::FAILED`;
        global.__TEST_LINEAGE_TRACKER__.testCoverage.set(testId, {
          name: testName,
          type: testType,
          duration: Date.now() - global.__TEST_LINEAGE_TRACKER__.currentTest.startTime,
          coverage: new Map(global.__TEST_LINEAGE_TRACKER__.currentTest.coverage),
          failed: true
        });
        throw error;
      } finally {
        // Clean up tracking state
        global.__TEST_LINEAGE_TRACKER__.currentTest = null;
        global.__TEST_LINEAGE_TRACKER__.isTracking = false;
      }
    };

    // Call original function with wrapped test
    return originalFn(testName, wrappedTestFn, timeout);
  };
}

// Cache for discovered source directories to avoid repeated filesystem operations
const sourceDirectoryCache = new Map();

// Find the project root by looking for package.json
function findProjectRoot(startPath) {
  const path = require('path');
  const fs = require('fs');

  let currentDir = startPath;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback to current working directory if no package.json found
  return process.cwd();
}

// Smart auto-detection of source file paths using package.json as root
function resolveSourceFilePath(relativeFilePath) {
  const path = require('path');
  const fs = require('fs');

  // Check cache first
  const cacheKey = relativeFilePath;
  if (sourceDirectoryCache.has(cacheKey)) {
    return sourceDirectoryCache.get(cacheKey);
  }

  // Find project root using package.json
  const projectRoot = findProjectRoot(process.cwd());

  // Strategy 1: Try relative to project root (most reliable)
  const projectRelativePath = path.resolve(projectRoot, relativeFilePath);
  if (fs.existsSync(projectRelativePath)) {
    sourceDirectoryCache.set(cacheKey, projectRelativePath);
    return projectRelativePath;
  }

  // Strategy 2: Try relative to current working directory
  const cwdRelativePath = path.resolve(process.cwd(), relativeFilePath);
  if (fs.existsSync(cwdRelativePath)) {
    sourceDirectoryCache.set(cacheKey, cwdRelativePath);
    return cwdRelativePath;
  }

  // Strategy 3: Auto-discover by scanning from project root
  const filename = path.basename(relativeFilePath);
  const discoveredPaths = discoverSourceDirectories(projectRoot, filename);

  for (const discoveredPath of discoveredPaths) {
    if (fs.existsSync(discoveredPath)) {
      sourceDirectoryCache.set(cacheKey, discoveredPath);
      return discoveredPath;
    }
  }

  // Strategy 4: Fallback to common patterns from project root
  const commonPatterns = [
    path.resolve(projectRoot, 'src', filename),
    path.resolve(projectRoot, 'lib', filename),
    path.resolve(projectRoot, 'source', filename),
  ];

  for (const fallbackPath of commonPatterns) {
    if (fs.existsSync(fallbackPath)) {
      sourceDirectoryCache.set(cacheKey, fallbackPath);
      return fallbackPath;
    }
  }

  // If still not found, return the project relative path for error reporting
  sourceDirectoryCache.set(cacheKey, projectRelativePath);
  return projectRelativePath;
}

// Auto-discover source directories by scanning the project structure
function discoverSourceDirectories(projectRoot, targetFilename) {
  const path = require('path');
  const fs = require('fs');

  const discoveredPaths = [];
  const maxDepth = 3; // Limit search depth for performance

  function scanDirectory(dir, depth = 0) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;

          // Skip common non-source directories
          if (shouldSkipDirectory(dirName)) continue;

          const fullDirPath = path.join(dir, dirName);

          // Check if target file exists in this directory
          const potentialFilePath = path.join(fullDirPath, targetFilename);
          if (fs.existsSync(potentialFilePath)) {
            discoveredPaths.push(potentialFilePath);
          }

          // Recursively scan subdirectories
          scanDirectory(fullDirPath, depth + 1);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  scanDirectory(projectRoot);

  // Sort by preference (shorter paths first, then by common source directory names)
  return discoveredPaths.sort((a, b) => {
    const aDepth = a.split(path.sep).length;
    const bDepth = b.split(path.sep).length;

    if (aDepth !== bDepth) {
      return aDepth - bDepth; // Prefer shorter paths
    }

    // Prefer common source directory names
    const sourcePreference = ['src', 'lib', 'source', 'app'];
    const aScore = getSourceDirectoryScore(a, sourcePreference);
    const bScore = getSourceDirectoryScore(b, sourcePreference);

    return bScore - aScore; // Higher score first
  });
}

// Check if a directory should be skipped during auto-discovery
function shouldSkipDirectory(dirName) {
  const skipPatterns = [
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    'dist',
    'build',
    'coverage',
    '.nyc_output',
    'tmp',
    'temp',
    '.cache',
    '.vscode',
    '.idea',
    '__pycache__',
    '.pytest_cache',
    'vendor',
    'target',
    'bin',
    'obj'
  ];

  return skipPatterns.includes(dirName) || dirName.startsWith('.');
}

// Score source directories by preference
function getSourceDirectoryScore(filePath, sourcePreference) {
  const pathParts = filePath.split(path.sep);
  let score = 0;

  for (const part of pathParts) {
    const index = sourcePreference.indexOf(part);
    if (index !== -1) {
      score += sourcePreference.length - index; // Higher score for preferred names
    }
  }

  return score;
}

// High-resolution performance measurement
function capturePerformanceMetrics() {
  const hrTime = process.hrtime.bigint();
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage();

  return {
    wallTime: Number(hrTime) / 1000000, // Convert to microseconds
    cpuTime: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to microseconds
    memoryUsage: memUsage.heapUsed,
    timestamp: Date.now()
  };
}

// Estimate CPU cycles based on timing and system characteristics
function estimateCpuCycles(cpuTimeMicros, wallTimeMicros) {
  // Get CPU frequency estimate (this is approximate)
  const estimatedCpuFrequencyGHz = getCpuFrequencyEstimate();

  // Calculate cycles: CPU time (seconds) * frequency (cycles/second)
  const cpuTimeSeconds = cpuTimeMicros / 1000000;
  const estimatedCycles = Math.round(cpuTimeSeconds * estimatedCpuFrequencyGHz * 1000000000);

  return estimatedCycles;
}

// Estimate CPU frequency (this is a rough approximation)
function getCpuFrequencyEstimate() {
  // Try to get CPU info from Node.js (if available)
  try {
    const os = require('os');
    const cpus = os.cpus();
    if (cpus && cpus.length > 0 && cpus[0].speed) {
      return cpus[0].speed / 1000; // Convert MHz to GHz
    }
  } catch (error) {
    // Fallback if CPU info not available
  }

  // Fallback to common CPU frequency estimate (2.5 GHz)
  return 2.5;
}

// Advanced performance profiling for hotspot detection
function profileLineExecution(filePath, lineNumber, executionCallback) {
  const startMetrics = capturePerformanceMetrics();

  try {
    const result = executionCallback();

    const endMetrics = capturePerformanceMetrics();
    const performanceProfile = {
      wallTime: endMetrics.wallTime - startMetrics.wallTime,
      cpuTime: endMetrics.cpuTime - startMetrics.cpuTime,
      memoryDelta: endMetrics.memoryUsage - startMetrics.memoryUsage,
      cpuCycles: estimateCpuCycles(
        endMetrics.cpuTime - startMetrics.cpuTime,
        endMetrics.wallTime - startMetrics.wallTime
      )
    };

    return { result, performanceProfile };
  } catch (error) {
    const endMetrics = capturePerformanceMetrics();
    const performanceProfile = {
      wallTime: endMetrics.wallTime - startMetrics.wallTime,
      cpuTime: endMetrics.cpuTime - startMetrics.cpuTime,
      memoryDelta: endMetrics.memoryUsage - startMetrics.memoryUsage,
      cpuCycles: estimateCpuCycles(
        endMetrics.cpuTime - startMetrics.cpuTime,
        endMetrics.wallTime - startMetrics.wallTime
      ),
      error: error.message
    };

    throw { originalError: error, performanceProfile };
  }
}

// Calculate call depth by analyzing the JavaScript call stack
function calculateCallDepth() {
  try {
    // Create a stack trace
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = originalPrepareStackTrace;

    if (!Array.isArray(stack)) {
      return 1; // Fallback if stack trace is not available
    }

    // Filter out internal tracking functions and Jest infrastructure
    const relevantFrames = stack.filter(frame => {
      const fileName = frame.getFileName();
      const functionName = frame.getFunctionName() || '';

      // Skip internal tracking functions
      if (functionName.includes('__TRACK_LINE_EXECUTION__') ||
          functionName.includes('calculateCallDepth') ||
          functionName.includes('resolveSourceFilePath')) {
        return false;
      }

      // Skip Jest internal functions
      if (fileName && (
          fileName.includes('jest-runner') ||
          fileName.includes('jest-runtime') ||
          fileName.includes('jest-environment') ||
          fileName.includes('testSetup.js') ||
          fileName.includes('node_modules/jest') ||
          fileName.includes('babel-plugin-lineage-tracker')
      )) {
        return false;
      }

      // Skip Node.js internal functions
      if (!fileName || fileName.startsWith('node:') || fileName.includes('internal/')) {
        return false;
      }

      return true;
    });

    // Calculate depth based on relevant frames
    // Depth 1 = called directly from test
    // Depth 2 = called from a function that was called from test
    // etc.
    const depth = Math.max(1, relevantFrames.length - 1);

    // Cap the depth at a reasonable maximum
    return Math.min(depth, 10);

  } catch (error) {
    // Fallback to depth 1 if stack trace analysis fails
    return 1;
  }
}

// Method to write tracking data to file
function writeTrackingDataToFile() {
  const fs = require('fs');
  const path = require('path');

  try {
    const filePath = path.join(process.cwd(), '.jest-lineage-data.json');

    // Read existing data if file exists
    let existingData = { timestamp: Date.now(), tests: [] };
    if (fs.existsSync(filePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        // If file is corrupted, start fresh
        existingData = { timestamp: Date.now(), tests: [] };
      }
    }

    const tests = global.__LINEAGE_PERSISTENT_DATA__ || [];

    // Convert Map objects to plain objects for JSON serialization
    const serializedTests = tests.map(testData => ({
      name: testData.name,
      type: testData.type,
      duration: testData.duration,
      coverage: Object.fromEntries(testData.coverage) // Convert Map to Object (includes depth data)
    }));

    // Merge with existing data (avoid duplicates by test name)
    const existingTestNames = new Set(existingData.tests.map(t => t.name));
    const newTests = serializedTests.filter(t => !existingTestNames.has(t.name));

    const dataToWrite = {
      timestamp: Date.now(),
      tests: [...existingData.tests, ...newTests]
    };

    fs.writeFileSync(filePath, JSON.stringify(dataToWrite, null, 2));

    // console.log(`📝 Wrote tracking data: ${dataToWrite.tests.length} total tests to ${filePath}`);
  } catch (error) {
    console.warn('Warning: Could not write tracking data to file:', error.message);
  }
}

// Replace global test functions with our wrapped versions
global.it = createTestWrapper(originalIt, 'it');
global.test = createTestWrapper(originalTest, 'test');

// Copy over any additional properties from original functions
if (originalIt) {
  Object.keys(originalIt).forEach(key => {
    if (typeof originalIt[key] === 'function') {
      global.it[key] = originalIt[key];
    }
  });
}

if (originalTest) {
  Object.keys(originalTest).forEach(key => {
    if (typeof originalTest[key] === 'function') {
      global.test[key] = originalTest[key];
    }
  });
}

// Function for line execution tracking with call depth and performance analysis
global.__TRACK_LINE_EXECUTION__ = function(filePath, lineNumber, nodeType) {
  if (global.__TEST_LINEAGE_TRACKER__.isTracking &&
      global.__TEST_LINEAGE_TRACKER__.currentTest) {

    // High-resolution performance measurement
    const performanceStart = capturePerformanceMetrics();

    // Convert relative path to full path using dynamic resolution
    const fullPath = resolveSourceFilePath(filePath);
    const key = `${fullPath}:${lineNumber}`;

    // Calculate call depth by analyzing the call stack
    const callDepth = calculateCallDepth();

    // Store execution with depth information
    const currentCount = global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.get(key) || 0;
    global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.set(key, currentCount + 1);

    // Store depth information for this execution
    const depthKey = `${key}:depth`;
    const depthData = global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.get(depthKey) || {};
    depthData[callDepth] = (depthData[callDepth] || 0) + 1;
    global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.set(depthKey, depthData);

    // Store performance metrics for this execution
    const performanceEnd = capturePerformanceMetrics();
    const performanceKey = `${key}:performance`;
    const performanceData = global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.get(performanceKey) || {
      totalExecutions: 0,
      totalCpuTime: 0,
      totalWallTime: 0,
      totalMemoryDelta: 0,
      minExecutionTime: Infinity,
      maxExecutionTime: 0,
      executionTimes: [],
      cpuCycles: [],
      memorySnapshots: [],
      performanceVariance: 0,
      performanceStdDev: 0,
      performanceP95: 0,
      performanceP99: 0,
      slowExecutions: 0,
      fastExecutions: 0,
      memoryLeaks: 0,
      gcPressure: 0
    };

    // Calculate execution metrics
    const wallTime = performanceEnd.wallTime - performanceStart.wallTime;
    const cpuTime = performanceEnd.cpuTime - performanceStart.cpuTime;
    const memoryDelta = performanceEnd.memoryUsage - performanceStart.memoryUsage;
    const cpuCycles = estimateCpuCycles(cpuTime, wallTime);

    // Update performance data
    performanceData.totalExecutions += 1;
    performanceData.totalCpuTime += cpuTime;
    performanceData.totalWallTime += wallTime;
    performanceData.totalMemoryDelta += memoryDelta;
    performanceData.minExecutionTime = Math.min(performanceData.minExecutionTime, wallTime);
    performanceData.maxExecutionTime = Math.max(performanceData.maxExecutionTime, wallTime);

    // Store recent execution times (keep last 100 for analysis)
    performanceData.executionTimes.push(wallTime);
    performanceData.cpuCycles.push(cpuCycles);
    performanceData.memorySnapshots.push({
      timestamp: performanceEnd.timestamp,
      heapUsed: performanceEnd.memoryUsage,
      delta: memoryDelta
    });

    // Performance classification
    const avgTime = performanceData.totalWallTime / Math.max(1, performanceData.totalExecutions);
    if (wallTime > avgTime * 2) {
      performanceData.slowExecutions++;
    } else if (wallTime < avgTime * 0.5) {
      performanceData.fastExecutions++;
    }

    // Memory leak detection - very sensitive threshold for testing
    if (Math.abs(memoryDelta) > 50 * 1024) { // > 50KB allocation (very sensitive)
      performanceData.memoryLeaks++;
    }

    // GC pressure detection (frequent small allocations)
    if (memoryDelta > 0 && memoryDelta < 10 * 1024) { // < 10KB but > 0
      performanceData.gcPressure++;
    }

    if (performanceData.executionTimes.length > 100) {
      performanceData.executionTimes.shift();
      performanceData.cpuCycles.shift();
      performanceData.memorySnapshots.shift();
    }

    // Calculate statistical metrics
    if (performanceData.executionTimes.length > 5) {
      const times = performanceData.executionTimes.slice();
      times.sort((a, b) => a - b);

      // Calculate percentiles
      const p95Index = Math.floor(times.length * 0.95);
      const p99Index = Math.floor(times.length * 0.99);
      performanceData.performanceP95 = times[p95Index] || 0;
      performanceData.performanceP99 = times[p99Index] || 0;

      // Calculate variance and standard deviation
      const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      performanceData.performanceVariance = variance;
      performanceData.performanceStdDev = Math.sqrt(variance);
    }

    global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.set(performanceKey, performanceData);

    // Store additional metadata about the node type
    const metaKey = `${key}:meta`;
    if (!global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.has(metaKey)) {
      global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.set(metaKey, {
        nodeType: nodeType,
        firstExecution: Date.now(),
        minDepth: callDepth,
        maxDepth: callDepth
      });
    } else {
      const meta = global.__TEST_LINEAGE_TRACKER__.currentTest.coverage.get(metaKey);
      meta.minDepth = Math.min(meta.minDepth, callDepth);
      meta.maxDepth = Math.max(meta.maxDepth, callDepth);
    }
  }
};

// Export results for the reporter
global.__GET_LINEAGE_RESULTS__ = function() {
  const results = {};

  // Use persistent data if available, fallback to test coverage map
  const dataSource = global.__LINEAGE_PERSISTENT_DATA__ || Array.from(global.__TEST_LINEAGE_TRACKER__.testCoverage.values());

  console.log(`🔍 Getting lineage results from ${dataSource.length} tests`);

  dataSource.forEach((testData) => {
    testData.coverage.forEach((count, key) => {
      // Skip metadata entries
      if (key.includes(':meta')) {
        return;
      }

      const [filePath, lineNumber] = key.split(':');

      // Skip test files and node_modules
      if (filePath.includes('__tests__') ||
          filePath.includes('.test.') ||
          filePath.includes('.spec.') ||
          filePath.includes('node_modules')) {
        return;
      }

      if (!results[filePath]) {
        results[filePath] = {};
      }

      if (!results[filePath][lineNumber]) {
        results[filePath][lineNumber] = [];
      }

      results[filePath][lineNumber].push({
        testName: testData.name,
        testFile: 'current-test-file', // Will be updated by reporter
        executionCount: count,
        duration: testData.duration,
        type: 'precise',
        failed: testData.failed || false
      });

      console.log(`✅ Added precise data: ${filePath}:${lineNumber} -> ${testData.name} (${count} executions)`);
    });
  });

  console.log(`🔍 Final results: ${Object.keys(results).length} files with precise data`);
  return results;
};



console.log('🎯 Test lineage tracking setup completed');
