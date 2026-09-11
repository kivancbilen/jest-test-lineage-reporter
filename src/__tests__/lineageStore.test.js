const fs = require("fs");
const os = require("os");
const path = require("path");

const lineageStore = require("../lineageStore");

/** Each test gets its own cwd-like directory so shard state never leaks between them. */
function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lineage-store-"));
}

function record(name, testFile, coverage) {
  return {
    name,
    type: "it",
    testFile,
    duration: 1,
    coverage: new Map(Object.entries(coverage)),
  };
}

function shardPath(cwd, fileName) {
  const dir = lineageStore.getShardDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}

/** Write records straight into a named shard, standing in for a worker process. */
function writeShard(cwd, fileName, records) {
  const lines = records
    .map((r) => JSON.stringify(lineageStore.serializeTestRecord(r)))
    .join("\n");
  fs.writeFileSync(shardPath(cwd, fileName), lines + "\n");
}

function readData(cwd) {
  return JSON.parse(
    fs.readFileSync(path.join(cwd, ".jest-lineage-data.json"), "utf8"),
  );
}

describe("lineageStore merge key", () => {
  it("keeps identically named tests from different spec files apart", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("should respect pageSize", "a.spec.ts", { "src/a.ts:1": 1 }),
      record("should respect pageSize", "b.spec.ts", { "src/b.ts:2": 1 }),
    ]);

    const merged = lineageStore.readMergedRecords(cwd);

    expect(merged).toHaveLength(2);
    expect(merged.map((t) => t.testFile).sort()).toEqual([
      "a.spec.ts",
      "b.spec.ts",
    ]);
  });

  it("keeps the latest record when the same test is written twice", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("same test", "a.spec.ts", { "src/a.ts:1": 1 }),
      record("same test", "a.spec.ts", { "src/a.ts:9": 1 }),
    ]);

    const merged = lineageStore.readMergedRecords(cwd);

    expect(merged).toHaveLength(1);
    expect(Object.keys(merged[0].coverage)).toEqual(["src/a.ts:9"]);
  });

  it("builds the merge key from both the spec file and the test name", () => {
    expect(lineageStore.testKey({ name: "n", testFile: "f.spec.ts" })).toBe(
      "f.spec.ts::n",
    );
    expect(lineageStore.testKey({ name: "n" })).toBe("unknown::n");
  });
});

describe("lineageStore shard isolation", () => {
  it("merges records from every worker shard", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);
    writeShard(cwd, "w2.jsonl", [
      record("t2", "b.spec.ts", { "src/b.ts:1": 1 }),
    ]);

    expect(lineageStore.readMergedRecords(cwd).map((t) => t.name).sort()).toEqual(
      ["t1", "t2"],
    );
  });

  it("appends without reading the accumulated data back", () => {
    const cwd = makeWorkspace();
    const readSpy = jest.spyOn(fs, "readFileSync");

    try {
      for (let i = 0; i < 5; i++) {
        lineageStore.appendTestRecord(
          record(`t${i}`, "a.spec.ts", { "src/a.ts:1": 1 }),
          cwd,
        );
      }
      expect(readSpy).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
    }

    // The records went to this workspace, not to whichever shard this process
    // opened first.
    expect(lineageStore.readMergedRecords(cwd).map((t) => t.name)).toEqual([
      "t0",
      "t1",
      "t2",
      "t3",
      "t4",
    ]);

    lineageStore.clearShards(cwd);
    expect(lineageStore.hasShards(cwd)).toBe(false);
  });

  it("gives each workspace its own shard", () => {
    const a = makeWorkspace();
    const b = makeWorkspace();

    lineageStore.appendTestRecord(record("ta", "a.spec.ts", {}), a);
    lineageStore.appendTestRecord(record("tb", "b.spec.ts", {}), b);

    expect(lineageStore.readMergedRecords(a).map((t) => t.name)).toEqual(["ta"]);
    expect(lineageStore.readMergedRecords(b).map((t) => t.name)).toEqual(["tb"]);
  });

  it("clears every shard when asked to clear outright", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("old", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);

    lineageStore.clearShards(cwd);

    expect(lineageStore.hasShards(cwd)).toBe(false);
    expect(lineageStore.readMergedRecords(cwd)).toEqual([]);
  });
});

