/**
 * Lineage data store.
 *
 * Test records are written append-only, one JSON object per line (JSONL), into
 * per-process shard files under `.jest-lineage-shards/`. Nothing is ever
 * read-modify-written while tests run, which means:
 *
 *   - writing N tests costs O(N) IO instead of O(N^2),
 *   - no single JSON document has to be parsed mid-run, so runs no longer hit
 *     V8's ~512MB max string length after a few hundred tests, and
 *   - concurrent Jest workers cannot lose each other's records, because each
 *     process owns its own shard file.
 *
 * The shards are merged into the canonical `.jest-lineage-data.json` once, at
 * the end of the run, so every existing consumer keeps working unchanged.
 *
 * A logical test run is not always one Jest process: harnesses commonly rerun a
 * failed suite in a second process and report the aggregate. Shards therefore
 * survive across processes that belong to the same run — see `prepareRun`.
 */

const fs = require("fs");
const path = require("path");
const { StringDecoder } = require("string_decoder");
const logger = require("./logger");

const SHARD_DIR_NAME = ".jest-lineage-shards";
const DEFAULT_DATA_FILE = ".jest-lineage-data.json";

/** V8 refuses to create strings beyond ~512MB; stay well clear of the edge. */
const MAX_SAFE_JSON_BYTES = 384 * 1024 * 1024;

/**
 * How recently a shard must have been written to count as part of the run now
 * starting, when no explicit run id is given. A harness that reruns a failed
 * suite starts the second process seconds after the first one ends, so anything
 * touched inside this window is treated as a continuation rather than leftovers.
 */
const DEFAULT_RUN_GAP_SECONDS = 120;

/** Separates the run id from the process part of a shard filename. */
const RUN_ID_SEPARATOR = "__";

function getShardDir(cwd = process.cwd()) {
  return path.join(cwd, SHARD_DIR_NAME);
}

/**
 * The caller's run id, if it set one.
 *
 * Setting `JEST_LINEAGE_RUN_ID` to the same value for every Jest process in one
 * logical run is the exact way to say which shards belong together — no
 * timing heuristic involved. Harnesses that rerun failed suites should use it.
 */
function getRunId() {
  const raw = process.env.JEST_LINEAGE_RUN_ID;
  if (!raw) return null;
  const clean = String(raw).replace(/[^A-Za-z0-9_.-]/g, "");
  return clean || null;
}

function getRunGapMs() {
  const raw = process.env.JEST_LINEAGE_RUN_GAP;
  if (raw === undefined || raw === "") return DEFAULT_RUN_GAP_SECONDS * 1000;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) {
    logger.warn(
      `⚠️  jest-lineage: ignoring JEST_LINEAGE_RUN_GAP=${raw} — expected a number of seconds.`,
    );
    return DEFAULT_RUN_GAP_SECONDS * 1000;
  }
  return seconds * 1000;
}

/** The run id a shard file was written under, or null when it carries none. */
function shardRunId(shardFile) {
  const base = path.basename(shardFile);
  const at = base.indexOf(RUN_ID_SEPARATOR);
  return at === -1 ? null : base.slice(0, at);
}

/**
 * Merge key for a test record.
 *
 * Keyed on the spec file as well as the `it` name: identically named `it`
 * blocks in different spec files are different tests, and keying on the name
 * alone silently drops one of them.
 */
function testKey(record) {
  return `${record.testFile || "unknown"}::${record.name}`;
}

/** Convert a live test record (coverage held in a Map) into its serializable form. */
function serializeTestRecord(testData) {
  return {
    name: testData.name,
    type: testData.type,
    testFile: testData.testFile,
    duration: testData.duration,
    // Stamped so that when a test is recorded more than once — a harness
    // rerunning a failed suite — the merge can keep the later attempt rather
    // than whichever shard happened to sort last.
    recordedAt: testData.recordedAt || Date.now(),
    coverage:
      testData.coverage instanceof Map
        ? Object.fromEntries(testData.coverage)
        : testData.coverage || {},
    qualityMetrics: testData.qualityMetrics || {
      assertions: 0,
      asyncOperations: 0,
      mockUsage: 0,
      errorHandling: 0,
      edgeCases: 0,
      complexity: 0,
      maintainability: 50,
      reliability: 50,
      testSmells: [],
      codePatterns: [],
      isolationScore: 100,
      testLength: 0,
    },
  };
}

