const { collectCoverageData } = require("../vitest/collect");

/** Stands in for Vitest's TestCase: `meta()` and `diagnostic()` are methods. */
function test_(name, lineage, duration = 10) {
  return {
    type: "test",
    name,
    meta: () => (lineage ? { lineage } : {}),
    diagnostic: () => ({ duration }),
  };
}

function suite(name, children) {
  return { type: "suite", name, children };
}

function module_(moduleId, children) {
  return { type: "module", moduleId, children };
}

describe("collectCoverageData", () => {
  it("builds the coverageData shape the analyzer consumes", () => {
    const { coverageData, testsSeen } = collectCoverageData([
      module_("/repo/a.test.ts", [
        test_("adds", { "/repo/src/calc.ts:2": 1, "/repo/src/calc.ts:3": 2 }),
      ]),
    ]);

    expect(testsSeen).toBe(1);
    expect(coverageData).toEqual({
      "/repo/src/calc.ts": {
        2: [{ name: "adds", file: "/repo/a.test.ts", duration: 10 }],
        3: [{ name: "adds", file: "/repo/a.test.ts", duration: 10 }],
      },
    });
  });

  it("finds tests nested inside suites", () => {
    const { testsSeen } = collectCoverageData([
      module_("/repo/a.test.ts", [
        suite("outer", [
          suite("inner", [test_("deep", { "/repo/src/a.ts:1": 1 })]),
        ]),
      ]),
    ]);

    expect(testsSeen).toBe(1);
  });

  it("merges the same line reached by several tests", () => {
    const { coverageData } = collectCoverageData([
      module_("/repo/a.test.ts", [
        test_("one", { "/repo/src/a.ts:7": 1 }),
        test_("two", { "/repo/src/a.ts:7": 1 }),
      ]),
    ]);

    expect(coverageData["/repo/src/a.ts"][7].map((e) => e.name)).toEqual([
      "one",
      "two",
    ]);
  });

  it("splits on the last colon so absolute paths survive", () => {
    // A Windows path carries a colon of its own; splitting on the first one
    // would file every line under the drive letter.
    const { coverageData } = collectCoverageData([
      module_("C:/repo/a.test.ts", [test_("w", { "C:/repo/src/a.ts:42": 1 })]),
    ]);

    expect(Object.keys(coverageData)).toEqual(["C:/repo/src/a.ts"]);
    expect(coverageData["C:/repo/src/a.ts"][42]).toHaveLength(1);
  });

  it("ignores tests that recorded no lineage", () => {
    const { coverageData, testsSeen } = collectCoverageData([
      module_("/repo/a.test.ts", [test_("skipped", null)]),
    ]);

    expect(testsSeen).toBe(0);
    expect(coverageData).toEqual({});
  });

  it("survives a test whose diagnostics are not available yet", () => {
    const broken = {
      type: "test",
      name: "odd",
      meta: () => ({ lineage: { "/repo/src/a.ts:1": 1 } }),
      diagnostic: () => {
        throw new Error("not ready");
      },
    };

    const { coverageData } = collectCoverageData([
      module_("/repo/a.test.ts", [broken]),
    ]);

    expect(coverageData["/repo/src/a.ts"][1][0].duration).toBe(0);
  });

  it("returns empty for no modules", () => {
    expect(collectCoverageData(undefined)).toEqual({
      coverageData: {},
      testsSeen: 0,
    });
  });
});
