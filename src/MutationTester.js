/**
 * Mutation Testing Orchestrator
 * Uses lineage tracking data to run targeted mutation tests
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createMutationPlugin } = require("./babel-plugin-mutation-tester");

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
      console.log(`📁 Created debug mutation directory: ${debugDir}`);
    } else {
      // Clean existing debug files
      const files = fs.readdirSync(debugDir);
      files.forEach((file) => {
        if (file.endsWith(".mutation.js") || file.endsWith(".mutation.ts")) {
          fs.unlinkSync(path.join(debugDir, file));
        }
      });
      console.log(`🧹 Cleaned existing debug mutation files in: ${debugDir}`);
    }
  }

  /**
   * Setup cleanup handlers for process interruption
   */
  setupCleanupHandlers() {
    // Handle process interruption (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('\n🛑 Mutation testing interrupted. Cleaning up...');
      this.emergencyCleanup();
      process.exit(1);
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('\n🛑 Mutation testing terminated. Cleaning up...');
      this.emergencyCleanup();
      process.exit(1);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('\n❌ Uncaught exception during mutation testing:', error.message);
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
      if (fs.existsSync(lineageFile)) {
        const data = JSON.parse(fs.readFileSync(lineageFile, "utf8"));
        this.lineageData = this.processLineageData(data);
        console.log(
          `📊 Loaded lineage data for ${
            Object.keys(this.lineageData).length
          } files`
        );
        return true;
      }
    } catch (error) {
      console.error("❌ Failed to load lineage data:", error.message);
    }
    return false;
  }

  /**
   * Process raw lineage data into a more usable format
   */
  processLineageData(rawData) {
    const processed = {};

    if (rawData.tests) {
      rawData.tests.forEach((test) => {
        if (test.coverage) {
          Object.keys(test.coverage).forEach((lineKey) => {
            // Parse line key: "file.ts:lineNumber"
            const [filePath, lineNumber] = lineKey.split(":");
            if (!lineNumber || lineNumber === "depth") return;

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
        }
      });
    }

    return processed;
  }

  /**
   * Run mutation testing for all covered lines
   */
  async runMutationTesting() {
    if (!this.lineageData) {
      console.error("❌ No lineage data available. Run normal tests first.");
      return false;
    }

    console.log("🧬 Starting mutation testing...");

    // Calculate total mutations for progress tracking
    const totalFiles = Object.keys(this.lineageData).length;
    let totalMutationsCount = 0;
    for (const [filePath, lines] of Object.entries(this.lineageData)) {
      for (const [lineNumber, tests] of Object.entries(lines)) {
        const sourceCode = this.getSourceCodeLine(
          filePath,
          parseInt(lineNumber)
        );
        const mutationTypes = this.getPossibleMutationTypes(sourceCode);
        totalMutationsCount += mutationTypes.length;
      }
    }

    console.log(
      `📊 Planning to test ${totalMutationsCount} mutations across ${totalFiles} files`
    );

    const results = {
      totalMutations: 0,
      killedMutations: 0,
      survivedMutations: 0,
      timeoutMutations: 0,
      errorMutations: 0,
      mutationScore: 0,
      fileResults: {},
    };

    let currentFileIndex = 0;
    let currentMutationIndex = 0;

    for (const [filePath, lines] of Object.entries(this.lineageData)) {
      currentFileIndex++;
      console.log(
        `\n🔬 Testing mutations in ${filePath} (${currentFileIndex}/${totalFiles})...`
      );

      const fileResults = await this.testFileLines(
        filePath,
        lines,
        currentMutationIndex,
        totalMutationsCount
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
              (fileResults.killedMutations / fileResults.totalMutations) * 100
            )
          : 0;
      console.log(
        `✅ ${fileName}: ${fileResults.totalMutations} mutations, ${fileResults.killedMutations} killed, ${fileResults.survivedMutations} survived (${fileScore}% score)`
      );
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
   * Test mutations for all lines in a specific file
   */
  async testFileLines(filePath, lines, startMutationIndex, totalMutations) {
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
        totalMutations
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
    totalMutations
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
    const mutationTypes = this.getPossibleMutationTypes(sourceCode);

    let currentMutationIndex = startMutationIndex;

    for (const mutationType of mutationTypes) {
      currentMutationIndex++;

      const mutationResult = await this.testSingleMutation(
        filePath,
        lineNumber,
        mutationType,
        tests,
        currentMutationIndex,
        totalMutations
      );

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
    totalMutations
  ) {
    const mutationId = `${filePath}:${lineNumber}:${mutationType}`;

    // Log progress with counter and percentage
    const fileName = filePath.split("/").pop();
    const percentage = Math.round(
      (currentMutationIndex / totalMutations) * 100
    );
    console.log(
      `🔧 Instrumenting: ${filePath} (${currentMutationIndex}/${totalMutations} - ${percentage}%) [${fileName}:${lineNumber} ${mutationType}]`
    );

    try {
      // Create mutated version of the file
      const mutatedFilePath = await this.createMutatedFile(
        filePath,
        lineNumber,
        mutationType
      );

      // Check if the mutation actually changed the code
      const originalCodeLine = this.getSourceCodeLine(filePath, lineNumber);
      const mutatedFileContent = fs.readFileSync(filePath, 'utf8');
      const mutatedLines = mutatedFileContent.split('\n');
      const mutatedCodeLine = mutatedLines[lineNumber - 1] || '';

      if (originalCodeLine.trim() === mutatedCodeLine.trim()) {
        console.log(`⚠️ Mutation did not change the code at ${filePath}:${lineNumber} (${mutationType})`);
        console.log(`   Line content: ${originalCodeLine.trim()}`);

        // Restore the original file
        this.restoreFile(filePath);

        return {
          id: mutationId,
          filePath,
          line: lineNumber,
          lineNumber,
          mutationType,
          mutatorName: mutationType,
          type: mutationType,
          status: 'error',
          original: originalCodeLine.trim(),
          replacement: 'NO_CHANGE',
          testsRun: 0,
          killedBy: [],
          executionTime: 0,
          error: 'Mutation did not change the code - mutation operator not applicable to this line',
        };
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
        testFiles = tests.map((test) =>
          this.getTestFileFromTestName(test.testName)
        );
        console.log(`🔍 Debug mutation created: ${mutatedFilePath}`);
      } else {
        // Normal mode: Run tests and check if mutation is killed
        testFiles = [
          ...new Set(
            tests.map((test) => this.getTestFileFromTestName(test.testName))
          ),
        ];

        try {
          testResult = await this.runTargetedTests(testFiles);
          status = testResult.success ? "survived" : "killed";
        } catch (testError) {
          console.error(`❌ Error running tests for mutation ${mutationId}:`, testError.message);
          testResult = {
            success: false,
            executionTime: 0,
            output: "",
            error: testError.message,
          };
          status = "error";
        } finally {
          // Always clean up, even if tests failed
          await this.cleanupMutatedFile(mutatedFilePath);
        }
      }

      // Debug logging for troubleshooting - ALWAYS show for now to debug the issue
      console.log(`🔍 Debug: ${mutationId}`);
      console.log(`  Test success: ${testResult.success}`);
      console.log(`  Status: ${status}`);
      console.log(`  Error: ${testResult.error || "none"}`);
      if (testResult.output && testResult.output.length > 0) {
        console.log(
          `  Output snippet: ${testResult.output.substring(0, 200)}...`
        );
      }

      // Get original and mutated code for display
      const originalCode = this.getSourceCodeLine(filePath, lineNumber);
      const mutatedCode = this.getMutatedCodePreview(originalCode, mutationType);

      // Check if mutation actually changed the code
      if (originalCode.trim() === mutatedCode.trim()) {
        console.log(`⚠️ Mutation failed to change code at ${filePath}:${lineNumber} (${mutationType})`);
        console.log(`   Original: ${originalCode.trim()}`);
        console.log(`   Expected mutation type: ${mutationType}`);

        return {
          id: mutationId,
          filePath,
          line: lineNumber,
          lineNumber,
          mutationType,
          mutatorName: mutationType,
          type: mutationType,
          status: 'error',
          original: originalCode.trim(),
          replacement: 'MUTATION_FAILED',
          testsRun: 0,
          killedBy: [],
          executionTime: 0,
          error: 'Mutation failed to change the code - no mutation was applied',
        };
      }

      // Determine which tests killed this mutation (if any)
      const killedBy = status === 'killed' ? this.getKillingTests(testResult, tests) : [];

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
        replacement: mutatedCode.trim(),
        testsRun: testFiles.length,
        killedBy,
        executionTime: testResult.executionTime,
        error: testResult.error,
      };
    } catch (error) {
      console.error(`❌ Error during mutation ${mutationId}:`, error.message);
      if (this.config.enableDebugLogging) {
        console.error(`Full error stack:`, error.stack);
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
      filePath
    );

    if (!mutatedCode) {
      throw new Error(
        `Failed to apply mutation ${mutationType} at line ${lineNumber} in ${filePath}`
      );
    }

    if (this.config.debugMutations) {
      // Debug mode: Create separate mutation files instead of overwriting originals
      return this.createDebugMutationFile(
        filePath,
        lineNumber,
        mutationType,
        mutatedCode
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
    mutatedCode
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

    console.log(`📝 Created debug mutation file: ${mutationFileName}`);
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

      // Transform code using Babel with the mutation plugin
      const result = babel.transformSync(code, {
        plugins: [mutationPlugin],
        filename: filePath,
        parserOpts: {
          sourceType: "module",
          allowImportExportEverywhere: true,
          plugins: ["typescript", "jsx"],
        },
      });

      return result?.code || null;
    } catch (error) {
      console.error(`Babel transformation error for ${filePath}:${lineNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Run targeted tests for specific test files
   */
  async runTargetedTests(testFiles) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // Build Jest command to run only specific test files
      const jestArgs = [
        "--testPathPatterns=" + testFiles.join("|"),
        "--silent",
        "--no-coverage",
        "--bail", // Stop on first failure
        "--no-cache", // Avoid cache issues with mutated files
        "--forceExit", // Ensure Jest exits cleanly
      ];

      const jest = spawn("jest", [...jestArgs], {
        stdio: "pipe",
        timeout: this.config.mutationTimeout || 5000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          JEST_LINEAGE_MUTATION_TESTING: "false", // Disable mutation testing during mutation testing
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
          error: code !== 0 ? `Jest exited with code ${code}` : null,
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
   * Clean up mutated file by restoring original
   */
  async cleanupMutatedFile(filePath) {
    if (this.config.debugMutations) {
      // In debug mode, don't clean up - files are preserved for inspection
      return;
    }

    try {
      const backupPath = `${filePath}.backup`;
      if (fs.existsSync(backupPath)) {
        // Restore from backup file
        fs.writeFileSync(filePath, fs.readFileSync(backupPath, "utf8"));
        fs.unlinkSync(backupPath);
      } else if (this.originalFileContents.has(filePath)) {
        // Fallback: restore from stored original content
        fs.writeFileSync(filePath, this.originalFileContents.get(filePath));
        console.log(`⚠️ Restored ${filePath} from memory (backup file missing)`);
      } else {
        console.error(`❌ Cannot restore ${filePath}: no backup or stored content found`);
      }
    } catch (error) {
      console.error(`❌ Error restoring ${filePath}:`, error.message);

      // Try fallback restoration from stored content
      if (this.originalFileContents.has(filePath)) {
        try {
          fs.writeFileSync(filePath, this.originalFileContents.get(filePath));
          console.log(`✅ Fallback restoration successful for ${filePath}`);
        } catch (fallbackError) {
          console.error(`❌ Fallback restoration failed for ${filePath}:`, fallbackError.message);
        }
      }
    }

    this.tempFiles.delete(filePath);
  }

  /**
   * Get source code for a specific line
   */
  getSourceCodeLine(filePath, lineNumber) {
    try {
      const sourceCode = fs.readFileSync(filePath, "utf8");
      const lines = sourceCode.split("\n");
      return lines[lineNumber - 1] || "";
    } catch (error) {
      return "";
    }
  }

  /**
   * Determine possible mutation types for a line of code
   */
  getPossibleMutationTypes(sourceCode) {
    const types = [];

    // More precise detection to avoid false positives
    if (/[+\-*/%](?![=<>])/.test(sourceCode)) types.push("arithmetic");
    if (/[<>]=?|[!=]==?/.test(sourceCode)) types.push("comparison");
    if (/&&|\|\|/.test(sourceCode)) types.push("logical");
    if (/\bif\b|\bwhile\b|\bfor\b/.test(sourceCode)) types.push("conditional");

    // Only detect returns for simple literal returns
    if (/\breturn\s+(true|false|null|undefined|\d+)\s*;/.test(sourceCode))
      types.push("returns");

    // Only detect literals that are not in comparisons or assignments
    if (
      /\b(true|false|null|undefined)\b(?!\s*[=!<>])/.test(sourceCode) ||
      /""|''/.test(sourceCode)
    )
      types.push("literals");

    if (/\+\+|--/.test(sourceCode)) types.push("increments");

    // Only detect actual assignment operators, not comparisons
    if (/[+\-*/%]=(?!=)/.test(sourceCode)) types.push("assignment");

    return types.length > 0 ? types : ["arithmetic"]; // Default fallback
  }

  /**
   * Extract test file path from test name using lineage data
   */
  getTestFileFromTestName(testName) {
    // Search through lineage data to find the test file for this test name
    for (const [filePath, lines] of Object.entries(this.lineageData)) {
      for (const [lineNumber, tests] of Object.entries(lines)) {
        for (const test of tests) {
          if (test.testName === testName && test.testFile) {
            return test.testFile;
          }
        }
      }
    }

    // Fallback to calculator test if not found (for backward compatibility)
    console.warn(`⚠️ Could not find test file for test "${testName}", using fallback`);
    return "src/__tests__/calculator.test.ts";
  }

  /**
   * Print mutation testing summary
   */
  printMutationSummary(results) {
    if (this.config.debugMutations) {
      console.log("\n🔍 Debug Mutation Testing Results:");
      console.log("═".repeat(50));
      console.log(`📊 Total Mutations Created: ${results.totalMutations}`);
      console.log(
        `📁 Debug files saved to: ${
          this.config.debugMutationDir || "./mutations-debug"
        }`
      );
      console.log(
        `🔧 Use these files to manually inspect mutations and debug issues`
      );
      console.log(
        `💡 To run actual mutation testing, set debugMutations: false in config`
      );
    } else {
      console.log("\n🧬 Mutation Testing Results:");
      console.log("═".repeat(50));
      console.log(`📊 Total Mutations: ${results.totalMutations}`);
      console.log(`✅ Killed: ${results.killedMutations}`);
      console.log(`🔴 Survived: ${results.survivedMutations}`);
      console.log(`⏰ Timeout: ${results.timeoutMutations}`);
      console.log(`❌ Error: ${results.errorMutations}`);
      console.log(`🎯 Mutation Score: ${results.mutationScore}%`);

      if (results.mutationScore < (this.config.mutationThreshold || 80)) {
        console.log(
          `⚠️  Mutation score below threshold (${
            this.config.mutationThreshold || 80
          }%)`
        );
      } else {
        console.log(`🎉 Mutation score meets threshold!`);
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
        case 'arithmetic':
          return originalCode.replace(/\+/g, '-').replace(/\*/g, '/').replace(/-/g, '+').replace(/\//g, '*');
        case 'logical':
          return originalCode.replace(/&&/g, '||').replace(/\|\|/g, '&&');
        case 'conditional':
          // For conditional mutations, we negate the entire condition
          // This is a simplified preview - the actual mutation is more complex
          if (originalCode.includes('if (') || originalCode.includes('} else if (')) {
            return originalCode.replace(/if\s*\(([^)]+)\)/g, 'if (!($1))').replace(/else if\s*\(([^)]+)\)/g, 'else if (!($1))');
          }
          return `${originalCode} /* condition negated */`;
        case 'comparison':
          let result = originalCode;
          // Handle strict equality/inequality first to avoid conflicts
          result = result.replace(/===/g, '__TEMP_STRICT_EQ__');
          result = result.replace(/!==/g, '__TEMP_STRICT_NEQ__');
          result = result.replace(/>=/g, '__TEMP_GTE__');
          result = result.replace(/<=/g, '__TEMP_LTE__');

          // Now handle simple operators
          result = result.replace(/>/g, '<');
          result = result.replace(/</g, '>');
          result = result.replace(/==/g, '!=');
          result = result.replace(/!=/g, '==');

          // Restore complex operators with mutations
          result = result.replace(/__TEMP_STRICT_EQ__/g, '!==');
          result = result.replace(/__TEMP_STRICT_NEQ__/g, '===');
          result = result.replace(/__TEMP_GTE__/g, '<');
          result = result.replace(/__TEMP_LTE__/g, '>');

          return result;
        case 'returns':
          return originalCode.replace(/return\s+([^;]+);?/g, 'return null;');
        case 'literals':
          return originalCode.replace(/true/g, 'false').replace(/false/g, 'true').replace(/\d+/g, '0');
        default:
          return `${originalCode} /* mutated */`;
      }
    } catch (error) {
      return `${originalCode} /* mutation error */`;
    }
  }

  /**
   * Determine which tests killed this mutation
   */
  getKillingTests(testResult, tests) {
    // If the test failed, it means the mutation was killed
    // We can try to extract test names from the output
    if (testResult.success === false && testResult.output) {
      const killedBy = [];
      tests.forEach(test => {
        if (testResult.output.includes(test.testName)) {
          killedBy.push(test.testName);
        }
      });
      return killedBy.length > 0 ? killedBy : ['Unknown test'];
    }
    return [];
  }

  /**
   * Emergency cleanup - restore all files immediately (synchronous)
   */
  emergencyCleanup() {
    console.log('🔧 Restoring original files...');

    // Restore from backup files first
    for (const filePath of this.tempFiles) {
      try {
        const backupPath = `${filePath}.backup`;
        if (fs.existsSync(backupPath)) {
          fs.writeFileSync(filePath, fs.readFileSync(backupPath, "utf8"));
          fs.unlinkSync(backupPath);
          console.log(`✅ Restored: ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Failed to restore ${filePath}:`, error.message);
      }
    }

    // Fallback: restore from stored original contents
    for (const [filePath, originalContent] of this.originalFileContents) {
      try {
        if (this.tempFiles.has(filePath)) {
          fs.writeFileSync(filePath, originalContent);
          console.log(`✅ Restored from memory: ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Failed to restore from memory ${filePath}:`, error.message);
      }
    }

    this.tempFiles.clear();
    this.originalFileContents.clear();
    console.log('🎯 Emergency cleanup completed');
  }

  /**
   * Clean up all temporary files
   */
  async cleanup() {
    console.log('🧹 Starting mutation testing cleanup...');

    for (const filePath of this.tempFiles) {
      await this.cleanupMutatedFile(filePath);
    }
    this.tempFiles.clear();
    this.originalFileContents.clear();

    // In debug mode, keep the debug files but log their location
    if (this.config.debugMutations && this.debugMutationFiles.size > 0) {
      const debugDir = this.config.debugMutationDir || "./mutations-debug";
      console.log(`\n📁 Debug mutation files preserved in: ${debugDir}`);
      console.log(`   Total files created: ${this.debugMutationFiles.size}`);
      console.log(
        `   Use these files to manually inspect mutations and debug issues.`
      );
    }

    console.log('✅ Mutation testing cleanup completed');
  }
}

module.exports = MutationTester;
