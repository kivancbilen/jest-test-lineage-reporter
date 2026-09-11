/**
 * Production Babel Plugin for Jest Test Lineage Tracking
 * Automatically instruments source code to track line-by-line test coverage
 */
function lineageTrackerPlugin({ types: t }, options = {}) {
  // Check if lineage tracking is enabled
  const isEnabled =
    process.env.JEST_LINEAGE_ENABLED !== "false" &&
    process.env.JEST_LINEAGE_TRACKING !== "false" &&
    options.enabled !== false;
  const isDebug = process.env.JEST_LINEAGE_DEBUG === "true";

  return {
    name: "lineage-tracker",
    visitor: {
      Program: {
        enter(path, state) {
          // Initialize plugin state
          state.filename = state.file.opts.filename;
          // An explicit root keeps every recorded path relative to the same
          // place. Without one, findProjectRoot() picks the nearest
          // package.json, which in a monorepo differs per package — so the
          // reporter, running from the repo root, cannot find the sources
          // again. Runners that know their own root should pass it.
          state.lineageRoot = options.projectRoot || null;
          state.shouldInstrument =
            isEnabled && shouldInstrumentFile(state.filename);
          state.instrumentedLines = new Set();

          if (isDebug) {
            if (state.shouldInstrument) {
              console.log(`🔧 Instrumenting: ${state.filename}`);
            } else if (!isEnabled) {
              console.log(
                `⏸️ Lineage tracking disabled for: ${state.filename}`,
              );
            }
          }
        },
      },
      // Instrument function declarations
      FunctionDeclaration(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, "function-declaration");
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument function expressions and arrow functions
      "FunctionExpression|ArrowFunctionExpression"(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, "function-expression");
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument variable declarations
      VariableDeclaration(path, state) {
        if (!state.shouldInstrument) return;

        // A declaration in a for-init / for-in-left / for-of-left is NOT in
        // statement position. insertBefore() there detaches the binding from
        // the loop head, so `for (let i = 0; i < n; i++)` compiles to code that
        // throws "i is not defined" at runtime. Skip those positions.
        const parentPath = path.parentPath;
        if (
          parentPath.isForStatement({ init: path.node }) ||
          parentPath.isForInStatement({ left: path.node }) ||
          parentPath.isForOfStatement({ left: path.node })
        ) {
          return;
        }

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, "variable-declaration");
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument expression statements
      ExpressionStatement(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, "expression-statement");
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument return statements
      ReturnStatement(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, "return-statement");
          state.instrumentedLines.add(lineNumber);
        }
      },

      // Instrument if statements
      IfStatement(path, state) {
        if (!state.shouldInstrument) return;

        const lineNumber = path.node.loc?.start.line;
        if (lineNumber && !state.instrumentedLines.has(lineNumber)) {
          instrumentLine(path, state, lineNumber, "if-statement");
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
            const trackingCall = createTrackingCall(
              state.filename,
              lineNumber,
              "block-start",
            );
            path.unshiftContainer("body", trackingCall);
            state.instrumentedLines.add(lineNumber);
          }
        }
      },
    },
  };
}

/**
 * Parse a comma-separated pattern list into matchers.
 *
 * Each entry is used as a regular expression when it compiles, and as a plain
 * substring otherwise. Filenames are normalised to forward slashes first so the
 * same patterns work on every platform.
 */
const patternCache = new Map();
function parsePatterns(raw) {
  if (patternCache.has(raw)) return patternCache.get(raw);

  const patterns = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new RegExp(entry);
      } catch (e) {
        return { test: (value) => value.includes(entry) };
      }
    });

  patternCache.set(raw, patterns);
  return patterns;
}

function matchesAny(filename, raw) {
  const normalized = filename.replace(/\\/g, "/");
  return parsePatterns(raw).some((pattern) => pattern.test(normalized));
}

/**
 * Determines if a file should be instrumented
 */
