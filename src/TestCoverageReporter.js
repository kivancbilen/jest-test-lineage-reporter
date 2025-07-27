const fs = require('fs');
const path = require('path');

class TestCoverageReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.coverageData = {};
    this.testCoverageMap = new Map(); // Map to store individual test coverage
    this.currentTestFile = null;
    this.baselineCoverage = null;

    // Validate configuration
    this.validateConfig();
  }

  validateConfig() {
    if (!this.globalConfig) {
      throw new Error('TestCoverageReporter: globalConfig is required');
    }

    // Set default options
    this.options = {
      outputFile: this.options.outputFile || 'test-lineage-report.html',
      memoryLeakThreshold: this.options.memoryLeakThreshold || 50 * 1024, // 50KB
      gcPressureThreshold: this.options.gcPressureThreshold || 5,
      qualityThreshold: this.options.qualityThreshold || 60,
      enableDebugLogging: this.options.enableDebugLogging || false,
      ...this.options
    };
  }

  // This method is called after a single test file (suite) has completed.
  async onTestResult(test, testResult, _aggregatedResult) {
    const testFilePath = test.path;

    // Store test file path for later use
    this.currentTestFile = testFilePath;

    // Always process fallback coverage for now, but mark for potential precise data
    const coverage = testResult.coverage;
    if (!coverage) {
      return;
    }

    // Process each individual test result (fallback mode)
    testResult.testResults.forEach((testCase, index) => {
      if (testCase.status === 'passed') {
        this.processIndividualTestCoverage(testCase, coverage, testFilePath, index);
      }
    });
  }

  processLineageResults(lineageResults, testFilePath) {
    console.log('🎯 Processing precise lineage tracking results...');

    // lineageResults format: { filePath: { lineNumber: [testInfo, ...] } }
    for (const filePath in lineageResults) {
      // Skip test files - we only want to track coverage of source files
      if (filePath.includes('__tests__') || filePath.includes('.test.') || filePath.includes('.spec.')) {
        continue;
      }

      // Initialize the data structure for this file if it doesn't exist
      if (!this.coverageData[filePath]) {
        this.coverageData[filePath] = {};
      }

      for (const lineNumber in lineageResults[filePath]) {
        const testInfos = lineageResults[filePath][lineNumber];

        // Convert to our expected format
        const processedTests = testInfos.map(testInfo => ({
          name: testInfo.testName,
          file: path.basename(testInfo.testFile || testFilePath),
          fullPath: testInfo.testFile || testFilePath,
          executionCount: testInfo.executionCount || 1,
          timestamp: testInfo.timestamp || Date.now(),
          type: 'precise' // Mark as precise tracking
        }));

        this.coverageData[filePath][lineNumber] = processedTests;
      }
    }
  }

  processIndividualTestCoverage(testCase, coverage, testFilePath, _testIndex) {
    const testName = testCase.fullName;

    // Since Jest doesn't provide per-test coverage, we'll use heuristics
    // to estimate which tests likely covered which lines

    for (const filePath in coverage) {
      // Skip test files
      if (filePath.includes('__tests__') || filePath.includes('.test.') || filePath.includes('.spec.')) {
        continue;
      }

      const fileCoverage = coverage[filePath];
      const statementMap = fileCoverage.statementMap;
      const statements = fileCoverage.s;

      // Initialize the data structure for this file if it doesn't exist
      if (!this.coverageData[filePath]) {
        this.coverageData[filePath] = {};
      }

      // Analyze which lines were covered
      for (const statementId in statements) {
        if (statements[statementId] > 0) {
          const lineNumber = String(statementMap[statementId].start.line);

          if (!this.coverageData[filePath][lineNumber]) {
            this.coverageData[filePath][lineNumber] = [];
          }

          // Use heuristics to determine if this test likely covered this line
          if (this.isTestLikelyCoveringLine(testCase, filePath, lineNumber, fileCoverage)) {
            // Add test with more detailed information
            const testInfo = {
              name: testName,
              file: path.basename(testFilePath),
              fullPath: testFilePath,
              duration: testCase.duration || 0,
              confidence: this.calculateConfidence(testCase, filePath, lineNumber)
            };

            this.coverageData[filePath][lineNumber].push(testInfo);
          }
        }
      }
    }
  }

  isTestLikelyCoveringLine(testCase, _filePath, _lineNumber, _fileCoverage) {
    // Heuristic 1: If test name mentions the function/file being tested
    const _testName = testCase.fullName.toLowerCase();

    // Simplified heuristic - for now, include all tests
    // TODO: Implement more sophisticated heuristics

    // Heuristic 3: If it's a simple file with few tests, assume all tests cover most lines
    // This is a fallback for when we can't determine specific coverage
    return true; // For now, include all tests (we'll refine this)
  }

  calculateConfidence(_testCase, _filePath, _lineNumber) {
    // Simplified confidence calculation
    // TODO: Implement more sophisticated confidence scoring
    return 75; // Default confidence
  }

  extractCodeKeywords(sourceCode) {
    // Extract function names, variable names, etc. from source code line
    const keywords = [];

    // Match function names: function name() or name: function() or const name =
    const functionMatches = sourceCode.match(/(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\()|(?:const|let|var)\s+(\w+))/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        const nameMatch = match.match(/(\w+)/);
        if (nameMatch) keywords.push(nameMatch[1]);
      });
    }

    // Match method calls: object.method()
    const methodMatches = sourceCode.match(/(\w+)\s*\(/g);
    if (methodMatches) {
      methodMatches.forEach(match => {
        const nameMatch = match.match(/(\w+)/);
        if (nameMatch) keywords.push(nameMatch[1]);
      });
    }

    return keywords;
  }

  getSourceCodeLine(filePath, lineNumber) {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf8');
      const lines = sourceCode.split('\n');
      return lines[lineNumber - 1] || '';
    } catch (error) {
      return '';
    }
  }

  // This method is called after all tests in the entire run have completed.
  async onRunComplete(_contexts, _results) {
    // Try to get precise tracking data before generating reports
    this.tryGetPreciseTrackingData();

    this.generateReport();
    this.generateHtmlReport();
  }

  tryGetPreciseTrackingData() {
    // Try to read tracking data from file first
    const fileData = this.readTrackingDataFromFile();
    if (fileData) {
      console.log('🎯 Found precise lineage tracking data from file! Replacing estimated data...');

      // Clear existing coverage data and replace with precise data
      this.coverageData = {};
      this.processFileTrackingData(fileData);
      return true;
    }

    // Fallback to global function
    if (global.__GET_LINEAGE_RESULTS__) {
      const lineageResults = global.__GET_LINEAGE_RESULTS__();
      if (Object.keys(lineageResults).length > 0) {
        console.log('🎯 Found precise lineage tracking data from global! Replacing estimated data...');

        // Clear existing coverage data and replace with precise data
        this.coverageData = {};
        this.processLineageResults(lineageResults, 'precise-tracking');
        return true;
      }
    }

    console.log('⚠️ No precise tracking data found, using estimated coverage');
    return false;
  }

  readTrackingDataFromFile() {
    try {
      const filePath = path.join(process.cwd(), '.jest-lineage-data.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`📖 Read tracking data: ${data.tests.length} tests from file`);

        // Debug logging removed for production

        return data.tests;
      } else {
        console.log(`⚠️ Tracking data file not found: ${filePath}`);
      }
    } catch (error) {
      console.warn('Warning: Could not read tracking data from file:', error.message);
    }
    return null;
  }

  processFileTrackingData(testDataArray) {
    if (!Array.isArray(testDataArray)) {
      console.warn('⚠️ processFileTrackingData: testDataArray is not an array');
      return;
    }

    console.log(`🔍 Processing ${testDataArray.length} test data entries`);

    testDataArray.forEach((testData, index) => {
      try {
        if (!testData || typeof testData !== 'object') {
          console.warn(`⚠️ Skipping invalid test data at index ${index}:`, testData);
          return;
        }

        if (!testData.coverage || typeof testData.coverage !== 'object') {
          console.warn(`⚠️ Skipping test data with invalid coverage at index ${index}:`, testData.name);
          return;
        }

        // testData.coverage is now a plain object, not a Map
        Object.entries(testData.coverage).forEach(([key, count]) => {
          try {
            // Skip metadata, depth, and performance entries for now (process them separately)
            if (key.includes(':meta') || key.includes(':depth') || key.includes(':performance')) {
              return;
            }

            const parts = key.split(':');
            if (parts.length < 2) {
              console.warn(`⚠️ Invalid key format: ${key}`);
              return;
            }

            const lineNumber = parts.pop(); // Last part is line number
            const filePath = parts.join(':'); // Rejoin in case path contains colons

            // Validate line number
            if (isNaN(parseInt(lineNumber))) {
              console.warn(`⚠️ Invalid line number: ${lineNumber} for file: ${filePath}`);
              return;
            }

            // Skip test files and node_modules
            if (filePath.includes('__tests__') ||
                filePath.includes('.test.') ||
                filePath.includes('.spec.') ||
                filePath.includes('node_modules')) {
              return;
            }

            // Get depth data for this line
            const depthKey = `${filePath}:${lineNumber}:depth`;
            const depthData = testData.coverage[depthKey] || { 1: count };

            // Get metadata for this line
            const metaKey = `${filePath}:${lineNumber}:meta`;
            const metaData = testData.coverage[metaKey] || {};

            // Get performance data for this line
            const performanceKey = `${filePath}:${lineNumber}:performance`;
            const performanceData = testData.coverage[performanceKey] || {
              totalExecutions: count,
              totalCpuTime: 0,
              totalWallTime: 0,
              totalMemoryDelta: 0,
              minExecutionTime: 0,
              maxExecutionTime: 0,
              executionTimes: [],
              cpuCycles: []
            };

            // Initialize the data structure for this file if it doesn't exist
            if (!this.coverageData[filePath]) {
              this.coverageData[filePath] = {};
            }

            if (!this.coverageData[filePath][lineNumber]) {
              this.coverageData[filePath][lineNumber] = [];
            }

            // Add test with precise tracking information including depth, performance, and quality
            const testInfo = {
              name: testData.name || 'Unknown test',
              file: 'precise-tracking',
              fullPath: 'precise-tracking',
              executionCount: typeof count === 'number' ? count : 1,
              duration: testData.duration || 0,
              type: 'precise', // Mark as precise tracking
              depthData: depthData, // Call depth information
              minDepth: metaData.minDepth || 1,
              maxDepth: metaData.maxDepth || 1,
              nodeType: metaData.nodeType || 'unknown',
              performance: {
                totalCpuTime: performanceData.totalCpuTime || 0,
                totalWallTime: performanceData.totalWallTime || 0,
                avgCpuTime: performanceData.totalExecutions > 0 ? performanceData.totalCpuTime / performanceData.totalExecutions : 0,
                avgWallTime: performanceData.totalExecutions > 0 ? performanceData.totalWallTime / performanceData.totalExecutions : 0,
                totalMemoryDelta: performanceData.totalMemoryDelta || 0,
                minExecutionTime: performanceData.minExecutionTime || 0,
                maxExecutionTime: performanceData.maxExecutionTime || 0,
                totalCpuCycles: performanceData.cpuCycles ? performanceData.cpuCycles.reduce((sum, cycles) => sum + cycles, 0) : 0,
                avgCpuCycles: performanceData.cpuCycles && performanceData.cpuCycles.length > 0 ?
                  performanceData.cpuCycles.reduce((sum, cycles) => sum + cycles, 0) / performanceData.cpuCycles.length : 0,
                performanceVariance: performanceData.performanceVariance || 0,
                performanceStdDev: performanceData.performanceStdDev || 0,
                performanceP95: performanceData.performanceP95 || 0,
                performanceP99: performanceData.performanceP99 || 0,
                slowExecutions: performanceData.slowExecutions || 0,
                fastExecutions: performanceData.fastExecutions || 0,
                memoryLeaks: performanceData.memoryLeaks || 0,
                gcPressure: performanceData.gcPressure || 0
              },
              quality: testData.qualityMetrics || {
                assertions: 0,
                asyncOperations: 0,
                mockUsage: 0,
                errorHandling: 0,
                edgeCases: 0,
                complexity: 0,
                maintainability: 50,
                reliability: 50,
                testSmells: [],
                codePatterns: [],
                isolationScore: 100,
                testLength: 0
              }
            };

            this.coverageData[filePath][lineNumber].push(testInfo);

            // console.log(`🔍 DEBUG: Added coverage for "${filePath}":${lineNumber} -> ${testData.name} (${count} executions)`);

          } catch (entryError) {
            console.warn(`⚠️ Error processing coverage entry ${key}:`, entryError.message);
          }
        });
      } catch (testError) {
        console.warn(`⚠️ Error processing test data at index ${index}:`, testError.message);
      }
    });

    console.log(`✅ Processed tracking data for ${Object.keys(this.coverageData).length} files`);
  }

  generateReport() {
    console.log('\n--- Jest Test Lineage Reporter: Line-by-Line Test Coverage ---');

    // Generate test quality summary first
    this.generateTestQualitySummary();

    for (const filePath in this.coverageData) {
      console.log(`\n📄 File: ${filePath}`);
      const lineCoverage = this.coverageData[filePath];
        
      const lineNumbers = Object.keys(lineCoverage).sort((a, b) => parseInt(a) - parseInt(b));

      if (lineNumbers.length === 0) {
        console.log('  No lines covered by tests in this file.');
        continue;
      }

      for (const line of lineNumbers) {
        const testInfos = lineCoverage[line];
        const uniqueTests = this.deduplicateTests(testInfos);
        console.log(`  Line ${line}: Covered by ${uniqueTests.length} test(s)`);
        uniqueTests.forEach(testInfo => {
          const testName = typeof testInfo === 'string' ? testInfo : testInfo.name;
          const testFile = typeof testInfo === 'object' ? testInfo.file : 'Unknown';
          const executionCount = typeof testInfo === 'object' ? testInfo.executionCount : 1;
          const trackingType = typeof testInfo === 'object' && testInfo.type === 'precise' ? '✅ PRECISE' : '⚠️ ESTIMATED';

          // Add depth information for precise tracking
          let depthInfo = '';
          if (typeof testInfo === 'object' && testInfo.type === 'precise' && testInfo.depthData) {
            const depths = Object.keys(testInfo.depthData).map(d => parseInt(d)).sort((a, b) => a - b);
            if (depths.length === 1) {
              depthInfo = `, depth ${depths[0]}`;
            } else {
              depthInfo = `, depths ${depths.join(',')}`;
            }
          }

          // Add performance information for precise tracking
          let performanceInfo = '';
          if (typeof testInfo === 'object' && testInfo.type === 'precise' && testInfo.performance) {
            const perf = testInfo.performance;
            if (perf.avgCpuCycles > 0) {
              const cycles = perf.avgCpuCycles > 1000000 ?
                `${(perf.avgCpuCycles / 1000000).toFixed(1)}M` :
                `${Math.round(perf.avgCpuCycles)}`;
              const cpuTime = perf.avgCpuTime > 1000 ?
                `${(perf.avgCpuTime / 1000).toFixed(2)}ms` :
                `${perf.avgCpuTime.toFixed(1)}μs`;

              // Add memory information
              let memoryInfo = '';
              if (perf.totalMemoryDelta !== 0) {
                const memoryMB = Math.abs(perf.totalMemoryDelta) / (1024 * 1024);
                const memorySign = perf.totalMemoryDelta > 0 ? '+' : '-';
                if (memoryMB > 1) {
                  memoryInfo = `, ${memorySign}${memoryMB.toFixed(1)}MB`;
                } else {
                  const memoryKB = Math.abs(perf.totalMemoryDelta) / 1024;
                  memoryInfo = `, ${memorySign}${memoryKB.toFixed(1)}KB`;
                }
              }

              // Add performance alerts
              let alerts = '';
              const memoryMB = Math.abs(perf.totalMemoryDelta || 0) / (1024 * 1024);
              if (memoryMB > 1) alerts += ` 🚨LEAK`;
              if (perf.gcPressure > 5) alerts += ` 🗑️GC`;
              if (perf.slowExecutions > perf.fastExecutions) alerts += ` 🐌SLOW`;

              performanceInfo = `, ${cycles} cycles, ${cpuTime}${memoryInfo}${alerts}`;
            }
          }

          // Add quality information for precise tracking
          let qualityInfo = '';
          if (typeof testInfo === 'object' && testInfo.type === 'precise' && testInfo.quality) {
            const quality = testInfo.quality;
            const qualityBadges = [];

            // Quality score with explanation
            let qualityScore = '';
            if (quality.maintainability >= 80) {
              qualityScore = '🏆 High Quality';
            } else if (quality.maintainability >= 60) {
              qualityScore = '✅ Good Quality';
            } else if (quality.maintainability >= 40) {
              qualityScore = '⚠️ Fair Quality';
            } else {
              qualityScore = '❌ Poor Quality';
            }
            qualityBadges.push(`${qualityScore} (${Math.round(quality.maintainability)}%)`);

            // Reliability score
            if (quality.reliability >= 80) qualityBadges.push(`🛡️ Reliable (${Math.round(quality.reliability)}%)`);
            else if (quality.reliability >= 60) qualityBadges.push(`🔒 Stable (${Math.round(quality.reliability)}%)`);
            else qualityBadges.push(`⚠️ Fragile (${Math.round(quality.reliability)}%)`);

            // Test smells with details
            if (quality.testSmells && quality.testSmells.length > 0) {
              qualityBadges.push(`🚨 ${quality.testSmells.length} Smells: ${quality.testSmells.join(', ')}`);
            }

            // Positive indicators
            if (quality.assertions > 5) qualityBadges.push(`🎯 ${quality.assertions} Assertions`);
            if (quality.errorHandling > 0) qualityBadges.push(`🔒 ${quality.errorHandling} Error Tests`);
            if (quality.edgeCases > 3) qualityBadges.push(`🎪 ${quality.edgeCases} Edge Cases`);

            if (qualityBadges.length > 0) {
              qualityInfo = ` [${qualityBadges.join(', ')}]`;
            }
          }

          console.log(`    - "${testName}" (${testFile}, ${executionCount} executions${depthInfo}${performanceInfo}) ${trackingType}${qualityInfo}`);
        });
      }
    }

    console.log('\n--- Report End ---');
  }

  async generateHtmlReport() {
    console.log('\n📄 Generating HTML coverage report...');

    let html = this.generateHtmlTemplate();

    // Validate coverage data before processing
    const validFiles = this.validateCoverageData();

    for (const filePath of validFiles) {
      try {
        html += await this.generateCodeTreeSection(filePath);
      } catch (error) {
        console.error(`❌ Error generating section for ${filePath}:`, error.message);
        html += this.generateErrorSection(filePath, error.message);
      }
    }

    html += this.generateHtmlFooter();

    // Write HTML file
    const outputPath = path.join(process.cwd(), 'test-lineage-report.html');
    fs.writeFileSync(outputPath, html, 'utf8');

    console.log(`✅ HTML report generated: ${outputPath}`);
    console.log('🌐 Open the file in your browser to view the visual coverage report');
  }

  validateCoverageData() {
    const validFiles = [];

    for (const filePath in this.coverageData) {
      const fileData = this.coverageData[filePath];

      if (!fileData) {
        console.warn(`⚠️ Skipping ${filePath}: No coverage data`);
        continue;
      }

      if (typeof fileData !== 'object') {
        console.warn(`⚠️ Skipping ${filePath}: Invalid data type (${typeof fileData})`);
        continue;
      }

      if (Object.keys(fileData).length === 0) {
        console.warn(`⚠️ Skipping ${filePath}: Empty coverage data`);
        continue;
      }

      // Validate that the data structure is correct
      let hasValidData = false;
      for (const lineNumber in fileData) {
        const lineData = fileData[lineNumber];
        if (Array.isArray(lineData) && lineData.length > 0) {
          hasValidData = true;
          break;
        }
      }

      if (!hasValidData) {
        console.warn(`⚠️ Skipping ${filePath}: No valid line data found`);
        continue;
      }

      validFiles.push(filePath);
    }

    // console.log(`✅ Validated ${validFiles.length} files for HTML report`);
    return validFiles;
  }

  findMatchingCoveragePath(targetPath) {
    const targetBasename = path.basename(targetPath);

    // Strategy 1: Find exact basename match
    for (const coveragePath of Object.keys(this.coverageData)) {
      if (path.basename(coveragePath) === targetBasename) {
        return coveragePath;
      }
    }

    // Strategy 2: Convert both paths to relative from package.json and compare
    const projectRoot = this.findProjectRoot(process.cwd());
    const targetRelative = this.makeRelativeToProject(targetPath, projectRoot);

    for (const coveragePath of Object.keys(this.coverageData)) {
      const coverageRelative = this.makeRelativeToProject(coveragePath, projectRoot);
      if (targetRelative === coverageRelative) {
        return coveragePath;
      }
    }

    // Strategy 3: Find path that contains the target filename
    for (const coveragePath of Object.keys(this.coverageData)) {
      if (coveragePath.includes(targetBasename)) {
        return coveragePath;
      }
    }

    // Strategy 4: Find path where target contains the coverage filename
    for (const coveragePath of Object.keys(this.coverageData)) {
      const coverageBasename = path.basename(coveragePath);
      if (targetPath.includes(coverageBasename)) {
        return coveragePath;
      }
    }

    // Strategy 5: Fuzzy matching - remove common path differences
    const normalizedTarget = this.normalizePath(targetPath);
    for (const coveragePath of Object.keys(this.coverageData)) {
      const normalizedCoverage = this.normalizePath(coveragePath);
      if (normalizedTarget === normalizedCoverage) {
        return coveragePath;
      }
    }

    return null;
  }

  findProjectRoot(startPath) {
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

  makeRelativeToProject(filePath, projectRoot) {
    // If path is absolute and starts with project root, make it relative
    if (path.isAbsolute(filePath) && filePath.startsWith(projectRoot)) {
      return path.relative(projectRoot, filePath);
    }

    // If path is already relative, return as-is
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }

    // Try to find common base with project root
    const relativePath = path.relative(projectRoot, filePath);
    if (!relativePath.startsWith('..')) {
      return relativePath;
    }

    // Fallback to original path
    return filePath;
  }

  normalizePath(filePath) {
    // Remove common path variations that might cause mismatches
    return filePath
      .replace(/\/services\//g, '/')  // Remove /services/ directory
      .replace(/\/src\//g, '/')       // Remove /src/ directory
      .replace(/\/lib\//g, '/')       // Remove /lib/ directory
      .replace(/\/app\//g, '/')       // Remove /app/ directory
      .replace(/\/server\//g, '/')    // Remove /server/ directory
      .replace(/\/client\//g, '/')    // Remove /client/ directory
      .replace(/\/+/g, '/')           // Replace multiple slashes with single
      .toLowerCase();                 // Case insensitive matching
  }

  generateErrorSection(filePath, errorMessage) {
    return `<div class="file-section">
      <div class="file-header">❌ Error processing ${path.basename(filePath)}</div>
      <div class="error">
        <p><strong>File:</strong> ${filePath}</p>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p><strong>Suggestion:</strong> Check if the file exists and has valid coverage data.</p>
      </div>
    </div>`;
  }

  generateHtmlTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jest Test Lineage Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .navigation {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .nav-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .nav-btn, .action-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        .nav-btn {
            background: #e9ecef;
            color: #495057;
        }
        .nav-btn.active {
            background: #007bff;
            color: white;
        }
        .nav-btn:hover {
            background: #007bff;
            color: white;
        }
        .action-btn {
            background: #28a745;
            color: white;
        }
        .action-btn:hover {
            background: #218838;
        }
        .sort-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .sort-controls label {
            font-weight: 500;
            color: #495057;
        }
        .sort-controls select {
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            background: white;
            font-size: 14px;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .file-section {
            background: white;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .file-header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            font-size: 1.2em;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .file-header:hover {
            background: #34495e;
        }
        .file-header .expand-icon {
            font-size: 18px;
            transition: transform 0.3s ease;
        }
        .file-header.expanded .expand-icon {
            transform: rotate(90deg);
        }
        .file-content {
            display: none;
        }
        .file-content.expanded {
            display: block;
        }
        .file-path {
            font-family: 'Courier New', monospace;
            opacity: 0.8;
            font-size: 0.9em;
        }
        .code-container {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            line-height: 1.5;
            background: #f8f9fa;
        }
        .code-line {
            display: flex;
            border-bottom: 1px solid #e9ecef;
            transition: background-color 0.2s ease;
        }
        .code-line:hover {
            background-color: #e3f2fd;
        }
        .line-number {
            background: #6c757d;
            color: white;
            padding: 8px 12px;
            min-width: 60px;
            text-align: right;
            font-weight: bold;
            user-select: none;
        }
        .line-covered {
            background: #28a745;
        }
        .line-uncovered {
            background: #dc3545;
        }
        .line-content {
            flex: 1;
            padding: 8px 16px;
            white-space: pre;
            overflow-x: auto;
        }
        .coverage-indicator {
            background: #17a2b8;
            color: white;
            padding: 8px 12px;
            min-width: 80px;
            text-align: center;
            font-size: 12px;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s ease;
        }
        .coverage-indicator:hover {
            background: #138496;
        }
        .coverage-details {
            display: none;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            margin: 0;
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
        }
        .coverage-details.expanded {
            display: block;
        }
        .test-badge {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 4px 8px;
            margin: 2px;
            border-radius: 12px;
            font-size: 11px;
            transition: all 0.2s ease;
        }
        .test-badge:hover {
            background: #0056b3;
            transform: translateY(-1px);
        }
        .depth-badge {
            display: inline-block;
            background: #6c757d;
            color: white;
            padding: 2px 6px;
            margin-left: 4px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: bold;
            vertical-align: middle;
        }
        .depth-badge.depth-1 {
            background: #28a745; /* Green for direct calls */
        }
        .depth-badge.depth-2 {
            background: #ffc107; /* Yellow for one level deep */
            color: #212529;
        }
        .depth-badge.depth-3 {
            background: #fd7e14; /* Orange for two levels deep */
        }
        .depth-badge.depth-4,
        .depth-badge.depth-5,
        .depth-badge.depth-6,
        .depth-badge.depth-7,
        .depth-badge.depth-8,
        .depth-badge.depth-9,
        .depth-badge.depth-10 {
            background: #dc3545; /* Red for very deep calls */
        }
        .lines-analysis {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .lines-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .lines-table th,
        .lines-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        .lines-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
            position: sticky;
            top: 0;
        }
        .lines-table tr:hover {
            background: #f8f9fa;
        }
        .file-name {
            font-family: 'Courier New', monospace;
            font-weight: 500;
            color: #007bff;
        }
        .line-number {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: #6c757d;
            text-align: center;
        }
        .code-preview {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #495057;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .test-count,
        .execution-count,
        .cpu-cycles,
        .cpu-time,
        .wall-time {
            text-align: center;
            font-weight: 600;
        }
        .cpu-cycles {
            color: #dc3545;
            font-family: 'Courier New', monospace;
        }
        .cpu-time {
            color: #fd7e14;
            font-family: 'Courier New', monospace;
        }
        .wall-time {
            color: #6f42c1;
            font-family: 'Courier New', monospace;
        }
        .max-depth,
        .depth-range,
        .quality-score,
        .reliability-score,
        .test-smells {
            text-align: center;
        }
        .quality-excellent {
            color: #28a745;
            font-weight: bold;
        }
        .quality-good {
            color: #6f42c1;
            font-weight: bold;
        }
        .quality-fair {
            color: #ffc107;
            font-weight: bold;
        }
        .quality-poor {
            color: #dc3545;
            font-weight: bold;
        }
        .smells-none {
            color: #28a745;
            font-weight: bold;
        }
        .smells-few {
            color: #ffc107;
            font-weight: bold;
        }
        .smells-many {
            color: #dc3545;
            font-weight: bold;
        }
        .performance-analysis,
        .quality-analysis {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .performance-summary,
        .quality-summary {
            margin-bottom: 30px;
        }
        .perf-stats,
        .quality-stats {
            display: flex;
            gap: 20px;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .perf-stat,
        .quality-stat {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            min-width: 120px;
        }
        .perf-number,
        .quality-number {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .perf-label,
        .quality-label {
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
        }
        .performance-tables,
        .quality-tables {
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
        }
        .perf-table-container,
        .quality-table-container {
            flex: 1;
            min-width: 400px;
        }
        .perf-table,
        .quality-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .perf-table th,
        .perf-table td,
        .quality-table th,
        .quality-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        .perf-table th,
        .quality-table th {
            background: #f8f9fa;
            font-weight: 600;
        }
        .memory-usage {
            color: #6f42c1;
            font-weight: bold;
        }
        .memory-leaks {
            color: #dc3545;
            font-weight: bold;
        }
        .quality-distribution {
            margin: 20px 0;
        }
        .quality-bars {
            margin: 15px 0;
        }
        .quality-bar {
            margin: 10px 0;
        }
        .bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 5px 0;
        }
        .fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .fill.excellent {
            background: #28a745;
        }
        .fill.good {
            background: #6f42c1;
        }
        .fill.fair {
            background: #ffc107;
        }
        .fill.poor {
            background: #dc3545;
        }
        .quality-issues {
            color: #dc3545;
            font-size: 12px;
        }
        .recommendations {
            color: #007bff;
            font-size: 12px;
            font-style: italic;
        }
        .performance-help {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            font-size: 14px;
        }
        .help-section {
            margin: 10px 0;
            padding: 8px;
            background: white;
            border-radius: 4px;
            border-left: 4px solid #007bff;
        }
        .help-section strong {
            color: #495057;
        }
        .help-section em {
            color: #28a745;
            font-weight: 600;
        }
        .test-file {
            font-weight: bold;
            color: #495057;
            margin-top: 10px;
            margin-bottom: 5px;
        }
        .test-file:first-child {
            margin-top: 0;
        }
        .line-coverage {
            padding: 20px;
        }
        .line-item {
            margin-bottom: 20px;
            padding: 15px;
            border-left: 4px solid #3498db;
            background: #f8f9fa;
            border-radius: 0 5px 5px 0;
        }
        .line-number {
            font-weight: bold;
            color: #2c3e50;
            font-size: 1.1em;
            margin-bottom: 10px;
        }
        .test-count {
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .test-list {
            margin-top: 10px;
        }
        .test-item {
            background: white;
            margin: 5px 0;
            padding: 8px 12px;
            border-radius: 20px;
            display: inline-block;
            margin-right: 8px;
            margin-bottom: 8px;
            border: 1px solid #e1e8ed;
            font-size: 0.85em;
            transition: all 0.2s ease;
        }
        .test-item:hover {
            background: #3498db;
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stats {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .stats h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .stat-item {
            display: inline-block;
            margin-right: 30px;
            margin-bottom: 10px;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
        }
        .stat-label {
            display: block;
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .footer {
            text-align: center;
            color: #7f8c8d;
            margin-top: 40px;
            padding: 20px;
        }
    </style>
    <script>
        function toggleCoverage(lineNumber, filePath) {
            const detailsId = 'details-' + filePath.replace(/[^a-zA-Z0-9]/g, '_') + '-' + lineNumber;
            const details = document.getElementById(detailsId);
            if (details) {
                details.classList.toggle('expanded');
            }
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>🧪 Jest Test Lineage Report</h1>
        <p>Click on coverage indicators to see which tests cover each line</p>
        <div class="file-path">Generated on ${new Date().toLocaleString()}</div>
    </div>

    <div class="navigation">
        <div class="nav-buttons">
            <button id="view-files" class="nav-btn active" onclick="showView('files')">📁 Files View</button>
            <button id="view-lines" class="nav-btn" onclick="showView('lines')">📊 Lines Analysis</button>
            <button id="view-performance" class="nav-btn" onclick="showView('performance')">🔥 Performance Analytics</button>
            <button id="view-quality" class="nav-btn" onclick="showView('quality')">🧪 Test Quality</button>
            <button id="expand-all" class="action-btn" onclick="expandAll()">📖 Expand All</button>
            <button id="collapse-all" class="action-btn" onclick="collapseAll()">📕 Collapse All</button>
        </div>
        <div class="sort-controls" id="sort-controls" style="display: none;">
            <label>Sort by:</label>
            <select id="sort-by" onchange="sortLines()">
                <option value="executions">Most Executions</option>
                <option value="tests">Most Tests</option>
                <option value="depth">Deepest Calls</option>
                <option value="cpuCycles">Most CPU Cycles</option>
                <option value="cpuTime">Most CPU Time</option>
                <option value="wallTime">Most Wall Time</option>
                <option value="quality">Best Quality</option>
                <option value="reliability">Most Reliable</option>
                <option value="maintainability">Most Maintainable</option>
                <option value="testSmells">Most Test Smells</option>
                <option value="file">File Name</option>
            </select>
        </div>
    </div>

    <div id="files-view">
`;
  }

  async generateCodeTreeSection(filePath) {
    try {
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File not found: ${filePath}`);

        // Try to find the file with alternative paths
        const alternativePaths = this.findAlternativeFilePaths(filePath);
        if (alternativePaths.length > 0) {
          console.log(`🔍 Trying alternative paths for ${path.basename(filePath)}:`, alternativePaths);
          for (const altPath of alternativePaths) {
            if (fs.existsSync(altPath)) {
              console.log(`✅ Found file at: ${altPath}`);
              return this.generateCodeTreeSection(altPath); // Recursive call with found path
            }
          }
        }

        return `<div class="file-section">
          <div class="file-header">❌ Error reading ${path.basename(filePath)}</div>
          <div class="error">
            <p><strong>File not found:</strong> ${filePath}</p>
            <p><strong>Tried alternatives:</strong> ${alternativePaths.slice(0, 3).join(', ')}</p>
            <p><strong>Suggestion:</strong> Check your project structure and source directory configuration.</p>
          </div>
        </div>`;
      }

      // Read the source file content
      const sourceCode = fs.readFileSync(filePath, 'utf8');
      const lines = sourceCode.split('\n');

      // Check if we have coverage data for this file
      let lineCoverage = this.coverageData[filePath];
      let actualFilePath = filePath;

      if (!lineCoverage || typeof lineCoverage !== 'object') {
        // Try to find coverage data with smart path matching
        const matchedPath = this.findMatchingCoveragePath(filePath);
        if (matchedPath) {
          console.log(`🔧 Path mismatch resolved: "${filePath}" -> "${matchedPath}"`);
          lineCoverage = this.coverageData[matchedPath];
          actualFilePath = matchedPath;
        }
      }

      if (!lineCoverage || typeof lineCoverage !== 'object') {
        console.warn(`⚠️ No coverage data found for: ${filePath}`);

        // Debug: Log all available coverage data
        // Debug logging removed for production

        console.log(`🔍 DEBUG: Looking for: "${filePath}"`);
        console.log(`🔍 DEBUG: Exact match exists: ${this.coverageData.hasOwnProperty(filePath)}`);

        // Check for similar paths
        const similarPaths = Object.keys(this.coverageData).filter(key =>
          key.includes(path.basename(filePath)) || filePath.includes(path.basename(key))
        );
        if (similarPaths.length > 0) {
          console.log(`🔍 DEBUG: Similar paths found:`, similarPaths);
        }

        // Log the actual data structure for the first few files
        console.log(`🔍 DEBUG: Sample coverage data structure:`);
        Object.entries(this.coverageData).slice(0, 2).forEach(([key, value]) => {
          console.log(`  File: ${key}`);
          console.log(`  Type: ${typeof value}, Keys: ${value ? Object.keys(value).length : 'N/A'}`);
          if (value && typeof value === 'object') {
            const sampleLines = Object.keys(value).slice(0, 3);
            console.log(`  Sample lines: ${sampleLines.join(', ')}`);
          }
        });

        return `<div class="file-section">
          <div class="file-header">❌ Error reading ${path.basename(filePath)}</div>
          <div class="error">
            <p><strong>File:</strong> ${filePath}</p>
            <p><strong>Error:</strong> No coverage data available</p>
            <p><strong>Available files:</strong> ${Object.keys(this.coverageData).length} files tracked</p>
            <p><strong>Similar paths:</strong> ${similarPaths.length > 0 ? similarPaths.join(', ') : 'None found'}</p>
            <p><strong>Suggestion:</strong> Make sure the file is being instrumented and tests are running.</p>
          </div>
        </div>`;
      }

      const coveredLineNumbers = Object.keys(lineCoverage).map(n => parseInt(n));

      // Calculate stats for this file
      const totalLines = lines.length;
      const coveredLines = coveredLineNumbers.length;
      const totalTests = new Set();
      Object.values(lineCoverage).forEach(tests => {
        if (Array.isArray(tests)) {
          tests.forEach(test => totalTests.add(test));
        }
      });

      const fileId = actualFilePath.replace(/[^a-zA-Z0-9]/g, '_');

      let html = `
    <div class="file-section">
        <div class="file-header" onclick="toggleFile('${fileId}')">
            <div>
                📄 ${path.basename(filePath)}
                <div class="file-path">${filePath}</div>
            </div>
            <span class="expand-icon">▶</span>
        </div>
        <div class="file-content" id="content-${fileId}">
            <div class="stats">
                <h3>File Statistics</h3>
                <div class="stat-item">
                    <div class="stat-number">${coveredLines}</div>
                    <span class="stat-label">Lines Covered</span>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${totalLines}</div>
                    <span class="stat-label">Total Lines</span>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${totalTests.size}</div>
                    <span class="stat-label">Unique Tests</span>
                </div>
            </div>
            <div class="code-container">
`;

      // Generate each line of code
      lines.forEach((lineContent, index) => {
        const lineNumber = index + 1;
        const isCovered = coveredLineNumbers.includes(lineNumber);
        const lineNumberClass = isCovered ? 'line-covered' : 'line-uncovered';

        html += `
            <div class="code-line">
                <div class="line-number ${lineNumberClass}">${lineNumber}</div>
                <div class="line-content">${this.escapeHtml(lineContent || ' ')}</div>`;

        if (isCovered) {
          const testInfos = lineCoverage[lineNumber];
          if (testInfos && Array.isArray(testInfos)) {
            const uniqueTests = this.deduplicateTests(testInfos);
            html += `
                <div class="coverage-indicator" onclick="toggleCoverage(${lineNumber}, '${fileId}')">
                    ${uniqueTests.length} test${uniqueTests.length !== 1 ? 's' : ''}
                </div>`;
          } else {
            html += `
                <div class="coverage-indicator" style="background: #ffc107;">
                    Invalid data
                </div>`;
          }
        } else {
          html += `
                <div class="coverage-indicator" style="background: #6c757d;">
                    No coverage
                </div>`;
        }

        html += `
            </div>`;

        // Add coverage details (initially hidden)
        if (isCovered) {
          const testInfos = lineCoverage[lineNumber];
          if (testInfos && Array.isArray(testInfos) && testInfos.length > 0) {
            const uniqueTests = this.deduplicateTests(testInfos);
            const testsByFile = this.groupTestInfosByFile(uniqueTests);

            html += `
            <div id="details-${fileId}-${lineNumber}" class="coverage-details">
                <strong>Line ${lineNumber} is covered by ${uniqueTests.length} test${uniqueTests.length !== 1 ? 's' : ''}:</strong>`;

            for (const [testFile, tests] of Object.entries(testsByFile)) {
              if (tests && Array.isArray(tests)) {
                html += `
                <div class="test-file">📁 ${testFile}</div>`;
                tests.forEach(testInfo => {
                  if (testInfo) {
                    const testName = typeof testInfo === 'string' ? testInfo : (testInfo.name || 'Unknown test');
                    const executionCount = typeof testInfo === 'object' ? (testInfo.executionCount || 1) : 1;
                    const trackingType = typeof testInfo === 'object' && testInfo.type === 'precise' ? 'PRECISE' : 'ESTIMATED';

                    // Generate depth information
                    let depthInfo = '';
                    let depthBadge = '';
                    if (typeof testInfo === 'object' && testInfo.type === 'precise' && testInfo.depthData) {
                      const depths = Object.keys(testInfo.depthData).map(d => parseInt(d)).sort((a, b) => a - b);
                      const minDepth = Math.min(...depths);

                      if (depths.length === 1) {
                        depthInfo = `, depth ${depths[0]}`;
                        depthBadge = `<span class="depth-badge depth-${minDepth}">D${minDepth}</span>`;
                      } else {
                        depthInfo = `, depths ${depths.join(',')}`;
                        depthBadge = `<span class="depth-badge depth-${minDepth}">D${depths.join(',')}</span>`;
                      }
                    }

                    const badgeColor = trackingType === 'PRECISE' ? '#28a745' : '#ffc107';
                    const icon = trackingType === 'PRECISE' ? '✅' : '⚠️';

                    html += `<span class="test-badge"
                         style="background-color: ${badgeColor};"
                         title="${testName} (${trackingType}: ${executionCount} executions${depthInfo})">${icon} ${testName} ${depthBadge}</span>`;
                  }
                });
              }
            }
          } else {
            html += `
            <div id="details-${fileId}-${lineNumber}" class="coverage-details">
                <strong>Line ${lineNumber}: No valid test data available</strong>
            </div>`;
          }

          html += `
            </div>`;
        }
      });

      html += `
            </div>
        </div>
    </div>`;

      return html;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
      return `<div class="file-section">
        <div class="file-header">❌ Error reading ${path.basename(filePath)}</div>
        <div class="error">
          <p><strong>File:</strong> ${filePath}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Suggestion:</strong> Make sure the file exists and is readable.</p>
        </div>
      </div>`;
    }
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  deduplicateTests(testInfos) {
    const seen = new Set();
    return testInfos.filter(testInfo => {
      const key = typeof testInfo === 'string' ? testInfo : testInfo.name;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  groupTestInfosByFile(tests) {
    const grouped = {};
    tests.forEach(testInfo => {
      const testFile = typeof testInfo === 'string' ? 'Unknown' : testInfo.file;

      if (!grouped[testFile]) grouped[testFile] = [];
      grouped[testFile].push(testInfo);
    });
    return grouped;
  }

  getConfidenceColor(confidence) {
    if (confidence >= 80) return '#28a745'; // Green - high confidence
    if (confidence >= 60) return '#ffc107'; // Yellow - medium confidence
    if (confidence >= 40) return '#fd7e14'; // Orange - low confidence
    return '#dc3545'; // Red - very low confidence
  }

  groupTestsByFile(tests) {
    const grouped = {};
    tests.forEach(testName => {
      // Extract test file from test name based on describe block patterns
      let testFile = 'Unknown';

      if (testName.includes('Calculator')) testFile = 'calculator.test.ts';
      else if (testName.includes('Add Function Only')) testFile = 'add-only.test.ts';
      else if (testName.includes('Multiply Function Only')) testFile = 'multiply-only.test.ts';
      else if (testName.includes('Subtract Function Only')) testFile = 'subtract-only.test.ts';

      if (!grouped[testFile]) grouped[testFile] = [];
      grouped[testFile].push(testName);
    });
    return grouped;
  }

  findAlternativeFilePaths(originalPath) {
    const filename = path.basename(originalPath);
    const cwd = process.cwd();

    // Use the same smart discovery logic as testSetup.js
    return this.discoverFileInProject(cwd, filename);
  }

  discoverFileInProject(projectRoot, targetFilename) {
    const discoveredPaths = [];
    const maxDepth = 4; // Slightly deeper search for reporter

    const scanDirectory = (dir, depth = 0) => {
      if (depth > maxDepth) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isFile() && entry.name === targetFilename) {
            discoveredPaths.push(path.join(dir, entry.name));
          } else if (entry.isDirectory()) {
            const dirName = entry.name;

            // Skip common non-source directories
            if (this.shouldSkipDirectory(dirName)) continue;

            const fullDirPath = path.join(dir, dirName);
            scanDirectory(fullDirPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scanDirectory(projectRoot);

    // Sort by preference (source directories first, then by depth)
    return discoveredPaths.sort((a, b) => {
      const aScore = this.getPathScore(a);
      const bScore = this.getPathScore(b);
      return bScore - aScore; // Higher score first
    });
  }

  shouldSkipDirectory(dirName) {
    const skipPatterns = [
      'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
      'coverage', '.nyc_output', 'tmp', 'temp', '.cache',
      '.vscode', '.idea', '__pycache__', '.pytest_cache',
      'vendor', 'target', 'bin', 'obj', '.DS_Store'
    ];

    return skipPatterns.includes(dirName) || dirName.startsWith('.');
  }

  getPathScore(filePath) {
    const pathParts = filePath.split(path.sep);
    let score = 0;

    // Prefer shorter paths
    score += Math.max(0, 10 - pathParts.length);

    // Prefer common source directory names
    const sourcePreference = ['src', 'lib', 'source', 'app', 'server', 'client'];
    for (const part of pathParts) {
      const index = sourcePreference.indexOf(part);
      if (index !== -1) {
        score += sourcePreference.length - index;
      }
    }

    // Bonus for TypeScript files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      score += 2;
    }

    return score;
  }

  generateTestQualitySummary() {
    console.log('\n🧪 TEST QUALITY & PERFORMANCE ANALYSIS');
    console.log('=' .repeat(60));

    const qualityStats = {
      totalTests: 0,
      highQuality: 0,
      goodQuality: 0,
      fairQuality: 0,
      poorQuality: 0,
      totalSmells: 0,
      memoryLeaks: 0,
      gcPressure: 0,
      slowTests: 0,
      reliableTests: 0,
      totalAssertions: 0,
      totalComplexity: 0
    };

    const testSmellTypes = {};
    const performanceIssues = [];

    // Analyze all tests
    for (const filePath in this.coverageData) {
      const lineCoverage = this.coverageData[filePath];
      for (const lineNumber in lineCoverage) {
        const tests = lineCoverage[lineNumber];
        if (!Array.isArray(tests)) continue;

        tests.forEach(test => {
          if (test.type === 'precise' && test.quality) {
            qualityStats.totalTests++;

            // Quality classification
            if (test.quality.maintainability >= 80) qualityStats.highQuality++;
            else if (test.quality.maintainability >= 60) qualityStats.goodQuality++;
            else if (test.quality.maintainability >= 40) qualityStats.fairQuality++;
            else qualityStats.poorQuality++;

            // Reliability
            if (test.quality.reliability >= 80) qualityStats.reliableTests++;

            // Test smells
            if (test.quality.testSmells) {
              qualityStats.totalSmells += test.quality.testSmells.length;
              test.quality.testSmells.forEach(smell => {
                testSmellTypes[smell] = (testSmellTypes[smell] || 0) + 1;
              });
            }

            // Performance issues - check for large memory allocations
            if (test.performance) {
              // Check for memory leaks (large allocations)
              const memoryMB = Math.abs(test.performance.totalMemoryDelta || 0) / (1024 * 1024);
              if (memoryMB > 1) { // > 1MB
                qualityStats.memoryLeaks++;
                performanceIssues.push(`${test.name}: Large memory allocation (${memoryMB.toFixed(1)}MB)`);
              }

              // Check for GC pressure
              if (test.performance.gcPressure > 5) {
                qualityStats.gcPressure++;
                performanceIssues.push(`${test.name}: High GC pressure (${test.performance.gcPressure})`);
              }

              // Check for slow executions
              if (test.performance.slowExecutions > test.performance.fastExecutions) {
                qualityStats.slowTests++;
                performanceIssues.push(`${test.name}: Inconsistent performance`);
              }
            }

            qualityStats.totalAssertions += test.quality.assertions || 0;
            qualityStats.totalComplexity += test.quality.complexity || 0;
          }
        });
      }
    }

    // Display quality summary
    console.log(`\n📊 QUALITY DISTRIBUTION (${qualityStats.totalTests} tests analyzed):`);
    console.log(`  🏆 High Quality (80-100%): ${qualityStats.highQuality} tests (${((qualityStats.highQuality/qualityStats.totalTests)*100).toFixed(1)}%)`);
    console.log(`  ✅ Good Quality (60-79%):  ${qualityStats.goodQuality} tests (${((qualityStats.goodQuality/qualityStats.totalTests)*100).toFixed(1)}%)`);
    console.log(`  ⚠️ Fair Quality (40-59%):  ${qualityStats.fairQuality} tests (${((qualityStats.fairQuality/qualityStats.totalTests)*100).toFixed(1)}%)`);
    console.log(`  ❌ Poor Quality (0-39%):   ${qualityStats.poorQuality} tests (${((qualityStats.poorQuality/qualityStats.totalTests)*100).toFixed(1)}%)`);

    console.log(`\n🛡️ RELIABILITY METRICS:`);
    console.log(`  🔒 Reliable Tests: ${qualityStats.reliableTests}/${qualityStats.totalTests} (${((qualityStats.reliableTests/qualityStats.totalTests)*100).toFixed(1)}%)`);
    console.log(`  🎯 Total Assertions: ${qualityStats.totalAssertions} (avg: ${(qualityStats.totalAssertions/qualityStats.totalTests).toFixed(1)} per test)`);
    console.log(`  🔧 Total Complexity: ${qualityStats.totalComplexity} (avg: ${(qualityStats.totalComplexity/qualityStats.totalTests).toFixed(1)} per test)`);

    // Test smells breakdown
    if (qualityStats.totalSmells > 0) {
      console.log(`\n🚨 TEST SMELLS DETECTED (${qualityStats.totalSmells} total):`);
      Object.entries(testSmellTypes).forEach(([smell, count]) => {
        console.log(`  • ${smell}: ${count} occurrences`);
      });

      console.log(`\n💡 HOW TO IMPROVE TEST SCORES:`);
      if (testSmellTypes['Long Test']) {
        console.log(`  📏 Long Tests: Break down tests >50 lines into smaller, focused tests`);
      }
      if (testSmellTypes['No Assertions']) {
        console.log(`  🎯 No Assertions: Add expect() statements to verify behavior`);
      }
      if (testSmellTypes['Too Many Assertions']) {
        console.log(`  🔢 Too Many Assertions: Split tests with >10 assertions into separate test cases`);
      }
      if (testSmellTypes['Excessive Mocking']) {
        console.log(`  🎭 Excessive Mocking: Reduce mocks >5 per test, consider integration testing`);
      }
      if (testSmellTypes['Sleep/Wait Usage']) {
        console.log(`  ⏰ Sleep/Wait Usage: Replace with proper async/await or mock timers`);
      }
    }

    // Performance issues
    if (performanceIssues.length > 0) {
      console.log(`\n🔥 PERFORMANCE ISSUES DETECTED:`);
      console.log(`  🚨 Memory Leaks: ${qualityStats.memoryLeaks} tests`);
      console.log(`  🗑️ GC Pressure: ${qualityStats.gcPressure} tests`);
      console.log(`  🐌 Slow Tests: ${qualityStats.slowTests} tests`);

      console.log(`\n⚡ PERFORMANCE RECOMMENDATIONS:`);
      if (qualityStats.memoryLeaks > 0) {
        console.log(`  💾 Memory Leaks: Review large object allocations, ensure proper cleanup`);
        console.log(`     • Look for objects >1MB that aren't being released`);
        console.log(`     • Check for global variables holding references`);
        console.log(`     • Ensure event listeners are properly removed`);
      }
      if (qualityStats.gcPressure > 0) {
        console.log(`  🗑️ GC Pressure: Reduce frequent small allocations, reuse objects`);
        console.log(`     • Object pooling: Reuse objects instead of creating new ones`);
        console.log(`     • Batch operations: Process multiple items at once`);
        console.log(`     • Avoid creating objects in loops`);
        console.log(`     • Use primitive values when possible`);
      }
      if (qualityStats.slowTests > 0) {
        console.log(`  🐌 Slow Tests: Profile inconsistent tests, optimize heavy operations`);
        console.log(`     • Use async/await instead of setTimeout`);
        console.log(`     • Mock heavy operations in tests`);
        console.log(`     • Reduce test data size`);
      }
    }

    console.log('\n' + '=' .repeat(60));
  }

  generateLinesData() {
    const linesData = [];

    for (const filePath in this.coverageData) {
      const lineCoverage = this.coverageData[filePath];

      for (const lineNumber in lineCoverage) {
        const tests = lineCoverage[lineNumber];
        if (!Array.isArray(tests) || tests.length === 0) continue;

        let totalExecutions = 0;
        let maxDepth = 1;
        let minDepth = 1;
        const depths = new Set();

        let totalCpuCycles = 0;
        let totalCpuTime = 0;
        let totalWallTime = 0;
        let maxCpuCycles = 0;
        let avgQuality = 0;
        let avgReliability = 0;
        let avgMaintainability = 0;
        let totalTestSmells = 0;
        let totalAssertions = 0;
        let totalComplexity = 0;
        let totalMemoryDelta = 0;
        let memoryLeaks = 0;
        let gcPressure = 0;
        let slowExecutions = 0;
        let fastExecutions = 0;

        tests.forEach(test => {
          totalExecutions += test.executionCount || 1;
          if (test.maxDepth) maxDepth = Math.max(maxDepth, test.maxDepth);
          if (test.minDepth) minDepth = Math.min(minDepth, test.minDepth);
          if (test.depthData) {
            Object.keys(test.depthData).forEach(d => depths.add(parseInt(d)));
          }
          if (test.performance) {
            totalCpuCycles += test.performance.totalCpuCycles || 0;
            totalCpuTime += test.performance.totalCpuTime || 0;
            totalWallTime += test.performance.totalWallTime || 0;
            maxCpuCycles = Math.max(maxCpuCycles, test.performance.avgCpuCycles || 0);

            // Add memory tracking
            totalMemoryDelta += Math.abs(test.performance.totalMemoryDelta || 0);
            memoryLeaks += test.performance.memoryLeaks || 0;
            gcPressure += test.performance.gcPressure || 0;
            slowExecutions += test.performance.slowExecutions || 0;
            fastExecutions += test.performance.fastExecutions || 0;
          }
          if (test.quality) {
            avgQuality += test.quality.maintainability || 0;
            avgReliability += test.quality.reliability || 0;
            avgMaintainability += test.quality.maintainability || 0;
            totalTestSmells += test.quality.testSmells ? test.quality.testSmells.length : 0;
            totalAssertions += test.quality.assertions || 0;
            totalComplexity += test.quality.complexity || 0;
          }
        });

        // Calculate averages
        avgQuality = tests.length > 0 ? avgQuality / tests.length : 0;
        avgReliability = tests.length > 0 ? avgReliability / tests.length : 0;
        avgMaintainability = tests.length > 0 ? avgMaintainability / tests.length : 0;

        // Try to get code preview (simplified)
        let codePreview = `Line ${lineNumber}`;
        try {
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const lineIndex = parseInt(lineNumber) - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
              codePreview = lines[lineIndex].trim().substring(0, 50) + (lines[lineIndex].trim().length > 50 ? '...' : '');
            }
          }
        } catch (error) {
          // Fallback to line number only
        }

        const depthArray = Array.from(depths).sort((a, b) => a - b);
        const depthRange = depthArray.length > 1 ? `${Math.min(...depthArray)}-${Math.max(...depthArray)}` : `${depthArray[0] || 1}`;

        linesData.push({
          fileName: path.basename(filePath),
          filePath: filePath,
          lineNumber: parseInt(lineNumber),
          codePreview: codePreview,
          testCount: tests.length,
          totalExecutions: totalExecutions,
          maxDepth: maxDepth,
          minDepth: minDepth,
          depthRange: depthRange,
          performance: {
            totalCpuCycles: totalCpuCycles,
            avgCpuCycles: totalExecutions > 0 ? totalCpuCycles / totalExecutions : 0,
            totalCpuTime: totalCpuTime,
            avgCpuTime: totalExecutions > 0 ? totalCpuTime / totalExecutions : 0,
            totalWallTime: totalWallTime,
            avgWallTime: totalExecutions > 0 ? totalWallTime / totalExecutions : 0,
            maxCpuCycles: maxCpuCycles,
            totalMemoryDelta: totalMemoryDelta,
            memoryLeaks: memoryLeaks,
            gcPressure: gcPressure,
            slowExecutions: slowExecutions,
            fastExecutions: fastExecutions
          },
          quality: {
            avgQuality: avgQuality,
            avgReliability: avgReliability,
            avgMaintainability: avgMaintainability,
            totalTestSmells: totalTestSmells,
            totalAssertions: totalAssertions,
            totalComplexity: totalComplexity,
            qualityScore: (avgQuality + avgReliability + avgMaintainability) / 3
          }
        });
      }
    }

    return linesData;
  }

  generateHtmlFooter() {
    // Calculate overall stats
    const allFiles = Object.keys(this.coverageData);
    const totalLines = allFiles.reduce((sum, file) => sum + Object.keys(this.coverageData[file]).length, 0);
    const uniqueTestNames = new Set();

    allFiles.forEach(file => {
      Object.values(this.coverageData[file]).forEach(tests => {
        tests.forEach(test => {
          // Use test name to identify unique tests, not the entire test object
          uniqueTestNames.add(test.name);
        });
      });
    });

    // console.log(`🔍 DEBUG: Total unique test names found: ${uniqueTestNames.size}`);
    // console.log(`🔍 DEBUG: Test names: ${Array.from(uniqueTestNames).join(', ')}`);

    return `
        </div>

        <div id="lines-view" style="display: none;">
            <div class="lines-analysis">
                <h2>📊 Lines Analysis</h2>
                <div id="lines-table"></div>
            </div>
        </div>

        <div id="performance-view" style="display: none;">
            <div class="performance-analysis">
                <h2>🔥 Performance Analytics</h2>
                <div id="performance-dashboard"></div>
            </div>
        </div>

        <div id="quality-view" style="display: none;">
            <div class="quality-analysis">
                <h2>🧪 Test Quality Analysis</h2>
                <div id="quality-dashboard"></div>
            </div>
        </div>

        <div class="stats">
            <h3>📊 Overall Statistics</h3>
            <div class="stat-item">
                <div class="stat-number">${allFiles.length}</div>
                <span class="stat-label">Files Analyzed</span>
            </div>
            <div class="stat-item">
                <div class="stat-number">${totalLines}</div>
                <span class="stat-label">Total Lines Covered</span>
            </div>
            <div class="stat-item">
                <div class="stat-number">${uniqueTestNames.size}</div>
                <span class="stat-label">Total Unique Tests</span>
            </div>
        </div>

        <div class="footer">
            <p>Generated by Jest Test Lineage Reporter</p>
            <p>This report shows which tests cover which lines of code to help identify test redundancy and coverage gaps.</p>
        </div>

        <script>
            // Global data for lines analysis
            window.linesData = ${JSON.stringify(this.generateLinesData())};

            function showView(viewName) {
                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById('view-' + viewName).classList.add('active');

                document.getElementById('files-view').style.display = viewName === 'files' ? 'block' : 'none';
                document.getElementById('lines-view').style.display = viewName === 'lines' ? 'block' : 'none';
                document.getElementById('performance-view').style.display = viewName === 'performance' ? 'block' : 'none';
                document.getElementById('quality-view').style.display = viewName === 'quality' ? 'block' : 'none';
                document.getElementById('sort-controls').style.display = viewName === 'lines' ? 'flex' : 'none';

                if (viewName === 'lines') {
                    generateLinesTable();
                } else if (viewName === 'performance') {
                    generatePerformanceDashboard();
                } else if (viewName === 'quality') {
                    generateQualityDashboard();
                }
            }

            function toggleFile(fileId) {
                const content = document.getElementById('content-' + fileId);
                const header = content.previousElementSibling;
                const icon = header.querySelector('.expand-icon');

                if (content.classList.contains('expanded')) {
                    content.classList.remove('expanded');
                    header.classList.remove('expanded');
                    icon.textContent = '▶';
                } else {
                    content.classList.add('expanded');
                    header.classList.add('expanded');
                    icon.textContent = '▼';
                }
            }

            function expandAll() {
                document.querySelectorAll('.file-content').forEach(content => {
                    content.classList.add('expanded');
                    const header = content.previousElementSibling;
                    const icon = header.querySelector('.expand-icon');
                    header.classList.add('expanded');
                    icon.textContent = '▼';
                });
            }

            function collapseAll() {
                document.querySelectorAll('.file-content').forEach(content => {
                    content.classList.remove('expanded');
                    const header = content.previousElementSibling;
                    const icon = header.querySelector('.expand-icon');
                    header.classList.remove('expanded');
                    icon.textContent = '▶';
                });
            }

            function generateLinesTable() {
                const sortBy = document.getElementById('sort-by').value;
                const sortedLines = [...window.linesData].sort((a, b) => {
                    switch (sortBy) {
                        case 'executions':
                            return b.totalExecutions - a.totalExecutions;
                        case 'tests':
                            return b.testCount - a.testCount;
                        case 'depth':
                            return b.maxDepth - a.maxDepth;
                        case 'cpuCycles':
                            return (b.performance?.totalCpuCycles || 0) - (a.performance?.totalCpuCycles || 0);
                        case 'cpuTime':
                            return (b.performance?.totalCpuTime || 0) - (a.performance?.totalCpuTime || 0);
                        case 'wallTime':
                            return (b.performance?.totalWallTime || 0) - (a.performance?.totalWallTime || 0);
                        case 'quality':
                            return (b.quality?.qualityScore || 0) - (a.quality?.qualityScore || 0);
                        case 'reliability':
                            return (b.quality?.avgReliability || 0) - (a.quality?.avgReliability || 0);
                        case 'maintainability':
                            return (b.quality?.avgMaintainability || 0) - (a.quality?.avgMaintainability || 0);
                        case 'testSmells':
                            return (b.quality?.totalTestSmells || 0) - (a.quality?.totalTestSmells || 0);
                        case 'file':
                            return a.fileName.localeCompare(b.fileName);
                        default:
                            return 0;
                    }
                });

                let html = \`<table class="lines-table">
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Line</th>
                            <th>Code Preview</th>
                            <th>Tests</th>
                            <th>Executions</th>
                            <th>CPU Cycles</th>
                            <th>CPU Time (μs)</th>
                            <th>Wall Time (μs)</th>
                            <th>Quality Score</th>
                            <th>Reliability</th>
                            <th>Test Smells</th>
                            <th>Max Depth</th>
                            <th>Depth Range</th>
                        </tr>
                    </thead>
                    <tbody>\`;

                sortedLines.forEach(line => {
                    const depthClass = line.maxDepth <= 1 ? 'depth-1' :
                                     line.maxDepth <= 2 ? 'depth-2' :
                                     line.maxDepth <= 3 ? 'depth-3' : 'depth-4';

                    // Format performance numbers
                    const formatCycles = (cycles) => {
                        if (cycles > 1000000) return \`\${(cycles / 1000000).toFixed(1)}M\`;
                        if (cycles > 1000) return \`\${(cycles / 1000).toFixed(1)}K\`;
                        return Math.round(cycles).toString();
                    };

                    const formatTime = (microseconds) => {
                        if (microseconds > 1000) return \`\${(microseconds / 1000).toFixed(2)}ms\`;
                        return \`\${microseconds.toFixed(1)}μs\`;
                    };

                    // Format quality scores
                    const formatQuality = (score) => {
                        const rounded = Math.round(score);
                        if (rounded >= 80) return \`<span class="quality-excellent">\${rounded}%</span>\`;
                        if (rounded >= 60) return \`<span class="quality-good">\${rounded}%</span>\`;
                        if (rounded >= 40) return \`<span class="quality-fair">\${rounded}%</span>\`;
                        return \`<span class="quality-poor">\${rounded}%</span>\`;
                    };

                    const formatTestSmells = (count) => {
                        if (count === 0) return \`<span class="smells-none">0</span>\`;
                        if (count <= 2) return \`<span class="smells-few">\${count}</span>\`;
                        return \`<span class="smells-many">\${count}</span>\`;
                    };

                    html += \`<tr>
                        <td class="file-name">\${line.fileName}</td>
                        <td class="line-number">\${line.lineNumber}</td>
                        <td class="code-preview">\${line.codePreview}</td>
                        <td class="test-count">\${line.testCount}</td>
                        <td class="execution-count">\${line.totalExecutions}</td>
                        <td class="cpu-cycles">\${formatCycles(line.performance?.totalCpuCycles || 0)}</td>
                        <td class="cpu-time">\${formatTime(line.performance?.totalCpuTime || 0)}</td>
                        <td class="wall-time">\${formatTime(line.performance?.totalWallTime || 0)}</td>
                        <td class="quality-score">\${formatQuality(line.quality?.qualityScore || 0)}</td>
                        <td class="reliability-score">\${formatQuality(line.quality?.avgReliability || 0)}</td>
                        <td class="test-smells">\${formatTestSmells(line.quality?.totalTestSmells || 0)}</td>
                        <td class="max-depth"><span class="depth-badge \${depthClass}">D\${line.maxDepth}</span></td>
                        <td class="depth-range">\${line.depthRange}</td>
                    </tr>\`;
                });

                html += \`</tbody></table>\`;
                document.getElementById('lines-table').innerHTML = html;
            }

            function sortLines() {
                generateLinesTable();
            }

            function generatePerformanceDashboard() {
                const performanceData = window.linesData || [];

                // Calculate performance statistics
                let totalCpuCycles = 0;
                let totalMemoryUsage = 0;
                let memoryLeaks = 0;
                let gcPressureIssues = 0;
                let slowTests = 0;

                performanceData.forEach(line => {
                    if (line.performance) {
                        totalCpuCycles += line.performance.totalCpuCycles || 0;
                        totalMemoryUsage += Math.abs(line.performance.totalMemoryDelta || 0);
                        memoryLeaks += line.performance.memoryLeaks || 0;
                        gcPressureIssues += line.performance.gcPressure || 0;
                        if ((line.performance.slowExecutions || 0) > (line.performance.fastExecutions || 0)) {
                            slowTests++;
                        }
                    }
                });

                // Sort by performance metrics
                const topCpuLines = [...performanceData]
                    .filter(line => line.performance && line.performance.totalCpuCycles > 0)
                    .sort((a, b) => (b.performance.totalCpuCycles || 0) - (a.performance.totalCpuCycles || 0))
                    .slice(0, 10);

                const topMemoryLines = [...performanceData]
                    .filter(line => line.performance && Math.abs(line.performance.totalMemoryDelta || 0) > 0)
                    .sort((a, b) => Math.abs(b.performance.totalMemoryDelta || 0) - Math.abs(a.performance.totalMemoryDelta || 0))
                    .slice(0, 10);

                // Debug logging
                console.log('Performance Dashboard Data:', {
                    totalLines: performanceData.length,
                    totalCpuCycles,
                    totalMemoryUsage,
                    memoryLeaks,
                    gcPressureIssues,
                    slowTests,
                    sampleLine: performanceData[0]
                });

                let html = \`
                    <div class="performance-summary">
                        <h3>🔥 Performance Overview</h3>
                        <div class="performance-help">
                            <h4>📚 Understanding Performance Metrics:</h4>
                            <div class="help-section">
                                <strong>🚨 Memory Leaks:</strong> Large allocations (>50KB) that may not be properly cleaned up.
                                <br><em>Action:</em> Review object lifecycle, ensure proper cleanup, avoid global references.
                            </div>
                            <div class="help-section">
                                <strong>🗑️ GC Pressure:</strong> Frequent small allocations that stress the garbage collector.
                                <br><em>Action:</em> Use object pooling, batch operations, avoid creating objects in loops.
                            </div>
                            <div class="help-section">
                                <strong>🐌 Slow Tests:</strong> Tests with inconsistent performance or high variance.
                                <br><em>Action:</em> Use async/await, mock heavy operations, reduce test data size.
                            </div>
                        </div>
                        <div class="perf-stats">
                            <div class="perf-stat">
                                <div class="perf-number">\${(totalCpuCycles / 1000000).toFixed(1)}M</div>
                                <div class="perf-label">Total CPU Cycles</div>
                            </div>
                            <div class="perf-stat">
                                <div class="perf-number">\${(totalMemoryUsage / (1024 * 1024)).toFixed(1)}MB</div>
                                <div class="perf-label">Memory Usage</div>
                            </div>
                            <div class="perf-stat">
                                <div class="perf-number">\${memoryLeaks}</div>
                                <div class="perf-label">Memory Leaks</div>
                            </div>
                            <div class="perf-stat">
                                <div class="perf-number">\${gcPressureIssues}</div>
                                <div class="perf-label">GC Pressure</div>
                            </div>
                            <div class="perf-stat">
                                <div class="perf-number">\${slowTests}</div>
                                <div class="perf-label">Slow Tests</div>
                            </div>
                        </div>
                    </div>

                    <div class="performance-tables">
                        <div class="perf-table-container">
                            <h4>🔥 Top CPU Intensive Lines</h4>
                            <table class="perf-table">
                                <thead>
                                    <tr><th>File</th><th>Line</th><th>CPU Cycles</th><th>Executions</th></tr>
                                </thead>
                                <tbody>
                \`;

                topCpuLines.forEach(line => {
                    const cycles = line.performance.totalCpuCycles > 1000000 ?
                        \`\${(line.performance.totalCpuCycles / 1000000).toFixed(1)}M\` :
                        \`\${Math.round(line.performance.totalCpuCycles)}\`;
                    html += \`<tr>
                        <td>\${line.fileName}</td>
                        <td>\${line.lineNumber}</td>
                        <td class="cpu-cycles">\${cycles}</td>
                        <td>\${line.totalExecutions}</td>
                    </tr>\`;
                });

                html += \`
                                </tbody>
                            </table>
                        </div>

                        <div class="perf-table-container">
                            <h4>💾 Top Memory Usage Lines</h4>
                            <table class="perf-table">
                                <thead>
                                    <tr><th>File</th><th>Line</th><th>Memory Usage</th><th>Leaks</th></tr>
                                </thead>
                                <tbody>
                \`;

                topMemoryLines.forEach(line => {
                    const memory = Math.abs(line.performance.totalMemoryDelta || 0);
                    const memoryStr = memory > 1024 * 1024 ?
                        \`\${(memory / (1024 * 1024)).toFixed(1)}MB\` :
                        \`\${(memory / 1024).toFixed(1)}KB\`;
                    html += \`<tr>
                        <td>\${line.fileName}</td>
                        <td>\${line.lineNumber}</td>
                        <td class="memory-usage">\${memoryStr}</td>
                        <td class="memory-leaks">\${line.performance.memoryLeaks || 0}</td>
                    </tr>\`;
                });

                html += \`
                                </tbody>
                            </table>
                        </div>
                    </div>
                \`;

                document.getElementById('performance-dashboard').innerHTML = html;
            }

            function generateQualityDashboard() {
                const qualityData = window.linesData;

                // Calculate quality statistics
                let totalTests = 0;
                let highQuality = 0;
                let goodQuality = 0;
                let fairQuality = 0;
                let poorQuality = 0;
                let totalSmells = 0;
                let totalAssertions = 0;

                const smellTypes = {};

                qualityData.forEach(line => {
                    if (line.quality) {
                        totalTests += line.testCount;
                        totalAssertions += line.quality.totalAssertions;
                        totalSmells += line.quality.totalTestSmells;

                        const avgQuality = line.quality.qualityScore;
                        if (avgQuality >= 80) highQuality++;
                        else if (avgQuality >= 60) goodQuality++;
                        else if (avgQuality >= 40) fairQuality++;
                        else poorQuality++;
                    }
                });

                // Sort by quality metrics
                const topQualityLines = [...qualityData].sort((a, b) => b.quality.qualityScore - a.quality.qualityScore).slice(0, 10);
                const worstQualityLines = [...qualityData].sort((a, b) => a.quality.qualityScore - b.quality.qualityScore).slice(0, 10);

                let html = \`
                    <div class="quality-summary">
                        <h3>🧪 Test Quality Overview</h3>
                        <div class="quality-stats">
                            <div class="quality-stat">
                                <div class="quality-number">\${totalTests}</div>
                                <div class="quality-label">Total Tests</div>
                            </div>
                            <div class="quality-stat">
                                <div class="quality-number">\${totalAssertions}</div>
                                <div class="quality-label">Total Assertions</div>
                            </div>
                            <div class="quality-stat">
                                <div class="quality-number">\${totalSmells}</div>
                                <div class="quality-label">Test Smells</div>
                            </div>
                            <div class="quality-stat">
                                <div class="quality-number">\${(totalAssertions/totalTests).toFixed(1)}</div>
                                <div class="quality-label">Avg Assertions/Test</div>
                            </div>
                        </div>

                        <div class="quality-distribution">
                            <h4>Quality Distribution</h4>
                            <div class="quality-bars">
                                <div class="quality-bar">
                                    <span class="quality-excellent">🏆 High Quality: \${highQuality} lines</span>
                                    <div class="bar"><div class="fill excellent" style="width: \${(highQuality/qualityData.length)*100}%"></div></div>
                                </div>
                                <div class="quality-bar">
                                    <span class="quality-good">✅ Good Quality: \${goodQuality} lines</span>
                                    <div class="bar"><div class="fill good" style="width: \${(goodQuality/qualityData.length)*100}%"></div></div>
                                </div>
                                <div class="quality-bar">
                                    <span class="quality-fair">⚠️ Fair Quality: \${fairQuality} lines</span>
                                    <div class="bar"><div class="fill fair" style="width: \${(fairQuality/qualityData.length)*100}%"></div></div>
                                </div>
                                <div class="quality-bar">
                                    <span class="quality-poor">❌ Poor Quality: \${poorQuality} lines</span>
                                    <div class="bar"><div class="fill poor" style="width: \${(poorQuality/qualityData.length)*100}%"></div></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="quality-tables">
                        <div class="quality-table-container">
                            <h4>🏆 Highest Quality Tests</h4>
                            <table class="quality-table">
                                <thead>
                                    <tr><th>File</th><th>Line</th><th>Quality Score</th><th>Reliability</th><th>Test Smells</th></tr>
                                </thead>
                                <tbody>
                \`;

                topQualityLines.forEach(line => {
                    const qualityClass = line.quality.qualityScore >= 80 ? 'quality-excellent' :
                                       line.quality.qualityScore >= 60 ? 'quality-good' :
                                       line.quality.qualityScore >= 40 ? 'quality-fair' : 'quality-poor';
                    html += \`<tr>
                        <td>\${line.fileName}</td>
                        <td>\${line.lineNumber}</td>
                        <td class="\${qualityClass}">\${Math.round(line.quality.qualityScore)}%</td>
                        <td class="\${qualityClass}">\${Math.round(line.quality.avgReliability)}%</td>
                        <td class="smells-\${line.quality.totalTestSmells === 0 ? 'none' : line.quality.totalTestSmells <= 2 ? 'few' : 'many'}">\${line.quality.totalTestSmells}</td>
                    </tr>\`;
                });

                html += \`
                                </tbody>
                            </table>
                        </div>

                        <div class="quality-table-container">
                            <h4>🚨 Tests Needing Improvement</h4>
                            <table class="quality-table">
                                <thead>
                                    <tr><th>File</th><th>Line</th><th>Quality Score</th><th>Issues</th><th>Recommendations</th></tr>
                                </thead>
                                <tbody>
                \`;

                worstQualityLines.forEach(line => {
                    const qualityClass = line.quality.qualityScore >= 80 ? 'quality-excellent' :
                                       line.quality.qualityScore >= 60 ? 'quality-good' :
                                       line.quality.qualityScore >= 40 ? 'quality-fair' : 'quality-poor';

                    let recommendations = [];
                    if (line.quality.totalTestSmells > 0) recommendations.push('Fix test smells');
                    if (line.quality.totalAssertions < 3) recommendations.push('Add more assertions');
                    if (line.quality.avgReliability < 60) recommendations.push('Improve error handling');

                    html += \`<tr>
                        <td>\${line.fileName}</td>
                        <td>\${line.lineNumber}</td>
                        <td class="\${qualityClass}">\${Math.round(line.quality.qualityScore)}%</td>
                        <td class="quality-issues">\${line.quality.totalTestSmells} smells, \${line.quality.totalAssertions} assertions</td>
                        <td class="recommendations">\${recommendations.join(', ') || 'Good as is'}</td>
                    </tr>\`;
                });

                html += \`
                                </tbody>
                            </table>
                        </div>
                    </div>
                \`;

                document.getElementById('quality-dashboard').innerHTML = html;
            }
        </script>
    </body>
    </html>`;
  }
}

module.exports = TestCoverageReporter;