/** cwd -> this process's shard file for that cwd. */
const shardPaths = new Map();

/** Path of the shard file owned by this process (one per process, never shared). */
function getShardPath(cwd = process.cwd()) {
  const cached = shardPaths.get(cwd);
  if (cached) return cached;

  const dir = getShardDir(cwd);
  fs.mkdirSync(dir, { recursive: true });

  const worker = process.env.JEST_WORKER_ID || "0";
  const unique = Math.random().toString(36).slice(2, 8);
  const runId = getRunId() || "";
  const shardPath = path.join(
    dir,
    `${runId}${RUN_ID_SEPARATOR}w${worker}-${process.pid}-${unique}.jsonl`,
  );
  shardPaths.set(cwd, shardPath);
  return shardPath;
}

/**
 * Append one test record to this process's shard. Never reads anything back.
 * @returns {boolean} true when the record was persisted
 */
function appendTestRecord(testData, cwd = process.cwd()) {
  try {
    const line = JSON.stringify(serializeTestRecord(testData)) + "\n";
    try {
      fs.appendFileSync(getShardPath(cwd), line);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      // The shard directory went away mid-run; recreate it and take a new shard.
      shardPaths.delete(cwd);
      fs.appendFileSync(getShardPath(cwd), line);
    }
    return true;
  } catch (error) {
    logger.warn(
      `⚠️  jest-lineage: failed to record test "${testData && testData.name}" — ` +
        `this test will be MISSING from the lineage report: ${error.message}`,
    );
    return false;
  }
}

function listShardFiles(cwd = process.cwd()) {
  const dir = getShardDir(cwd);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .map((f) => path.join(dir, f));
}

function hasShards(cwd = process.cwd()) {
  return listShardFiles(cwd).length > 0;
}

/** Remove every shard, whatever run it belongs to. */
function clearShards(cwd = process.cwd()) {
  const dir = getShardDir(cwd);
  shardPaths.delete(cwd);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn(
      `⚠️  jest-lineage: could not clear ${SHARD_DIR_NAME}: ${error.message}. ` +
        `Stale records from a previous run may appear in this report.`,
    );
  }
}

/**
 * Decide which existing shards belong to the run that is starting, and delete
 * the rest. Called once per Jest process, before anything is written.
 *
 * One logical test run is not always one Jest process. A harness that reruns a
 * failed suite spawns a second Jest process and reports the aggregate of both,
 * so wiping the directory on every process start would throw away the first
 * process's tests and silently report only the retried ones.
 *
 * Two ways a shard is recognised as part of this run:
 *   - it carries the same `JEST_LINEAGE_RUN_ID` (exact, and what a harness
 *     should use), or
 *   - no run id is set and it was written within `JEST_LINEAGE_RUN_GAP`
 *     seconds, which covers the rerun case without the caller doing anything.
 *
 * `JEST_LINEAGE_RUN_GAP=0` restores "every process starts clean".
 */