function shouldInstrumentFile(filename) {
  if (!filename) return false;

  // Opt-in path scoping. Without it every source file in the repo gets
  // instrumented, so in a monorepo each test records lines executed across
  // every package rather than just the code under test, and the per-test
  // payload grows without bound.
  //
  //   JEST_LINEAGE_INCLUDE  only instrument files matching one of these
  //   JEST_LINEAGE_EXCLUDE  never instrument files matching one of these
  //
  // Jest caches transform output and the cache key does not include this
  // plugin's configuration, so run `jest --clearCache` after changing either.
  const exclude = process.env.JEST_LINEAGE_EXCLUDE;
  if (exclude && matchesAny(filename, exclude)) {
    return false;
  }

  const include = process.env.JEST_LINEAGE_INCLUDE;
  if (include && !matchesAny(filename, include)) {
    return false;
  }

  // Don't instrument test files
  if (
    filename.includes("__tests__") ||
    filename.includes(".test.") ||
    filename.includes(".spec.") ||
    filename.includes("testSetup.js") ||
    filename.includes("TestCoverageReporter.js") ||
    filename.includes("LineageTestEnvironment.js") ||
    filename.includes("v8-memory-profiler.js") ||
    filename.includes("MutationTester.js") ||
    filename.includes("logger.js")
  ) {
    return false;
  }

  // Don't instrument node_modules
  if (filename.includes("node_modules")) {
    return false;
  }

  // Only instrument source files
  return (
    filename.endsWith(".ts") ||
    filename.endsWith(".js") ||
    filename.endsWith(".tsx") ||
    filename.endsWith(".jsx")
  );
}

/**
 * Instruments a line by adding tracking call before it
 */
function instrumentLine(path, state, lineNumber, nodeType) {
  const trackingCall = createTrackingCall(
    state.filename,
    lineNumber,
    nodeType,
    state.lineageRoot,
  );

  try {
    // Insert tracking call before the current statement
    path.insertBefore(trackingCall);
  } catch (error) {
    console.warn(
      `Warning: Could not instrument line ${lineNumber} in ${state.filename}:`,
      error.message,
    );
  }
}

/**
 * Creates a tracking function call with package.json-based path detection
 */
function createTrackingCall(filename, lineNumber, nodeType, explicitRoot) {
  const { types: t } = require("@babel/core");
  const path = require("path");

  // Use package.json as the project root reference, unless the caller named one
  let relativeFilePath;
  if (filename) {
    const projectRoot = explicitRoot || findProjectRoot(filename);

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
    relativeFilePath = "unknown";
  }

  // Create: global.__TRACK_LINE_EXECUTION__ && global.__TRACK_LINE_EXECUTION__(filename, lineNumber)
  return t.expressionStatement(
    t.logicalExpression(
      "&&",
      t.memberExpression(
        t.identifier("global"),
        t.identifier("__TRACK_LINE_EXECUTION__"),
      ),
      t.callExpression(
        t.memberExpression(
          t.identifier("global"),
          t.identifier("__TRACK_LINE_EXECUTION__"),
        ),
        [
          t.stringLiteral(relativeFilePath),
          t.numericLiteral(lineNumber),
          t.stringLiteral(nodeType),
        ],
      ),
    ),
  );
}

/**
 * Find the project root by looking for package.json
 */
function findProjectRoot(startPath) {
  const path = require("path");
  const fs = require("fs");

  let currentDir = path.dirname(startPath);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, "package.json");
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
  const path = require("path");
  const parts = filename.split(path.sep);

  // Common source directory indicators
  const sourceIndicators = [
    "src",
    "lib",
    "source",
    "app",
    "server",
    "client",
    "packages",
    "apps",
    "libs",
    "modules",
    "components",
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
    const filtered = meaningfulParts.filter(
      (part) =>
        part &&
        !part.startsWith(".") &&
        part !== "node_modules" &&
        part !== "dist" &&
        part !== "build",
    );

    if (filtered.length >= 2) {
      return filtered.join(path.sep);
    }
  }

  // Look for meaningful parent directories (preserve up to 2 levels)
  if (parts.length >= 2) {
    const parent = parts[parts.length - 2];
    // If parent looks like a meaningful directory, include it
    if (parent && !parent.startsWith(".") && parent !== "node_modules") {
      return path.join(parent, filename_only);
    }
  }

  // Fallback to just the filename
  return filename_only;
}

module.exports = lineageTrackerPlugin;
