import { defineConfig } from "vitest/config";
import { lineageTracker } from "jest-test-lineage-reporter/vitest/plugin";
import { LineageReporter } from "jest-test-lineage-reporter/vitest/reporter";

export default defineConfig({
  // Instruments your source files. Vitest transforms through Vite rather than
  // Babel, so the tracker is a Vite plugin — but it runs the same Babel plugin
  // the Jest integration uses, so both runners agree on what gets instrumented.
  plugins: [lineageTracker()],

  test: {
    // Records which lines each `it` block executed.
    setupFiles: ["jest-test-lineage-reporter/vitest/setup"],

    // Writes test-lineage-report.html, test-redundancy.json and
    // test-redundancy.md when the run finishes.
    reporters: ["default", new LineageReporter()],
  },
});
