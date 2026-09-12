/**
 * Vitest reporter: turns the per-test lineage the workers recorded into the same
 * artifacts the Jest reporter produces.
 *
 * Everything below the collection step — the overlap analysis, the redundancy
 * report, the HTML — is shared with the Jest side unchanged. The only runner
 * specific part is reading `task.meta.lineage` off the finished modules.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TestCoverageReporter = require("../TestCoverageReporter.js");
const { collectCoverageData } = require("./collect.js");
const logger = require("../logger.js");

export class LineageReporter {
  constructor(options = {}) {
    this.options = options;
  }

  onInit(vitest) {
    this.cwd = vitest?.config?.root || process.cwd();
    // Mutation runs spawn a fresh Vitest, which must load the same config this
    // run used — otherwise it sees none of the project's setup.
    this.configPath = vitest?.vite?.config?.configFile || undefined;
  }

  async onTestRunEnd(testModules) {
    if (
      process.env.JEST_LINEAGE_ENABLED === "false" ||
      process.env.JEST_LINEAGE_TRACKING === "false"
    ) {
      return;
    }

    const { coverageData, testsSeen } = collectCoverageData(testModules);

    if (testsSeen === 0) {
      logger.warn(
        "⚠️  jest-lineage: no lineage recorded. Check that the Vite plugin is " +
          "registered and that setup.mjs is listed in `test.setupFiles`.",
      );
      return;
    }

    // The report generator is a Jest reporter by construction but needs nothing
    // from Jest beyond a rootDir, so it is reused rather than reimplemented.
    const writer = new TestCoverageReporter(
      { rootDir: this.cwd },
      this.options,
    );
    writer.coverageData = coverageData;
    await writer.generateHtmlReport();

    // Mutation testing re-runs a subset of the suite per mutant, which needs to
    // know it is driving Vitest rather than Jest. Everything else about it —
    // finding mutants, choosing which tests to re-run from the lineage — is the
    // same on both runners.
    if (this.options.enableMutationTesting) {
      writer.options = {
        ...writer.options,
        testRunner: "vitest",
        runnerConfig: this.options.runnerConfig || this.configPath,
      };
      await writer.runMutationTestingIfEnabled();
    }
  }
}

export default LineageReporter;