function prepareRun(cwd = process.cwd()) {
  shardPaths.delete(cwd);

  const files = listShardFiles(cwd);
  if (files.length === 0) return { kept: 0, removed: 0 };

  const runId = getRunId();
  const gapMs = getRunGapMs();
  const now = Date.now();

  const kept = [];
  const removed = [];
  let newestKeptAge = Infinity;

  for (const file of files) {
    let belongsToThisRun;
    let age = Infinity;
    if (runId) {
      belongsToThisRun = shardRunId(file) === runId;
    } else {
      try {
        // Clamped at zero: the filesystem records mtime with sub-millisecond
        // precision while Date.now() truncates to whole milliseconds, so a
        // shard written moments ago can read as very slightly in the future.
        // A negative age would satisfy any gap, including a gap of 0.
        age = Math.max(0, now - fs.statSync(file).mtimeMs);
      } catch (e) {
        age = Infinity;
      }
      // Strictly less-than: JEST_LINEAGE_RUN_GAP=0 means "start clean every
      // time", and `<=` would keep a shard written in the same millisecond.
      belongsToThisRun = age < gapMs;
    }

    if (belongsToThisRun) {
      kept.push(file);
      newestKeptAge = Math.min(newestKeptAge, age);
    } else {
      removed.push(file);
    }
  }

  for (const file of removed) {
    try {
      fs.rmSync(file, { force: true });
    } catch (error) {
      logger.warn(
        `⚠️  jest-lineage: could not remove stale shard ${path.basename(file)}: ` +
          `${error.message}. Records from a previous run may appear in this report.`,
      );
    }
  }

  if (kept.length > 0) {
    const why = runId
      ? `they carry JEST_LINEAGE_RUN_ID=${runId}`
      : `they were written ${(newestKeptAge / 1000).toFixed(0)}s ago, within ` +
        `JEST_LINEAGE_RUN_GAP=${gapMs / 1000}s`;
    logger.info(
      `↩️  Carrying ${kept.length} existing lineage shard(s) into this run — ${why}. ` +
        `Their tests stay in the report alongside this run's.`,
    );
  }

  return { kept: kept.length, removed: removed.length };
}

/**
 * Read a file line by line without ever materialising it as one string, so
 * arbitrarily large shard files stay readable.
 */
function forEachLine(filePath, onLine) {
  const CHUNK = 1 << 20;
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(CHUNK);
  const decoder = new StringDecoder("utf8");
  let carry = "";
  let index = 0;

  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK, null)) > 0) {
      carry += decoder.write(buffer.subarray(0, bytesRead));
      let nl;
      while ((nl = carry.indexOf("\n")) !== -1) {
        const line = carry.slice(0, nl);
        carry = carry.slice(nl + 1);
        if (line.length > 0) onLine(line, index);
        index += 1;
      }
    }
    carry += decoder.end();
    if (carry.length > 0) onLine(carry, index);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * First pass over the shards: work out which raw line wins for each test.
 * Only keys and line coordinates are held in memory, never the coverage
 * payloads, so this stays cheap no matter how large the shards are.
 */
function indexShards(cwd = process.cwd()) {
  const files = listShardFiles(cwd);
  const winners = new Map();
  let totalLines = 0;
  let corruptLines = 0;

  files.forEach((file, fileIndex) => {
    forEachLine(file, (line, lineIndex) => {
      totalLines += 1;
      let record;
      try {
        record = JSON.parse(line);
      } catch (e) {
        corruptLines += 1;
        return;
      }
      if (!record || !record.name) {
        corruptLines += 1;
        return;
      }

      // The same test can be recorded more than once — a harness rerunning a
      // failed suite. The later attempt is the true result, and shard filenames
      // say nothing about order, so compare the stamps rather than position.
      const key = testKey(record);
      const recordedAt = Number(record.recordedAt) || 0;
      const previous = winners.get(key);
      if (previous && previous.recordedAt > recordedAt) return;

      winners.set(key, { fileIndex, lineIndex, recordedAt });
    });
  });

  if (corruptLines > 0) {
    logger.warn(
      `⚠️  jest-lineage: skipped ${corruptLines} unreadable record(s) in ${SHARD_DIR_NAME}. ` +
        `The report is missing those tests.`,
    );
  }

  return { files, winners, totalLines, corruptLines };
}

/** Yield each surviving test record, one at a time, in shard order. */
function forEachMergedRecord(cwd = process.cwd(), onRecord) {
  const { files, winners } = indexShards(cwd);

  const wanted = new Map();
  for (const { fileIndex, lineIndex } of winners.values()) {
    if (!wanted.has(fileIndex)) wanted.set(fileIndex, new Set());
    wanted.get(fileIndex).add(lineIndex);
  }

  files.forEach((file, fileIndex) => {
    const lines = wanted.get(fileIndex);
    if (!lines || lines.size === 0) return;
    forEachLine(file, (line, lineIndex) => {
      if (!lines.has(lineIndex)) return;
      try {
        onRecord(JSON.parse(line));
      } catch (e) {
        /* already counted as corrupt during indexing */
      }
    });
  });

  return winners.size;
}

