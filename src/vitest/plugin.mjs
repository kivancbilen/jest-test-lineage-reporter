/**
 * Vite plugin that instruments source files for lineage tracking.
 *
 * Vitest transforms through Vite rather than Babel, but Vite accepts arbitrary
 * transforms — so this runs the *same* Babel plugin the Jest side uses, with no
 * changes to it. The plugin's own `shouldInstrumentFile` still decides what gets
 * instrumented, which keeps JEST_LINEAGE_ENABLED / INCLUDE / EXCLUDE meaning the
 * same thing on both runners.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const SOURCE = /\.(?:m|c)?[jt]sx?$/;

export function lineageTracker(options = {}) {
  const babel = require("@babel/core");
  const lineagePlugin = require("../babel-plugin-lineage-tracker.js");

  // Vite tells us the project root; pinning every recorded path to it is what
  // makes monorepos work, where the nearest package.json differs per package
  // but the reporter runs from one place.
  let projectRoot = options.projectRoot || null;

  return {
    name: "jest-test-lineage-reporter",
    // `pre`, so Babel sees the original TypeScript and records the line numbers
    // a human (and the mutation tester, which edits the file on disk) would
    // recognise. Running after Vite's transform instead would be cheaper —
    // Babel would need no TypeScript preset — but esbuild strips interfaces and
    // type declarations outright, collapsing zod's checks.ts from 1,207 lines to
    // 518. Every line number recorded that way points at the wrong statement.
    enforce: "pre",

    configResolved(config) {
      if (!projectRoot) projectRoot = config.root || process.cwd();
    },
    apply: "serve",

    async transform(code, id) {
      const file = id.split("?")[0];
      if (!SOURCE.test(file)) return null;
      if (file.includes("/node_modules/")) return null;

      const isTSX = /\.tsx$/.test(file);
      const result = await babel.transformAsync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        // Parse types rather than choke on them. Only the syntax is stripped;
        // module syntax is left alone for Vite to handle.
        presets: [
          [
            require.resolve("@babel/preset-typescript"),
            { isTSX, allExtensions: true, onlyRemoveTypeImports: true },
          ],
        ],
        // Keep the original line numbers meaningful in stack traces; the
        // reporter reports on line numbers, so these must stay honest.
        sourceMaps: true,
        plugins: [
          [
            lineagePlugin,
            { ...(options.babel || {}), projectRoot: projectRoot || process.cwd() },
          ],
        ],
      });

      if (!result || result.code === code) return null;
      return { code: result.code, map: result.map };
    },
  };
}

export default lineageTracker;
