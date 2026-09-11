/**
 * Vitest setup file: the runtime half of lineage tracking.
 *
 * The instrumented code calls `globalThis.__TRACK_LINE_EXECUTION__` — the same
 * one-function contract the Jest side uses. What differs is how the current test
 * is identified. On Jest this means monkey-patching `it`/`test` and digging
 * `testPath` out of `expect.getState()`; Vitest hands the test straight to the
 * hook, and `task.meta` is its own worker-to-reporter channel, serialised for us.
 */
import { beforeEach, afterEach } from "vitest";

const DISABLED =
  process.env.JEST_LINEAGE_ENABLED === "false" ||
  process.env.JEST_LINEAGE_TRACKING === "false";

/** Lines executed by the test currently running, or null between tests. */
let current = null;

globalThis.__TRACK_LINE_EXECUTION__ = function (filePath, lineNumber) {
  if (!current) return;
  const key = `${filePath}:${lineNumber}`;
  current.set(key, (current.get(key) || 0) + 1);
};

if (!DISABLED) {
  beforeEach(() => {
    current = new Map();
  });

  afterEach((ctx) => {
    const lines = current;
    current = null;
    if (!lines || lines.size === 0 || !ctx || !ctx.task) return;
    // Vitest serialises `task.meta` back to the reporter process for us, so the
    // shard files the Jest side needs are unnecessary here.
    ctx.task.meta.lineage = Object.fromEntries(lines);
  });
}