/** Merge the shards into an in-memory array. Prefer forEachMergedRecord for large runs. */
function readMergedRecords(cwd = process.cwd()) {
  const records = [];
  forEachMergedRecord(cwd, (record) => records.push(record));
  return records;
}

/**
 * Merge the shards into the canonical `.jest-lineage-data.json`.
 *
 * The output is streamed record by record rather than built with a single
 * JSON.stringify, so producing the file cannot hit the max-string-length wall
 * that reading the accumulated file used to hit mid-run.
 *
 * @returns {{ written: number, duplicates: number, bytes: number } | null}
 */
function writeMergedData(cwd = process.cwd(), dataFile = DEFAULT_DATA_FILE) {
  const { files, winners, totalLines, corruptLines } = indexShards(cwd);

  if (winners.size === 0) {
    if (totalLines > 0 || corruptLines > 0) {
      logger.warn(
        `⚠️  jest-lineage: found ${totalLines} raw record(s) but none were usable; ` +
          `${dataFile} was not written.`,
      );
    }
    return null;
  }

  const wanted = new Map();
  for (const { fileIndex, lineIndex } of winners.values()) {
    if (!wanted.has(fileIndex)) wanted.set(fileIndex, new Set());
    wanted.get(fileIndex).add(lineIndex);
  }

  const outPath = path.isAbsolute(dataFile)
    ? dataFile
    : path.join(cwd, dataFile);
  const tmpPath = `${outPath}.tmp`;
  const fd = fs.openSync(tmpPath, "w");
  let written = 0;
  let bytes = 0;

  const write = (chunk) => {
    fs.writeSync(fd, chunk);
    bytes += Buffer.byteLength(chunk);
  };

  try {
    write(`{\n  "timestamp": ${Date.now()},\n  "tests": [\n`);
    files.forEach((file, fileIndex) => {
      const lines = wanted.get(fileIndex);
      if (!lines || lines.size === 0) return;
      forEachLine(file, (line, lineIndex) => {
        if (!lines.has(lineIndex)) return;
        write(written === 0 ? `    ${line}` : `,\n    ${line}`);
        written += 1;
      });
    });
    write(`\n  ]\n}\n`);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tmpPath, outPath);

  const duplicates = totalLines - corruptLines - winners.size;
  if (bytes > MAX_SAFE_JSON_BYTES) {
    logger.warn(
      `⚠️  jest-lineage: ${dataFile} is ${(bytes / 1024 / 1024).toFixed(0)}MB. ` +
        `Tools that JSON.parse it in one go may fail on files this large. ` +
        `Set JEST_LINEAGE_INCLUDE to instrument only the code under test.`,
    );
  }

  return { written, duplicates, bytes };
}

/**
 * Fold leftover shards into `dataFile` when they are newer than it.
 *
 * The reporter merges at the end of the run; this is the safety net for runs
 * where the reporter was not registered, or where the run was interrupted
 * before it got a chance to.
 *
 * @returns {boolean} true when a merge was performed
 */
function mergeShardsIfNewer(dataFile = DEFAULT_DATA_FILE, cwd = process.cwd()) {
  const shards = listShardFiles(cwd);
  if (shards.length === 0) return false;

  const outPath = path.isAbsolute(dataFile)
    ? dataFile
    : path.join(cwd, dataFile);

  const shardMtime = shards.reduce(
    (newest, file) => Math.max(newest, fs.statSync(file).mtimeMs),
    -Infinity,
  );
  const dataMtime = fs.existsSync(outPath)
    ? fs.statSync(outPath).mtimeMs
    : -Infinity;

  if (shardMtime <= dataMtime) return false;

  writeMergedData(cwd, outPath);
  return true;
}

module.exports = {
  SHARD_DIR_NAME,
  DEFAULT_DATA_FILE,
  MAX_SAFE_JSON_BYTES,
  getShardDir,
  getShardPath,
  testKey,
  serializeTestRecord,
  appendTestRecord,
  listShardFiles,
  hasShards,
  clearShards,
  prepareRun,
  getRunId,
  shardRunId,
  forEachLine,
  forEachMergedRecord,
  readMergedRecords,
  writeMergedData,
  mergeShardsIfNewer,
};
