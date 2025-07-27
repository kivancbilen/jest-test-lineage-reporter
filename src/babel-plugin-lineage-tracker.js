/**
 * Production Babel Plugin for Jest Test Lineage Tracking
 * Automatically instruments source code to track line-by-line test coverage
 */
function lineageTrackerPlugin({ types: t }, options = {}) {
  // Check if lineage tracking is enabled
  const isEnabled = process.env.JEST_LINEAGE_ENABLED !== 'false' &&
                   process.env.JEST_LINEAGE_TRACKING !== 'false' &&
                   options.enabled !== false;

  return {
    name: 'lineage-tracker',
    visitor: {
      Program: {
        enter(path, state) {
          // Initialize plugin state
          state.filename = state.file.opts.filename;
          state.shouldInstrument = isEnabled && shouldInstrumentFile(state.filename);
          state.instrumentedLines = new Set();

          if (state.shouldInstrument) {
            console.log(`🔧 Instrumenting: ${state.filename}`);
          } else if (!isEnabled) {
            console.log(`⏸️ Lineage tracking disabled for: ${state.filename}`);
          }
        }
      },
      // Instrument function declarations
      FunctionDeclaration(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, 'function-declaration');
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument function expressions and arrow functions
      'FunctionExpression|ArrowFunctionExpression'(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, 'function-expression');
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument variable declarations
      VariableDeclaration(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, 'variable-declaration');
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument expression statements
      ExpressionStatement(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, 'expression-statement');
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument return statements
      ReturnStatement(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, 'return-statement');
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument if statements
      IfStatement(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, 'if-statement');
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument block statements (but avoid duplicating)
      BlockStatement(path, state) {
        if (!state.shouldInstrument) return;

        // Only instrument block statements that are function bodies
        if (t.isFunction(path.parent)) {
          const lineNumber = path.node.loc?.start.line;
          if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
            // Insert tracking at the beginning of the block
            const trackingCall = createTrackingCall(state.filename, lineNumber, 'block-start');
            path.unshiftContainer('body', trackingCall);
            state.instrumentedLines.add(lineNumber);
          }
        }
      }
    }
  };
};

/**
 * Determines if a file should be instrumented
 */
function shouldInstrumentFile(filename) {
  if (!filename) return false;

  // Don't instrument test files
  if (filename.includes('__tests__') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('testSetup.js') ||
      filename.includes('TestCoverageReporter.js') ||
      filename.includes('LineageTestEnvironment.js')) {
    return false;
  }

  // Don't instrument node_modules
  if (filename.includes('node_modules')) {
    return false;
  }

  // Only instrument source files
  return filename.endsWith('.ts') ||
         filename.endsWith('.js') ||
         filename.endsWith('.tsx') ||
         filename.endsWith('.jsx');
}

/**
 * Instruments a line by adding tracking call before it
 */
function instrumentLine(path, state, lineNumber, nodeType) {
  const trackingCall = createTrackingCall(state.filename, lineNumber, nodeType);

  try {
    // Insert tracking call before the current statement
    path.insertBefore(trackingCall);
  } catch (error) {
    console.warn(`Warning: Could not instrument line ${lineNumber} in ${state.filename}:`, error.message);
  }
}

/**
 * Creates a tracking function call with package.json-based path detection
 */
function createTrackingCall(filename, lineNumber, nodeType) {
  const { types: t } = require('@babel/core');
  const path = require('path');

  // Use package.json as the project root reference
  let relativeFilePath;
  if (filename) {
    const projectRoot = findProjectRoot(filename);

    if (projectRoot && filename.startsWith(projectRoot)) {
      // Convert absolute path to relative path from package.json location
      relativeFilePath = path.relative(projectRoot, filename);
    } else {
      // Fallback to current working directory
      const cwd = process.cwd();
      if (filename.startsWith(cwd)) {
        relativeFilePath = path.relative(cwd, filename);
      } else {
        // Last resort: extract meaningful path
        relativeFilePath = extractMeaningfulPath(filename);
      }
    }
  } else {
    relativeFilePath = 'unknown';
  }

  // Create: global.__TRACK_LINE_EXECUTION__ && global.__TRACK_LINE_EXECUTION__(filename, lineNumber)
  return t.expressionStatement(
    t.logicalExpression(
      '&&',
      t.memberExpression(
        t.identifier('global'),
        t.identifier('__TRACK_LINE_EXECUTION__')
      ),
      t.callExpression(
        t.memberExpression(
          t.identifier('global'),
          t.identifier('__TRACK_LINE_EXECUTION__')
        ),
        [
          t.stringLiteral(relativeFilePath),
          t.numericLiteral(lineNumber),
          t.stringLiteral(nodeType)
        ]
      )
    )
  );
}

/**
 * Find the project root by looking for package.json
 */
function findProjectRoot(startPath) {
  const path = require('path');
  const fs = require('fs');

  let currentDir = path.dirname(startPath);
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

/**
 * Extract meaningful path from filename using smart detection (fallback)
 */
function extractMeaningfulPath(filename) {
  const path = require('path');
  const parts = filename.split(path.sep);

  // Common source directory indicators
  const sourceIndicators = [
    'src', 'lib', 'source', 'app', 'server', 'client',
    'packages', 'apps', 'libs', 'modules', 'components'
  ];

  // Find the first occurrence of a source indicator (not last)
  let sourceIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (sourceIndicators.includes(parts[i])) {
      sourceIndex = i;
      break;
    }
  }

  if (sourceIndex !== -1) {
    // Include the source directory and everything after it
    // This preserves subdirectories like 'src/services/calculationService.ts'
    return parts.slice(sourceIndex).join(path.sep);
  }

  // If no source indicator found, try to preserve meaningful structure
  const filename_only = parts[parts.length - 1];

  // Look for meaningful parent directories (preserve up to 3 levels)
  if (parts.length >= 3) {
    const meaningfulParts = parts.slice(-3); // Take last 3 parts
    // Filter out common non-meaningful directories
    const filtered = meaningfulParts.filter(part =>
      part &&
      !part.startsWith('.') &&
      part !== 'node_modules' &&
      part !== 'dist' &&
      part !== 'build'
    );

    if (filtered.length >= 2) {
      return filtered.join(path.sep);
    }
  }

  // Look for meaningful parent directories (preserve up to 2 levels)
  if (parts.length >= 2) {
    const parent = parts[parts.length - 2];
    // If parent looks like a meaningful directory, include it
    if (parent && !parent.startsWith('.') && parent !== 'node_modules') {
      return path.join(parent, filename_only);
    }
  }

  // Fallback to just the filename
  return filename_only;
}

module.exports = lineageTrackerPlugin;
