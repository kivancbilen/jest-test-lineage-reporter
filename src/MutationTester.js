/**
 * Mutation Testing Orchestrator
 * Uses lineage tracking data to run targeted mutation tests
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { detectRunner, buildRunCommand } = require("./testRunners");
const { createMutationPlugin } = require("./babel-plugin-mutation-tester");
const logger = require("./logger");
const lineageStore = require("./lineageStore");

class MutationTester {
  constructor(config = {}) {
    this.config = config;
    this.lineageData = null;
    this.mutationResults = new Map();
    this.tempFiles = new Set();
    this.debugMutationFiles = new Set(); // Track debug mutation files
    this.originalFileContents = new Map(); // Store original file contents for restoration

    // Create debug directory if debug mode is enabled
    if (this.config.debugMutations) {
      this.setupDebugDirectory();
    }

    // Set up cleanup handlers for process interruption
    this.setupCleanupHandlers();
  }

  /**
   * Setup debug directory for mutation files
   */
  setupDebugDirectory() {
    const debugDir = this.config.debugMutationDir || "./mutations-debug";
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
      logger.debug(`📁 Created debug mutation directory: ${debugDir}`);
    } else {
      // Clean existing debug files
      const files = fs.readdirSync(debugDir);
      files.forEach((file) => {
        if (file.endsWith(".mutation.js") || file.endsWith(".mutation.ts")) {
          fs.unlinkSync(path.join(debugDir, file));
        }
      });
      logger.debug(`🧹 Cleaned existing debug mutation files in: ${debugDir}`);
    }
  }

  /**
   * Setup cleanup handlers for process interruption
   */
  setupCleanupHandlers() {
    // Handle process interruption (Ctrl+C)
    process.on("SIGINT", () => {
      logger.info("\n🛑 Mutation testing interrupted. Cleaning up...");
      this.emergencyCleanup();
      process.exit(1);
    });

    // Handle process termination
    process.on("SIGTERM", () => {
      logger.info("\n🛑 Mutation testing terminated. Cleaning up...");
      this.emergencyCleanup();
      process.exit(1);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error(
        "\n❌ Uncaught exception during mutation testing:",
        error.message,
      );
      this.emergencyCleanup();
      process.exit(1);
    });
  }

  /**
   * Load lineage tracking data from the previous test run
   */
  async loadLineageData() {
    try {
      const lineageFile = path.join(process.cwd(), ".jest-lineage-data.json");
      // Pick up any shards left behind by a run whose reporter did not finish.
      lineageStore.mergeShardsIfNewer(lineageFile);
      if (fs.existsSync(lineageFile)) {
        const data = JSON.parse(fs.readFileSync(lineageFile, "utf8"));
        this.lineageData = this.processLineageData(data);
        logger.info(
          `📊 Loaded lineage data for ${
            Object.keys(this.lineageData).length
          } files`,
        );
        return true;
      }
    } catch (error) {
      logger.error("❌ Failed to load lineage data:", error.message);
    }
    return false;
  }

  /**
   * Set lineage data directly (used when data is passed from TestCoverageReporter)
   */
  setLineageData(lineageData) {
    this.lineageData = lineageData;
    logger.info(
      `📊 Set lineage data for ${Object.keys(this.lineageData).length} files`,
    );
    return true;
  }

  /**
   * Process raw lineage data into a more usable format
   */
  processLineageData(rawData) {
    const processed = {};

    if (rawData.tests) {
      logger.debug(
        `🔍 Processing ${rawData.tests.length} tests for mutation testing...`,
      );

      rawData.tests.forEach((test, testIndex) => {
        if (test.coverage) {
          const coverageKeys = Object.keys(test.coverage);
          logger.debug(
            `  Test ${testIndex + 1}: "${test.name}" has ${
              coverageKeys.length
            } coverage entries`,
          );

          coverageKeys.forEach((lineKey) => {
            // Parse line key: "file.ts:lineNumber"
            const [filePath, lineNumber, ...suffixes] = lineKey.split(":");

            // Skip metadata entries (depth, performance, meta) - only process basic line coverage
            if (!lineNumber || suffixes.length > 0) {
              return;
            }

            logger.debug(
              `    Processing coverage: ${lineKey} = ${test.coverage[lineKey]}`,
            );

            if (!processed[filePath]) {
              processed[filePath] = {};
            }

            if (!processed[filePath][lineNumber]) {
              processed[filePath][lineNumber] = [];
            }

            processed[filePath][lineNumber].push({
              testName: test.name,
              testType: test.type,
              testFile: test.testFile,
              executionCount: test.coverage[lineKey],
            });
          });
        } else {
          logger.debug(
            `  Test ${testIndex + 1}: "${test.name}" has no coverage data`,
          );
        }
      });
    }

    logger.info(
      `🎯 Processed lineage data for ${Object.keys(processed).length} files:`,
    );
    Object.keys(processed).forEach((filePath) => {
      const lineCount = Object.keys(processed[filePath]).length;
      logger.debug(`  ${filePath}: ${lineCount} lines`);
    });

    return processed;
  }

  /**
   * Run mutation testing for all covered lines
   */
  async runMutationTesting() {
    if (!this.lineageData) {
      logger.error("❌ No lineage data available. Run normal tests first.");
      return false;
    }

    logger.info("🧬 Starting mutation testing...");

    // Calculate total mutations for progress tracking
    const totalFiles = Object.keys(this.lineageData).length;
    let totalMutationsCount = 0;
    for (const [filePath, lines] of Object.entries(this.lineageData)) {
      for (const [lineNumber, tests] of Object.entries(lines)) {
        const sourceCode = this.getSourceCodeLine(
          filePath,
          parseInt(lineNumber),
        );
        const mutationTypes = this.getPossibleMutationTypes(
          sourceCode,
          filePath,
          parseInt(lineNumber),
        );
        totalMutationsCount += mutationTypes.length;
      }
    }

    logger.info(
      `📊 Planning to test ${totalMutationsCount} mutations across ${totalFiles} files`,
    );

    // Check if Docker mode is enabled
    if (this.config.enableDocker) {
      return await this.runDockerMutationTesting();
    }

    const results = {
      totalMutations: 0,
      killedMutations: 0,
      survivedMutations: 0,
      timeoutMutations: 0,
      errorMutations: 0,
      mutationScore: 0,
      fileResults: {},
    };

    // Determine worker count
    const workers = this.config.workers || 1;
    const shouldParallelize = workers > 1 || workers === 0;

    if (shouldParallelize) {
      // Parallel execution - process multiple files concurrently
      const os = require("os");
      const actualWorkers =
        workers === 0 ? Math.max(1, os.cpus().length - 1) : workers;
      logger.info(
        `\n⚡ Running mutations in parallel with ${actualWorkers} workers\n`,
      );

      const fileEntries = Object.entries(this.lineageData);
      const filePromises = fileEntries.map(async ([filePath, lines], index) => {
        const workerId = (index % actualWorkers) + 1;
        logger.info(
          `\n🔬 [Worker ${workerId}] Testing mutations in ${filePath} (${index + 1}/${totalFiles})...`,
        );

        const fileResults = await this.testFileLines(
          filePath,
          lines,
          0, // Start from 0 for each file in parallel mode
          totalMutationsCount,
          workerId,
        );

        // Log file completion summary
        const fileName = filePath.split("/").pop();
        const fileScore =
          fileResults.totalMutations > 0
            ? Math.round(
                (fileResults.killedMutations / fileResults.totalMutations) *
                  100,
              )
            : 0;
        logger.info(
          `✅ [Worker ${(index % actualWorkers) + 1}] ${fileName}: ${fileResults.totalMutations} mutations, ${fileResults.killedMutations} killed, ${fileResults.survivedMutations} survived (${fileScore}% score)`,
        );

        return { filePath, fileResults };
      });

      // Process files with concurrency limit
      const chunkSize = actualWorkers;
      for (let i = 0; i < filePromises.length; i += chunkSize) {
        const chunk = filePromises.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk);

        // Aggregate results
        for (const { filePath, fileResults } of chunkResults) {
          results.fileResults[filePath] = fileResults;
          results.totalMutations += fileResults.totalMutations;
          results.killedMutations += fileResults.killedMutations;
          results.survivedMutations += fileResults.survivedMutations;
          results.timeoutMutations += fileResults.timeoutMutations;
          results.errorMutations += fileResults.errorMutations;
        }
      }
    } else {
      // Serial execution - process one file at a time
      let currentFileIndex = 0;
      let currentMutationIndex = 0;

      for (const [filePath, lines] of Object.entries(this.lineageData)) {
        currentFileIndex++;
        logger.info(
          `\n🔬 Testing mutations in ${filePath} (${currentFileIndex}/${totalFiles})...`,
        );

        const fileResults = await this.testFileLines(
          filePath,
          lines,
          currentMutationIndex,
          totalMutationsCount,
        );
        results.fileResults[filePath] = fileResults;

        results.totalMutations += fileResults.totalMutations;
        results.killedMutations += fileResults.killedMutations;
        results.survivedMutations += fileResults.survivedMutations;
        results.timeoutMutations += fileResults.timeoutMutations;
        results.errorMutations += fileResults.errorMutations;

        currentMutationIndex += fileResults.totalMutations;

        // Log file completion summary
        const fileName = filePath.split("/").pop();
        const fileScore =
          fileResults.totalMutations > 0
            ? Math.round(
                (fileResults.killedMutations / fileResults.totalMutations) *
                  100,
              )
            : 0;
        logger.info(
          `✅ ${fileName}: ${fileResults.totalMutations} mutations, ${fileResults.killedMutations} killed, ${fileResults.survivedMutations} survived (${fileScore}% score)`,
        );
      }
    }

    // Calculate mutation score
    const validMutations = results.totalMutations - results.errorMutations;
    results.mutationScore =
      validMutations > 0
        ? Math.round((results.killedMutations / validMutations) * 100)
        : 0;

    this.printMutationSummary(results);
    return results;
  }

  /**
   * Run mutation testing using Docker containers
   */
  async runDockerMutationTesting() {
    logger.info("🐳 Running mutation testing in Docker mode...");

    try {
      const DockerCoordinator = require("./docker/DockerCoordinator");
      const path = require("path");

      // Prepare mutations list
      const mutations = [];
      let mutationIndex = 0;
      const projectPath = process.cwd();

      // Convert lineageData to use relative paths for Docker
      const relativeLineageData = {};

      for (const [filePath, lines] of Object.entries(this.lineageData)) {
        // Convert absolute path to relative path for Docker
        const relativePath = path.relative(projectPath, filePath);
        relativeLineageData[relativePath] = {};

        for (const [lineNumber, tests] of Object.entries(lines)) {
          // Convert test file paths to relative as well
          const relativeTests = tests.map((test) => ({
            ...test,
            testFile: path.relative(projectPath, test.testFile),
          }));

          relativeLineageData[relativePath][lineNumber] = relativeTests;

          const sourceCode = this.getSourceCodeLine(
            filePath,
            parseInt(lineNumber),
          );
          const mutationTypes = this.getPossibleMutationTypes(
            sourceCode,
            filePath,
            parseInt(lineNumber),
          );

          // Add each mutation type to the list
          mutationTypes.forEach((mutationType) => {
            mutationIndex++;
            mutations.push({
              filePath: relativePath, // Use relative path for Docker
              lineNumber: parseInt(lineNumber),
              mutationType,
              tests: relativeTests,
              index: mutationIndex,
            });
          });
        }
      }

      // Create Docker coordinator
      const coordinator = new DockerCoordinator({
        ...this.config,
        projectPath,
      });

      // Run mutations in Docker containers with relative paths
      const results = await coordinator.runMutationTesting(
        relativeLineageData,
        mutations,
      );

      this.printMutationSummary(results);
      return results;
    } catch (error) {
      logger.error("❌ Docker mutation testing failed:", error.message);
      throw error;
    }
  }

  /**
   * Test mutations for all lines in a specific file
   */
  async testFileLines(
    filePath,
    lines,
    startMutationIndex,
    totalMutations,
    workerId = null,
  ) {
    const fileResults = {
      totalMutations: 0,
      killedMutations: 0,
      survivedMutations: 0,
      timeoutMutations: 0,
      errorMutations: 0,
      lineResults: {},
      mutations: [], // Collect all mutations for this file
    };

    let currentMutationIndex = startMutationIndex;

    for (const [lineNumber, tests] of Object.entries(lines)) {
      const lineResults = await this.testLineMutations(
        filePath,
        parseInt(lineNumber),
        tests,
        currentMutationIndex,
        totalMutations,
        workerId,
      );
      fileResults.lineResults[lineNumber] = lineResults;

      fileResults.totalMutations += lineResults.totalMutations;
      fileResults.killedMutations += lineResults.killedMutations;
      fileResults.survivedMutations += lineResults.survivedMutations;
      fileResults.timeoutMutations += lineResults.timeoutMutations;
      fileResults.errorMutations += lineResults.errorMutations;

      // Add all mutations from this line to the file's mutations array
      fileResults.mutations.push(...lineResults.mutations);

      currentMutationIndex += lineResults.totalMutations;
    }

    return fileResults;
  }

  /**
   * Test mutations for a specific line
   */
  async testLineMutations(
    filePath,
    lineNumber,
    tests,
    startMutationIndex,
    totalMutations,
    workerId = null,
  ) {
    const lineResults = {
      totalMutations: 0,
      killedMutations: 0,
      survivedMutations: 0,
      timeoutMutations: 0,
      errorMutations: 0,
      mutations: [],
    };

    // Get the source code line to determine possible mutations
    const sourceCode = this.getSourceCodeLine(filePath, lineNumber);
    const mutationTypes = this.getPossibleMutationTypes(
      sourceCode,
      filePath,
      lineNumber,
    );

    let currentMutationIndex = startMutationIndex;

    for (const mutationType of mutationTypes) {
      currentMutationIndex++;

      const mutationResult = await this.testSingleMutation(
        filePath,
        lineNumber,
        mutationType,
        tests,
        currentMutationIndex,
        totalMutations,
        workerId,
      );

      // Skip mutations that couldn't be applied (null result)
      if (mutationResult === null) {
        currentMutationIndex--; // Don't count skipped mutations
        continue;
      }

      lineResults.mutations.push(mutationResult);
      lineResults.totalMutations++;

      switch (mutationResult.status) {
        case "killed":
          lineResults.killedMutations++;
          break;
        case "survived":
          lineResults.survivedMutations++;
          break;
        case "timeout":
          lineResults.timeoutMutations++;
          break;
        case "error":
          lineResults.errorMutations++;
          break;
        case "debug":
          // Debug mutations don't count towards kill/survive stats
          break;
      }
    }

    return lineResults;
  }

  /**
   * Test a single mutation
   */
  async testSingleMutation(
    filePath,
    lineNumber,
    mutationType,
    tests,
    currentMutationIndex,
    totalMutations,
    workerId = null,
  ) {
    const mutationId = `${filePath}:${lineNumber}:${mutationType}`;

    // Log progress with counter and percentage
    const fileName = filePath.split("/").pop();
    const percentage =
      totalMutations > 0
        ? Math.round((currentMutationIndex / totalMutations) * 100)
        : 0;
    const workerPrefix = workerId ? `[Worker ${workerId}] ` : "";
    logger.info(
      `${workerPrefix}🔧 Instrumenting: ${filePath} (${currentMutationIndex}/${totalMutations} - ${percentage}%) [${fileName}:${lineNumber} ${mutationType}]`,
    );

    try {
      // Create mutated version of the file
      const mutatedFilePath = await this.createMutatedFile(
        filePath,
        lineNumber,
        mutationType,
      );

      // Check if the mutation actually changed the code
      const originalCodeLine = this.getSourceCodeLine(filePath, lineNumber);
      const mutatedFileContent = fs.readFileSync(filePath, "utf8");
      const mutatedLines = mutatedFileContent.split("\n");
      const mutatedCodeLine = mutatedLines[lineNumber - 1] || "";

      if (originalCodeLine.trim() === mutatedCodeLine.trim()) {
        // Mutation couldn't be applied - this should have been caught during validation
        // Silently skip this mutation and restore the file
        this.restoreFile(filePath);
        return null; // Return null to indicate this mutation should be skipped
      }

      let testResult;
      let status;
      let testFiles = [];

      if (this.config.debugMutations) {
        // Debug mode: Don't run tests, just create mutation files for inspection
        testResult = {
          success: null,
          executionTime: 0,
          output: "Debug mode: mutation file created for manual inspection",
          error: null,
        };
        status = "debug";
        const testInfo = tests.map((test) =>
          this.getTestFileFromTestName(test.testName),
        );
        testFiles = testInfo.map((info) => info.testFile);
        logger.debug(`🔍 Debug mutation created: ${mutatedFilePath}`);
        // In debug mode, files are preserved, so no cleanup needed
      } else {
        // Normal mode: Run tests and check if mutation is killed
        const testInfo = tests.map((test) =>
          this.getTestFileFromTestName(test.testName),
        );

        // Extract unique test files and collect test names
        const uniqueTestFiles = [
          ...new Set(testInfo.map((info) => info.testFile)),
        ];
        testFiles = uniqueTestFiles;
        const testNames = testInfo.map((info) => info.testName);

        try {
          testResult = await this.runTargetedTests(uniqueTestFiles, testNames);
          status = testResult.success ? "survived" : "killed";
        } catch (testError) {
          logger.error(
            `❌ Error running tests for mutation ${mutationId}:`,
            testError.message,
          );
          testResult = {
            success: false,
            executionTime: 0,
            output: "",
            error: testError.message,
            jestArgs: testError.jestArgs || [],
          };
          status = "error";
        } finally {
          // Always clean up, even if tests failed
          await this.cleanupMutatedFile(mutatedFilePath);
        }
      }

      // Debug logging for troubleshooting - ALWAYS show for now to debug the issue
      logger.debug(`🔍 Debug: ${mutationId}`);
      logger.debug(`  Test success: ${testResult.success}`);
      logger.debug(`  Status: ${status}`);
      logger.debug(`  Error: ${testResult.error || "none"}`);
      if (testResult.output && testResult.output.length > 0) {
        logger.debug(`  Output snippet: ${testResult.output}...`);
      }
      if (testResult.jestArgs) {
        logger.debug(`  Jest args: ${testResult.jestArgs.join(" ")}`);
      }

      // Get original and mutated code for display
      const originalCode = this.getSourceCodeLine(filePath, lineNumber);
      const mutatedCode = this.getMutatedCodePreview(
        originalCode,
        mutationType,
      );

      // Use the preview for display, but don't treat preview mismatches as errors.
      // The real mutation validation already happened at lines 571-582 above
      // (comparing the actual file before/after Babel transformation).
      const displayReplacement =
        originalCode.trim() !== mutatedCode.trim()
          ? mutatedCode.trim()
          : `[${mutationType} mutation applied]`;

      // Determine which tests killed this mutation (if any)
      const killedBy =
        status === "killed" ? this.getKillingTests(testResult, tests) : [];

      return {
        id: mutationId,
        filePath,
        line: lineNumber,
        lineNumber,
        mutationType,
        mutatorName: mutationType,
        type: mutationType,
        status,
        original: originalCode.trim(),
        replacement: displayReplacement,
        testsRun: testFiles.length,
        killedBy,
        executionTime: testResult.executionTime,
        error: testResult.error,
      };
    } catch (error) {
      logger.error(`❌ Error during mutation ${mutationId}:`, error.message);
      if (this.config.enableDebugLogging) {
        logger.error(`Full error stack:`, error.stack);
      }

      // Ensure file is restored even if an error occurs
      try {
        this.restoreFile(filePath);
      } catch (restoreError) {
        logger.error(
          `❌ Failed to restore file after error:`,
          restoreError.message,
        );
      }

      return {
        id: mutationId,
        filePath,
        lineNumber,
        mutationType,
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Create a mutated version of a file using Babel transformer
   */
  async createMutatedFile(filePath, lineNumber, mutationType) {
    const fs = require("fs");

    // Read original file
    const originalCode = fs.readFileSync(filePath, "utf8");

    // Store original content for emergency restoration
    if (!this.originalFileContents.has(filePath)) {
      this.originalFileContents.set(filePath, originalCode);
    }

    // Use Babel transformer for AST-based mutations
    const mutatedCode = this.applyMutationWithBabel(
      originalCode,
      lineNumber,
      mutationType,
      filePath,
    );

    if (!mutatedCode) {
      throw new Error(
        `Failed to apply mutation ${mutationType} at line ${lineNumber} in ${filePath}`,
      );
    }

    if (this.config.debugMutations) {
      // Debug mode: Create separate mutation files instead of overwriting originals
      return this.createDebugMutationFile(
        filePath,
        lineNumber,
        mutationType,
        mutatedCode,
      );
    } else {
      // Normal mode: Temporarily replace original file
      const backupPath = `${filePath}.backup`;
      fs.writeFileSync(backupPath, originalCode);
      fs.writeFileSync(filePath, mutatedCode);

      this.tempFiles.add(filePath);
      return filePath;
    }
  }

  /**
   * Create a debug mutation file (separate from original)
   */
  createDebugMutationFile(
    originalFilePath,
    lineNumber,
    mutationType,
    mutatedCode,
  ) {
    const debugDir = this.config.debugMutationDir || "./mutations-debug";
    const fileName = path.basename(originalFilePath);
    const fileExt = path.extname(fileName);
    const baseName = path.basename(fileName, fileExt);

    // Create a unique filename for this mutation
    const mutationFileName = `${baseName}_L${lineNumber}_${mutationType}.mutation${fileExt}`;
    const mutationFilePath = path.join(debugDir, mutationFileName);

    // Write the mutated code to the debug file
    fs.writeFileSync(mutationFilePath, mutatedCode);

    // Also create a metadata file with mutation details
    const metadataFileName = `${baseName}_L${lineNumber}_${mutationType}.metadata.json`;
    const metadataFilePath = path.join(debugDir, metadataFileName);
    const metadata = {
      originalFile: originalFilePath,
      lineNumber: lineNumber,
      mutationType: mutationType,
      mutationFile: mutationFilePath,
      timestamp: new Date().toISOString(),
      originalLine: this.getSourceCodeLine(originalFilePath, lineNumber),
    };
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));

    this.debugMutationFiles.add(mutationFilePath);
    this.debugMutationFiles.add(metadataFilePath);

    logger.debug(`📝 Created debug mutation file: ${mutationFileName}`);
    return mutationFilePath;
  }

  /**
   * Apply mutation using Babel transformer (AST-based approach)
   */
  applyMutationWithBabel(code, lineNumber, mutationType, filePath) {
    const babel = require("@babel/core");

    try {
      // Create mutation plugin with specific line and mutation type
      const mutationPlugin = createMutationPlugin(lineNumber, mutationType);

      // Transform code using Babel with ONLY the mutation plugin
      // Do NOT include lineage tracking or other plugins during mutation testing
      const result = babel.transformSync(code, {
        plugins: [mutationPlugin],
        filename: filePath,
        parserOpts: {
          sourceType: "module",
          allowImportExportEverywhere: true,
          plugins: ["typescript", "jsx"],
        },
        // Explicitly disable all other transformations
        presets: [],
        // Ensure no other plugins are loaded from babel.config.js
        babelrc: false,
        configFile: false,
      });

      return result?.code || null;
    } catch (error) {
      logger.error(
        `Babel transformation error for ${filePath}:${lineNumber}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Run targeted tests for specific test files and test names
   */
  async runTargetedTests(testFiles, testNames = null) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // In Docker mode, PROJECT_PATH env var points to the mounted project directory
      const cwd = process.env.PROJECT_PATH || process.cwd();

      const runner = detectRunner(cwd, this.config.testRunner);
      const {
        command: jestCommand,
        args: jestArgs,
      } = buildRunCommand(runner, cwd, {
        testFiles,
        testNames,
        configPath: this.config.runnerConfig,
      });
      const jestCmdArgs = jestArgs;

      // In Docker mode, override setupFilesAfterEnv with absolute path to fix module resolution
      if (runner === "jest" && process.env.PROJECT_PATH) {
        jestArgs.push(
          "--setupFilesAfterEnv=/jest-lineage-reporter/src/testSetup.js",
        );
      }

      if (testNames && testNames.length > 0) {
        logger.debug(`🎯 Running specific tests: ${testNames.join(", ")}`);
      } else {
        logger.debug(`📁 Running all tests in files: ${testFiles.join(", ")}`);
      }

      // Debug: Log the exact command being executed
      logger.debug(`🔍 Spawning (${runner}): ${jestCommand} ${jestCmdArgs.join(" ")}`);
      logger.debug(`🔍 Working directory: ${cwd}`);

      const jest = spawn(jestCommand, jestCmdArgs, {
        stdio: "pipe",
        timeout: this.config.mutationTimeout || 5000,
        cwd, // Run Jest from the project directory
        env: {
          ...process.env,
          NODE_ENV: "test",
          NODE_PATH: `${cwd}/node_modules`, // Ensure modules resolve from project directory
          JEST_LINEAGE_MUTATION: "false", // Disable mutation testing mode to allow normal test execution
          JEST_LINEAGE_MUTATION_TESTING: "false", // Disable mutation testing during mutation testing
          JEST_LINEAGE_ENABLED: "false", // Disable all lineage tracking
          JEST_LINEAGE_TRACKING: "false", // Disable lineage tracking
          JEST_LINEAGE_PERFORMANCE: "false", // Disable performance tracking
          JEST_LINEAGE_QUALITY: "false", // Disable quality tracking
          JEST_LINEAGE_MERGE: "false", // Ensure no merging with existing data
          TS_NODE_TRANSPILE_ONLY: "true", // Disable TypeScript type checking
          TS_NODE_TYPE_CHECK: "false", // Disable TypeScript type checking
        },
      });

      let output = "";
      jest.stdout.on("data", (data) => {
        output += data.toString();
      });

      jest.stderr.on("data", (data) => {
        output += data.toString();
      });

      jest.on("close", (code) => {
        const executionTime = Date.now() - startTime;
        resolve({
          success: code === 0,
          executionTime,
          output,
          error: code !== 0 ? `${runner} exited with code ${code}` : null,
          jestArgs,
        });
      });

      jest.on("error", (error) => {
        resolve({
          success: false,
          executionTime: Date.now() - startTime,
          error: error.message,
        });
      });
    });
  }

  /**
   * Restore a file to its original state (synchronous)
   */
  restoreFile(filePath) {
    if (this.config.debugMutations) {
      // In debug mode, don't restore original files
      return;
    }

    try {
      const backupPath = `${filePath}.backup`;
      if (fs.existsSync(backupPath)) {
        // Restore from backup file
        fs.writeFileSync(filePath, fs.readFileSync(backupPath, "utf8"));
        fs.unlinkSync(backupPath);
        logger.debug(`✅ Restored ${filePath} from backup`);
      } else if (this.originalFileContents.has(filePath)) {
        // Fallback: restore from stored original content
        fs.writeFileSync(filePath, this.originalFileContents.get(filePath));
        logger.debug(
          `✅ Restored ${filePath} from memory (backup file missing)`,
        );
      } else {
        logger.error(
          `❌ Cannot restore ${filePath}: no backup or stored content found`,
        );
      }
    } catch (error) {
      logger.error(`❌ Error restoring ${filePath}:`, error.message);

      // Try fallback restoration from stored content
      if (this.originalFileContents.has(filePath)) {
        try {
          fs.writeFileSync(filePath, this.originalFileContents.get(filePath));
          logger.debug(`✅ Fallback restoration successful for ${filePath}`);
        } catch (fallbackError) {
          logger.error(
            `❌ Fallback restoration failed for ${filePath}:`,
            fallbackError.message,
          );
        }
      }
    }

    this.tempFiles.delete(filePath);
  }

  /**
   * Clean up mutated file by restoring original
   */
  async cleanupMutatedFile(filePath) {
    this.restoreFile(filePath);
  }

  /**
   * Get source code for a specific line from the original (unmutated) file
   */
  getSourceCodeLine(filePath, lineNumber) {
    try {
      // Use stored original content if available (during mutation testing)
      let sourceCode;
      if (this.originalFileContents.has(filePath)) {
        sourceCode = this.originalFileContents.get(filePath);
      } else {
        // Fallback to reading from disk (for initial analysis)
        sourceCode = fs.readFileSync(filePath, "utf8");
      }

      const lines = sourceCode.split("\n");
      return lines[lineNumber - 1] || "";
    } catch (error) {
      return "";
    }
  }

  /**
   * Determine possible mutation types for a line of code using AST analysis
   */
  getPossibleMutationTypes(sourceCode, filePath, lineNumber) {
    if (!sourceCode || sourceCode.trim() === "") {
      return [];
    }

    try {
      const {
        getPossibleMutations,
      } = require("./babel-plugin-mutation-tester");
      return getPossibleMutations(filePath, lineNumber, sourceCode);
    } catch (error) {
      // If AST analysis fails, return empty array to skip this line
      return [];
    }
  }

  /**
   * Test if a specific mutation type can be applied to a line
   */
  canApplyMutation(sourceCode, filePath, lineNumber, mutationType) {
    try {
      const babel = require("@babel/core");
      const {
        createMutationPlugin,
      } = require("./babel-plugin-mutation-tester");
      const fs = require("fs");

      // Read the full file content for proper AST parsing
      const fullFileContent = fs.readFileSync(filePath, "utf8");

      // Create a test mutation plugin
      const mutationPlugin = createMutationPlugin(lineNumber, mutationType);

      // Try to transform the full file
      const result = babel.transformSync(fullFileContent, {
        plugins: [mutationPlugin],
        filename: filePath,
        parserOpts: {
          sourceType: "module",
          allowImportExportEverywhere: true,
          plugins: ["typescript", "jsx"],
        },
        babelrc: false,
        configFile: false,
      });

      // Check if the mutation was actually applied by comparing the specific line
      if (result?.code) {
        const originalLines = fullFileContent.split("\n");
        const mutatedLines = result.code.split("\n");
        const originalLine = originalLines[lineNumber - 1] || "";
        const mutatedLine = mutatedLines[lineNumber - 1] || "";
        return originalLine.trim() !== mutatedLine.trim();
      }

      return false;
    } catch (error) {
      // If transformation fails, this mutation type can't be applied
      return false;
    }
  }

  /**
   * Extract test file path and test name from test name using lineage data
   */
  getTestFileFromTestName(testName) {
    // Search through lineage data to find the test file for this test name
    for (const [, lines] of Object.entries(this.lineageData)) {
      for (const [, tests] of Object.entries(lines)) {
        for (const test of tests) {
          if (test.testName === testName && test.testFile) {
            return {
              testFile: test.testFile,
              testName: test.testName,
            };
          }
        }
      }
    }

    // Fallback to calculator test if not found (for backward compatibility)
    logger.warn(
      `⚠️ Could not find test file for test "${testName}", using fallback`,
    );
    return {
      testFile: "src/__tests__/calculator.test.ts",
      testName: testName,
    };
  }

  /**
   * Print mutation testing summary
   */
  printMutationSummary(results) {
    if (this.config.debugMutations) {
      logger.info("\n🔍 Debug Mutation Testing Results:");
      logger.info("═".repeat(50));
      logger.info(`📊 Total Mutations Created: ${results.totalMutations}`);
      logger.info(
        `📁 Debug files saved to: ${
          this.config.debugMutationDir || "./mutations-debug"
        }`,
      );
      logger.info(
        `🔧 Use these files to manually inspect mutations and debug issues`,
      );
      logger.info(
        `💡 To run actual mutation testing, set debugMutations: false in config`,
      );
    } else {
      logger.info("\n🧬 Mutation Testing Results:");
      logger.info("═".repeat(50));
      logger.info(`📊 Total Mutations: ${results.totalMutations}`);
      logger.info(`✅ Killed: ${results.killedMutations}`);
      logger.info(`🔴 Survived: ${results.survivedMutations}`);
      logger.info(`⏰ Timeout: ${results.timeoutMutations}`);
      logger.info(`❌ Error: ${results.errorMutations}`);
      logger.info(`🎯 Mutation Score: ${results.mutationScore}%`);

      if (results.mutationScore < (this.config.mutationThreshold || 80)) {
        logger.info(
          `⚠️  Mutation score below threshold (${
            this.config.mutationThreshold || 80
          }%)`,
        );
      } else {
        logger.info(`🎉 Mutation score meets threshold!`);
      }
    }
  }

  /**
   * Get a preview of what the mutated code would look like
   */
  getMutatedCodePreview(originalCode, mutationType) {
    try {
      // Simple text-based mutations for preview
      switch (mutationType) {
        case "arithmetic":
          return originalCode
            .replace(/\+/g, "-")
            .replace(/\*/g, "/")
            .replace(/-/g, "+")
            .replace(/\//g, "*");
        case "logical":
          return originalCode.replace(/&&/g, "||").replace(/\|\|/g, "&&");
        case "conditional":
          // For conditional mutations, we negate the entire condition
          // This is a simplified preview - the actual mutation is more complex
          if (
            originalCode.includes("if (") ||
            originalCode.includes("} else if (")
          ) {
            return originalCode
              .replace(/if\s*\(([^)]+)\)/g, "if (!($1))")
              .replace(/else if\s*\(([^)]+)\)/g, "else if (!($1))");
          }
          return `${originalCode} /* condition negated */`;
        case "comparison":
          let result = originalCode;
          // Handle strict equality/inequality first to avoid conflicts
          result = result.replace(/===/g, "__TEMP_STRICT_EQ__");
          result = result.replace(/!==/g, "__TEMP_STRICT_NEQ__");
          result = result.replace(/>=/g, "__TEMP_GTE__");
          result = result.replace(/<=/g, "__TEMP_LTE__");

          // Now handle simple operators
          result = result.replace(/>/g, "<");
          result = result.replace(/</g, ">");
          result = result.replace(/==/g, "!=");
          result = result.replace(/!=/g, "==");

          // Restore complex operators with mutations
          result = result.replace(/__TEMP_STRICT_EQ__/g, "!==");
          result = result.replace(/__TEMP_STRICT_NEQ__/g, "===");
          result = result.replace(/__TEMP_GTE__/g, "<");
          result = result.replace(/__TEMP_LTE__/g, ">");

          return result;
        case "returns":
          return originalCode.replace(/return\s+([^;]+);?/g, "return null;");
        case "literals": {
          let lit = originalCode
            .replace(/\btrue\b/g, "false")
            .replace(/\bfalse\b/g, "true")
            .replace(/\b\d+\b/g, "0");
          // Also handle string literals in function arguments and assignments
          lit = lit.replace(/"([^"]+)"/g, '""').replace(/'([^']+)'/g, "''");
          return lit;
        }
        default:
          // Don't apply invalid mutations - return original code unchanged
          logger.warn(
            `⚠️ Unknown mutation type '${mutationType}' - skipping mutation`,
          );
          return originalCode;
      }
    } catch (error) {
      logger.warn(
        `⚠️ Mutation error for type '${mutationType}': ${error.message}`,
      );
      return originalCode;
    }
  }

  /**
   * Determine which tests killed this mutation
   */
  getKillingTests(testResult, tests) {
    // If the test failed, it means the mutation was killed
    if (testResult.success === false) {
      const killedBy = [];

      // Try to extract test names from the output
      if (testResult.output) {
        tests.forEach((test) => {
          // Try multiple patterns to find test names in output
          const testName = test.testName;
          if (
            testResult.output.includes(testName) ||
            testResult.output.includes(`"${testName}"`) ||
            testResult.output.includes(`'${testName}'`) ||
            testResult.output.includes(testName.replace(/\s+/g, " "))
          ) {
            killedBy.push(testName);
          }
        });
      }

      // If we couldn't identify specific tests, return the test names from lineage data
      // since we know these tests cover this line
      if (killedBy.length === 0 && tests.length > 0) {
        return tests.map((test) => test.testName);
      }

      return killedBy;
    }
    return [];
  }

  /**
   * Emergency cleanup - restore all files immediately (synchronous)
   */
  emergencyCleanup() {
    logger.info("🔧 Restoring original files...");

    // Restore from backup files first
    for (const filePath of this.tempFiles) {
      try {
        const backupPath = `${filePath}.backup`;
        if (fs.existsSync(backupPath)) {
          fs.writeFileSync(filePath, fs.readFileSync(backupPath, "utf8"));
          fs.unlinkSync(backupPath);
          logger.debug(`✅ Restored: ${filePath}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to restore ${filePath}:`, error.message);
      }
    }

    // Fallback: restore from stored original contents
    for (const [filePath, originalContent] of this.originalFileContents) {
      try {
        if (this.tempFiles.has(filePath)) {
          fs.writeFileSync(filePath, originalContent);
          logger.debug(`✅ Restored from memory: ${filePath}`);
        }
      } catch (error) {
        logger.error(
          `❌ Failed to restore from memory ${filePath}:`,
          error.message,
        );
      }
    }

    this.tempFiles.clear();
    this.originalFileContents.clear();
    logger.info("🎯 Emergency cleanup completed");
  }

  /**
   * Clean up all temporary files
   */
  async cleanup() {
    logger.info("🧹 Starting mutation testing cleanup...");

    for (const filePath of this.tempFiles) {
      await this.cleanupMutatedFile(filePath);
    }
    this.tempFiles.clear();
    this.originalFileContents.clear();

    // In debug mode, keep the debug files but log their location
    if (this.config.debugMutations && this.debugMutationFiles.size > 0) {
      const debugDir = this.config.debugMutationDir || "./mutations-debug";
      logger.info(`\n📁 Debug mutation files preserved in: ${debugDir}`);
      logger.info(`   Total files created: ${this.debugMutationFiles.size}`);
      logger.info(
        `   Use these files to manually inspect mutations and debug issues.`,
      );
    }

    logger.info("✅ Mutation testing cleanup completed");
  }
}

module.exports = MutationTester;
