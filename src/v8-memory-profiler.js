/**
 * V8 Allocation Sampling Profiler
 *
 * Uses the Node.js inspector module to track heap allocations with
 * per-callsite granularity. Unlike process.memoryUsage() snapshots,
 * this tracks actual allocations and is immune to GC noise.
 *
 * Usage:
 *   startSampling()          — call once at the start of a test
 *   stopSampling()           — call at the end; returns the allocation profile
 *   getLineAllocations(...)  — extract bytes allocated by a specific source line
 */

const inspector = require("inspector");

let session = null;
let isActive = false;

/**
 * Start heap allocation sampling.
 * @param {number} [samplingInterval=512] — sample every N bytes allocated.
 *   Lower values give more accuracy but higher overhead.
 */
function startSampling(samplingInterval = 512) {
  if (isActive) return;

  if (!session) {
    session = new inspector.Session();
    session.connect();
  }

  session.post("HeapProfiler.startSampling", {
    samplingInterval,
  });
  isActive = true;
}

/**
 * Stop sampling and return the allocation profile.
 * @returns {Promise<object|null>} The AllocationProfile tree, or null on error.
 */
function stopSampling() {
  if (!isActive) return Promise.resolve(null);

  return new Promise((resolve) => {
    session.post("HeapProfiler.stopSampling", (err, result) => {
      isActive = false;
      if (err) {
        resolve(null);
        return;
      }
      resolve(result.profile);
    });
  });
}

/**
 * Walk an allocation profile and sum bytes attributed to a specific file+line.
 *
 * @param {object} profile — the profile returned by stopSampling()
 * @param {string} targetFile — substring to match against callFrame.url
 *   (e.g. "formatters.ts" or a full path)
 * @param {number} targetLine — 0-based line number in the V8 profile
 *   (source lines are 1-based, so subtract 1 before calling)
 * @returns {number} total bytes allocated at that location
 */
function getLineAllocations(profile, targetFile, targetLine) {
  if (!profile || !profile.head) return 0;

  let totalBytes = 0;

  function walk(node) {
    const cf = node.callFrame;
    if (
      cf &&
      cf.url &&
      cf.url.includes(targetFile) &&
      cf.lineNumber === targetLine
    ) {
      totalBytes += node.selfSize || 0;
    }
    for (const child of node.children || []) {
      walk(child);
    }
  }

  walk(profile.head);
  return totalBytes;
}

/**
 * Extract all allocations from a profile grouped by file:line.
 *
 * @param {object} profile — the profile returned by stopSampling()
 * @returns {Map<string, number>} Map of "filePath:lineNumber" → bytes
 */
function getAllAllocations(profile, sourceFilter) {
  const allocations = new Map();
  if (!profile || !profile.head) return allocations;

  function walk(node) {
    const cf = node.callFrame;
    if (cf && cf.url && node.selfSize > 0) {
      // Skip internal/native frames, node_modules, and test infrastructure
      if (
        !cf.url.startsWith("node:") &&
        cf.url !== "(native)" &&
        !cf.url.includes("node_modules") &&
        !cf.url.includes("testSetup") &&
        !cf.url.includes("v8-memory-profiler") &&
        !cf.url.includes("__tests__") &&
        !cf.url.includes(".test.") &&
        !cf.url.includes(".spec.") &&
        (!sourceFilter || cf.url.includes(sourceFilter))
      ) {
        // V8 lineNumber is 0-based; convert to 1-based for our format
        const key = `${cf.url}:${cf.lineNumber + 1}`;
        allocations.set(key, (allocations.get(key) || 0) + node.selfSize);
      }
    }
    for (const child of node.children || []) {
      walk(child);
    }
  }

  walk(profile.head);
  return allocations;
}

/**
 * Clean up the inspector session.
 */
function dispose() {
  if (session) {
    if (isActive) {
      try {
        session.post("HeapProfiler.stopSampling");
      } catch (_) {
        // ignore
      }
      isActive = false;
    }
    session.disconnect();
    session = null;
  }
}

module.exports = {
  startSampling,
  stopSampling,
  getLineAllocations,
  getAllAllocations,
  dispose,
};
