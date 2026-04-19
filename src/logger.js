/**
 * Configurable logger for jest-test-lineage-reporter.
 * Respects enableDebugLogging and enableConsoleOutput config flags
 * so the library stays quiet by default.
 */

let _debugEnabled = false;
let _consoleEnabled = true;

const logger = {
  /** Reconfigure the logger (call once when config is loaded). */
  configure({ enableDebugLogging = false, enableConsoleOutput = true } = {}) {
    _debugEnabled = enableDebugLogging;
    _consoleEnabled = enableConsoleOutput;
  },

  /** Diagnostic detail — only shown when enableDebugLogging is true. */
  debug(...args) {
    if (_debugEnabled) console.log(...args);
  },

  /** Normal operational messages — shown when enableConsoleOutput is true. */
  info(...args) {
    if (_consoleEnabled) console.log(...args);
  },

  /** Warnings — always shown. */
  warn(...args) {
    console.warn(...args);
  },

  /** Errors — always shown. */
  error(...args) {
    console.error(...args);
  },
};

module.exports = logger;