describe("lineageStore corrupt records", () => {
  it("reports unreadable records instead of silently dropping the whole file", () => {
    const cwd = makeWorkspace();
    const good = JSON.stringify(
      lineageStore.serializeTestRecord(
        record("good", "a.spec.ts", { "src/a.ts:1": 1 }),
      ),
    );
    fs.writeFileSync(shardPath(cwd, "w1.jsonl"), `${good}\n{ truncated\n`);

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const merged = lineageStore.readMergedRecords(cwd);

      expect(merged.map((t) => t.name)).toEqual(["good"]);
      expect(warn).toHaveBeenCalled();
      expect(warn.mock.calls.flat().join(" ")).toMatch(/unreadable record/);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("lineageStore writeMergedData", () => {
  it("writes the JSON shape downstream tools expect", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 2 }),
      record("t1", "b.spec.ts", { "src/b.ts:1": 1 }),
    ]);

    const result = lineageStore.writeMergedData(cwd);
    const data = readData(cwd);

    expect(result.written).toBe(2);
    expect(typeof data.timestamp).toBe("number");
    expect(data.tests).toHaveLength(2);
    expect(data.tests[0]).toMatchObject({
      name: "t1",
      type: "it",
      testFile: "a.spec.ts",
      coverage: { "src/a.ts:1": 2 },
    });
    expect(data.tests[0].qualityMetrics).toBeDefined();
  });

  it("counts superseded re-runs as duplicates", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
      record("t1", "a.spec.ts", { "src/a.ts:2": 1 }),
    ]);

    expect(lineageStore.writeMergedData(cwd)).toMatchObject({
      written: 1,
      duplicates: 1,
    });
  });

  it("writes nothing when there is nothing to merge", () => {
    const cwd = makeWorkspace();
    expect(lineageStore.writeMergedData(cwd)).toBeNull();
    expect(fs.existsSync(path.join(cwd, ".jest-lineage-data.json"))).toBe(false);
  });

  it("only re-merges when the shards are newer than the data file", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "w1.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);

    expect(lineageStore.mergeShardsIfNewer(".jest-lineage-data.json", cwd)).toBe(
      true,
    );
    expect(lineageStore.mergeShardsIfNewer(".jest-lineage-data.json", cwd)).toBe(
      false,
    );
  });
});

describe("lineageStore forEachLine", () => {
  it("reads lines larger than one read chunk", () => {
    const cwd = makeWorkspace();
    const file = shardPath(cwd, "big.jsonl");
    const long = "x".repeat(3 * 1024 * 1024);
    fs.writeFileSync(file, `${long}\nshort\n`);

    const seen = [];
    lineageStore.forEachLine(file, (line) => seen.push(line.length));

    expect(seen).toEqual([long.length, "short".length]);
  });

  it("does not split multi-byte characters across chunk boundaries", () => {
    const cwd = makeWorkspace();
    const file = shardPath(cwd, "utf8.jsonl");
    // "é" is two bytes, so some copy of it must straddle a 1MiB read boundary.
    const value = "é".repeat(1024 * 1024);
    fs.writeFileSync(file, `${value}\n`);

    const seen = [];
    lineageStore.forEachLine(file, (line) => seen.push(line));

    expect(seen).toEqual([value]);
  });
});

