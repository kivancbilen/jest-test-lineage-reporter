/**
 * How to re-run a subset of a suite, per test runner.
 *
 * Mutation testing works the same way whichever runner is underneath: apply a
 * mutation, re-run only the tests that cover the mutated line, see whether any
 * of them fail. Only the command differs, so that is all this module holds.
 */

const fs = require("fs");
const path = require("path");

/** Escape a string for use inside a regular expression. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RUNNERS = {
  jest: {
    bin: "jest",
    args({ testFiles, testNames }) {
      const args = [
        "--testPathPatterns=" + testFiles.join("|"),
        "--no-coverage",
        "--bail",
        "--no-cache",
        "--forceExit",
        "--runInBand",
      ];
      if (testNames && testNames.length > 0) {
        args.push(
          `--testNamePattern=(${testNames.map(escapeRegex).join("|")})`,
        );
      }
      return args;
    },
  },

  vitest: {
    bin: "vitest",
    args({ testFiles, testNames, configPath }) {
      const args = [
        "run",
        // Vitest takes bare filename filters positionally rather than as a flag.
        ...testFiles,
        "--coverage.enabled=false",
        "--bail=1",
        // One process, like Jest's --runInBand: a mutation is applied to a file
        // on disk, so concurrent workers would race over the same source.
        "--no-file-parallelism",
      ];
      if (configPath) args.push("--config", configPath);
      if (testNames && testNames.length > 0) {
        args.push(
          "--testNamePattern",
          `(${testNames.map(escapeRegex).join("|")})`,
        );
      }
      return args;
    },
  },
};

/**
 * Which runner a project uses, when the caller has not said.
 *
 * Checked in order of how much the signal means: an explicit option, then a
 * binary that is actually installed, then jest as the historical default.
 */
function detectRunner(cwd = process.cwd(), explicit) {
  if (explicit && RUNNERS[explicit]) return explicit;
  for (const name of ["vitest", "jest"]) {
    if (fs.existsSync(path.resolve(cwd, "node_modules", ".bin", name))) {
      return name;
    }
  }
  return "jest";
}

/**
 * @returns {{command: string, args: string[], runner: string}}
 */
function buildRunCommand(runner, cwd, options) {
  const spec = RUNNERS[runner] || RUNNERS.jest;
  const args = spec.args(options);
  const localBin = path.resolve(cwd, "node_modules", ".bin", spec.bin);

  // Prefer the project's own binary so `shell: true` is never needed.
  if (fs.existsSync(localBin)) {
    return { command: localBin, args, runner };
  }
  return { command: "npx", args: [spec.bin, ...args], runner };
}

module.exports = { RUNNERS, detectRunner, buildRunCommand, escapeRegex };
