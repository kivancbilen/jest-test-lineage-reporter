/**
 * Lineage Data Loader
 * Load and validate .jest-lineage-data.json
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const lineageStore = require('../../lineageStore');

/**
 * Fold any leftover run shards into the JSON document, surfacing failures with
 * CLI-shaped guidance rather than a raw error.
 */
function mergeShardsIfNewer(resolvedPath) {
  try {
    return lineageStore.mergeShardsIfNewer(resolvedPath);
  } catch (error) {
    throw new Error(
      `Failed to merge lineage shards from ${chalk.yellow(lineageStore.getShardDir())}\n\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Load lineage data from file
 * @param {string} dataPath - Path to lineage data file
 * @returns {object} Parsed lineage data
 */
function loadLineageData(dataPath = '.jest-lineage-data.json') {
  const resolvedPath = path.resolve(process.cwd(), dataPath);

  mergeShardsIfNewer(resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Lineage data file not found: ${chalk.yellow(resolvedPath)}\n\n` +
      `${chalk.cyan('Hint:')} Run ${chalk.green('jest-lineage test')} first to generate lineage data.`
    );
  }

  const { size } = fs.statSync(resolvedPath);
  if (size > lineageStore.MAX_SAFE_JSON_BYTES) {
    throw new Error(
      `Lineage data file is too large to parse: ${chalk.yellow(resolvedPath)} ` +
      `(${(size / 1024 / 1024).toFixed(0)}MB)\n\n` +
      `${chalk.cyan('Hint:')} Set ${chalk.green('JEST_LINEAGE_INCLUDE')} to instrument only the code ` +
      `under test, then re-run with ${chalk.green('jest --clearCache')}.`
    );
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const data = JSON.parse(content);

    // Validate structure
    if (!data.timestamp || !Array.isArray(data.tests)) {
      throw new Error(
        `Invalid lineage data format in ${chalk.yellow(resolvedPath)}\n\n` +
        `Expected format: { timestamp: number, tests: array }`
      );
    }

    if (data.tests.length === 0) {
      throw new Error(
        `No test data found in ${chalk.yellow(resolvedPath)}\n\n` +
        `The file exists but contains no test results. Run ${chalk.green('jest-lineage test')} to generate data.`
      );
    }

    return data;
  } catch (error) {
    if (error.name === 'SyntaxError') {
      throw new Error(
        `Failed to parse lineage data file: ${chalk.yellow(resolvedPath)}\n\n` +
        `The file contains invalid JSON. Error: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Process raw lineage data into format needed by MutationTester
 * @param {object} rawData - Raw data from .jest-lineage-data.json
 * @returns {object} Processed lineage data { filePath: { lineNumber: [testInfo, ...] } }
 */
function processLineageDataForMutation(rawData) {
  const processed = {};

  if (!rawData.tests) {
    return processed;
  }

  rawData.tests.forEach((test) => {
    if (!test.coverage) {
      return;
    }

    const coverageKeys = Object.keys(test.coverage);

    coverageKeys.forEach((lineKey) => {
      // Parse line key: "file.ts:lineNumber"
      const [filePath, lineNumber, ...suffixes] = lineKey.split(':');

      // Skip metadata entries (depth, performance, meta) - only process basic line coverage
      if (!lineNumber || suffixes.length > 0) {
        return;
      }

      if (!processed[filePath]) {
        processed[filePath] = {};
      }

      if (!processed[filePath][lineNumber]) {
        processed[filePath][lineNumber] = [];
      }

      processed[filePath][lineNumber].push({
        testName: test.name,
        testType: test.type || 'it',
        testFile: test.testFile || 'unknown',
        executionCount: test.coverage[lineKey] || 1
      });
    });
  });

  return processed;
}

/**
 * Check if lineage data file exists
 * @param {string} dataPath - Path to check
 * @returns {boolean} True if file exists
 */
function lineageDataExists(dataPath = '.jest-lineage-data.json') {
  const resolvedPath = path.resolve(process.cwd(), dataPath);
  return fs.existsSync(resolvedPath) || lineageStore.hasShards();
}

module.exports = {
  loadLineageData,
  mergeShardsIfNewer,
  processLineageDataForMutation,
  lineageDataExists
};
