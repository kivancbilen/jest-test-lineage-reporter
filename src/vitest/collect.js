/**
 * Turns the lineage Vitest carried back on `task.meta` into the coverageData
 * shape OverlapAnalyzer and the HTML report already consume:
 *
 *   { "src/a.ts": { "12": [{ name, file, duration }] } }
 *
 * This is the only genuinely runner-specific logic in the Vitest adapter, so it
 * lives here in plain CommonJS where the test suite can reach it.
 */

/** Walk a module's tests, whatever nesting its suites use. */
function* eachTest(node) {
  if (!node || !node.children) return;
  // Vitest's children collection is iterable; `allTests()` exists too but is
  // not present on every node type, so recurse rather than depend on it.
  for (const child of node.children) {
    if (!child) continue;
    if (child.type === "test") yield child;
    else if (child.children) yield* eachTest(child);
  }
}

/**
 * @param {Iterable} testModules  as handed to `onTestRunEnd`
 * @returns {{coverageData: object, testsSeen: number}}
 */
function collectCoverageData(testModules) {
  const coverageData = {};
  let testsSeen = 0;

  for (const testModule of testModules || []) {
    const testFile = testModule && testModule.moduleId;

    for (const test of eachTest(testModule)) {
      const meta = typeof test.meta === "function" ? test.meta() : test.meta;
      const lineage = meta && meta.lineage;
      if (!lineage) continue;
      testsSeen++;

      let duration = 0;
      try {
        duration = (test.diagnostic && test.diagnostic().duration) || 0;
      } catch {
        duration = 0;
      }

      for (const lineKey of Object.keys(lineage)) {
        // `file:line` — split on the last colon so Windows drive letters and
        // absolute paths survive intact.
        const idx = lineKey.lastIndexOf(":");
        if (idx <= 0) continue;
        const filePath = lineKey.slice(0, idx);
        const lineNumber = lineKey.slice(idx + 1);
        if (!filePath || !lineNumber) continue;

        const lines = (coverageData[filePath] = coverageData[filePath] || {});
        const entries = (lines[lineNumber] = lines[lineNumber] || []);
        entries.push({ name: test.name, file: testFile, duration });
      }
    }
  }

  return { coverageData, testsSeen };
}

module.exports = { collectCoverageData, eachTest };