describe("lineageStore prepareRun", () => {
  const saved = {
    runId: process.env.JEST_LINEAGE_RUN_ID,
    gap: process.env.JEST_LINEAGE_RUN_GAP,
  };

  afterEach(() => {
    delete process.env.JEST_LINEAGE_RUN_ID;
    delete process.env.JEST_LINEAGE_RUN_GAP;
    if (saved.runId !== undefined) process.env.JEST_LINEAGE_RUN_ID = saved.runId;
    if (saved.gap !== undefined) process.env.JEST_LINEAGE_RUN_GAP = saved.gap;
  });

  /** Backdate a shard so it looks like it came from an earlier run. */
  function ageShards(cwd, seconds) {
    const when = new Date(Date.now() - seconds * 1000);
    lineageStore.listShardFiles(cwd).forEach((f) => fs.utimesSync(f, when, when));
  }

  it("keeps shards from a rerun spawn that starts moments later", () => {
    const cwd = makeWorkspace();
    // Spawn 1: the whole suite.
    writeShard(cwd, "__w1-1-aaa.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
      record("t2", "a.spec.ts", { "src/a.ts:2": 1 }),
      record("t3", "b.spec.ts", { "src/b.ts:1": 1 }),
    ]);

    // Spawn 2: the harness reruns the one suite that failed.
    expect(lineageStore.prepareRun(cwd)).toEqual({ kept: 1, removed: 0 });
    writeShard(cwd, "__w1-2-bbb.jsonl", [
      record("t3", "b.spec.ts", { "src/b.ts:1": 1, "src/b.ts:2": 1 }),
    ]);

    const merged = lineageStore.readMergedRecords(cwd);
    expect(merged.map((t) => t.name).sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("removes shards left over from an earlier run", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "__w1-1-aaa.jsonl", [
      record("old", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);
    ageShards(cwd, 600);

    expect(lineageStore.prepareRun(cwd)).toEqual({ kept: 0, removed: 1 });
    expect(lineageStore.readMergedRecords(cwd)).toEqual([]);
  });

  it("honours JEST_LINEAGE_RUN_GAP=0 as start-clean-every-time", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "__w1-1-aaa.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);
    process.env.JEST_LINEAGE_RUN_GAP = "0";

    expect(lineageStore.prepareRun(cwd)).toEqual({ kept: 0, removed: 1 });
  });

  it("keeps shards carrying the same run id however old they are", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "run7__w1-1-aaa.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);
    ageShards(cwd, 86400);
    process.env.JEST_LINEAGE_RUN_ID = "run7";

    expect(lineageStore.prepareRun(cwd)).toEqual({ kept: 1, removed: 0 });
  });

  it("drops shards from a different run id however recent they are", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "run6__w1-1-aaa.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);
    process.env.JEST_LINEAGE_RUN_ID = "run7";

    expect(lineageStore.prepareRun(cwd)).toEqual({ kept: 0, removed: 1 });
  });

  it("writes this run's id into the shard filename", () => {
    const cwd = makeWorkspace();
    process.env.JEST_LINEAGE_RUN_ID = "run7";

    lineageStore.appendTestRecord(record("t1", "a.spec.ts", {}), cwd);

    const [shard] = lineageStore.listShardFiles(cwd);
    expect(lineageStore.shardRunId(shard)).toBe("run7");
  });

  it("says so when it carries shards forward, rather than doing it silently", () => {
    const cwd = makeWorkspace();
    writeShard(cwd, "__w1-1-aaa.jsonl", [
      record("t1", "a.spec.ts", { "src/a.ts:1": 1 }),
    ]);

    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      lineageStore.prepareRun(cwd);
      expect(log.mock.calls.flat().join(" ")).toMatch(
        /Carrying 1 existing lineage shard/,
      );
    } finally {
      log.mockRestore();
    }
  });
});

describe("lineageStore rerun records", () => {
  it("keeps the later attempt when a test is recorded twice", () => {
    const cwd = makeWorkspace();
    const first = record("t1", "a.spec.ts", { "src/a.ts:1": 1 });
    first.recordedAt = 1000;
    const second = record("t1", "a.spec.ts", { "src/a.ts:2": 1 });
    second.recordedAt = 2000;

    // Written so that the *earlier* attempt sorts last, which is what a
    // position-based merge would wrongly pick.
    writeShard(cwd, "__w1-2-zzz.jsonl", [first]);
    writeShard(cwd, "__w1-1-aaa.jsonl", [second]);

    const merged = lineageStore.readMergedRecords(cwd);
    expect(merged).toHaveLength(1);
    expect(Object.keys(merged[0].coverage)).toEqual(["src/a.ts:2"]);
  });

  it("stamps every record it writes", () => {
    const cwd = makeWorkspace();
    const before = Date.now();
    lineageStore.appendTestRecord(record("t1", "a.spec.ts", {}), cwd);

    const [merged] = lineageStore.readMergedRecords(cwd);
    expect(merged.recordedAt).toBeGreaterThanOrEqual(before);
    expect(merged.recordedAt).toBeLessThanOrEqual(Date.now());
  });
});
