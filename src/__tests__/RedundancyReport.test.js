const fs = require("fs");
const os = require("os");
const path = require("path");
const RedundancyReport = require("../RedundancyReport");

function cluster(overrides = {}) {
  return {
    kind: "duplicate",
    size: 2,
    keepTestId: "spec.ts::alpha",
    keepTestName: "alpha",
    testFile: "spec.ts",
    members: [
      {
        id: "spec.ts::alpha",
        name: "alpha",
        testFile: "spec.ts",
        lines: 100,
        duration: 500,
        isKeep: true,
      },
      {
        id: "spec.ts::beta",
        name: "beta",
        testFile: "spec.ts",
        lines: 100,
        duration: 700,
        isKeep: false,
      },
    ],
    avgWeightedJaccard: 1,
    avgRawJaccard: 1,
    redundantDurationMs: 700,
    suggestion: {
      headline: "2 tests exercise the same code",
      detail: "d",
      action: "Keep alpha.",
      savingHint: "~0.7s",
    },
    ...overrides,
  };
}

function subsumption(overrides = {}) {
  return {
    contained: {
      id: "spec.ts::narrow",
      name: "narrow",
      testFile: "spec.ts",
      lines: 40,
      onlyLines: 2,
    },
    container: {
      id: "spec.ts::broad",
      name: "broad",
      testFile: "spec.ts",
      lines: 300,
    },
    sameTestFile: true,
    weightedContainment: 0.95,
    rawContainment: 0.98,
    sharedLines: 38,
    durationMs: 200,
    suggestion: {
      headline: '"narrow" adds no coverage of its own',
      detail: "d",
      action: "Delete narrow.",
    },
    ...overrides,
  };
}

const analysis = (over = {}) => ({
  summary: {
    testCount: 4,
    redundantTests: 2,
    redundantDurationMs: 700,
    sharedSetupLines: 12,
  },
  clusters: [cluster()],
  subsumptions: [subsumption()],
  ...over,
});

describe("RedundancyReport", () => {
  it("emits a self-describing payload so a reader need not guess the metrics", () => {
    const json = new RedundancyReport(analysis()).toJSON();

    expect(json.schemaVersion).toBe(2);
    expect(json.metrics.similarity).toMatch(/weighted/i);
    expect(json.metrics.containment).toMatch(/smaller test/i);
    // The caveat that this measures executed lines, not assertions, must ship
    // with the data — it is the single easiest thing to misread.
    expect(json.metrics.importantCaveat).toMatch(/assertions/i);
    expect(json.summary).toEqual({
      testsAnalysed: 4,
      findings: 2,
      removableTests: 2,
      removableDurationMs: 700,
      linesEveryTestRuns: 12,
      pairsCompared: 0,
    });
  });

  it("ranks identical findings above near-identical above contained", () => {
    const json = new RedundancyReport(
      analysis({
        clusters: [
          cluster({
            kind: "near-duplicate",
            keepTestName: "n",
            suggestion: { headline: "near", action: "a" },
          }),
          cluster(),
        ],
        subsumptions: [subsumption()],
      }),
    ).toJSON();

    expect(json.findings.map((f) => f.verdict)).toEqual([
      "identical",
      "near-identical",
      "contained",
    ]);
  });

  it("gives every test a role and an action an agent can act on", () => {
    const json = new RedundancyReport(analysis()).toJSON();

    for (const finding of json.findings) {
      expect(finding.action).toBeTruthy();
      expect(finding.tests.length).toBeGreaterThan(1);
      expect(finding.tests.filter((t) => t.role === "keep")).toHaveLength(1);
      expect(finding.tests.some((t) => t.role === "remove")).toBe(true);
      for (const test of finding.tests) expect(test.location).toBeTruthy();
    }
  });

  it("resolves the it-block line number from the spec file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redundancy-"));
    const specPath = path.join(dir, "sample.spec.ts");
    fs.writeFileSync(
      specPath,
      [
        "describe('suite', () => {",
        "  it('alpha', () => {});",
        "",
        "  it('beta', () => {});",
        "});",
        "",
      ].join("\n"),
    );

    const json = new RedundancyReport(
      analysis({
        clusters: [
          cluster({
            members: [
              {
                id: "a",
                name: "alpha",
                testFile: specPath,
                lines: 10,
                duration: 1,
                isKeep: true,
              },
              {
                id: "b",
                name: "beta",
                testFile: specPath,
                lines: 10,
                duration: 1,
                isKeep: false,
              },
            ],
          }),
        ],
        subsumptions: [],
      }),
      { cwd: dir },
    ).toJSON();

    const locations = json.findings[0].tests.map((t) => t.location);
    expect(locations).toEqual(["sample.spec.ts:2", "sample.spec.ts:4"]);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("falls back to the file path when the it block cannot be located", () => {
    const json = new RedundancyReport(
      analysis({
        clusters: [
          cluster({
            members: [
              {
                id: "a",
                name: "alpha",
                testFile: "/nope/missing.spec.ts",
                lines: 10,
                isKeep: true,
              },
              {
                id: "b",
                name: "beta",
                testFile: "/nope/missing.spec.ts",
                lines: 10,
                isKeep: false,
              },
            ],
          }),
        ],
        subsumptions: [],
      }),
    ).toJSON();

    for (const test of json.findings[0].tests) {
      expect(test.location).toBe("/nope/missing.spec.ts");
    }
  });

  it("renders markdown with a table per finding", () => {
    const md = new RedundancyReport(analysis()).toMarkdown();

    expect(md).toContain("# Test redundancy");
    expect(md).toContain("| role | test | location | lines |");
    expect(md).toContain("**Action:**");
    expect(md).toContain("2 tests exercise the same code");
  });

  it("escapes pipes so a test name cannot break the markdown table", () => {
    const md = new RedundancyReport(
      analysis({
        clusters: [
          cluster({
            members: [
              {
                id: "a",
                name: "handles a | b",
                testFile: "spec.ts",
                lines: 10,
                isKeep: true,
              },
              {
                id: "b",
                name: "beta",
                testFile: "spec.ts",
                lines: 10,
                isKeep: false,
              },
            ],
          }),
        ],
        subsumptions: [],
      }),
    ).toMarkdown();

    expect(md).toContain("handles a \\| b");
  });

  it("carries the same pair and per-test tables the HTML tab shows", () => {
    const pair = {
      a: "spec.ts::alpha",
      b: "spec.ts::beta",
      aName: "alpha",
      bName: "beta",
      aTestFile: "spec.ts",
      bTestFile: "spec.ts",
      sameTestFile: true,
      sharedLines: 38,
      aOnlyLines: 2,
      bOnlyLines: 260,
      rawJaccard: 0.4,
      rawContainment: 0.95,
      weightedJaccard: 0.09,
      weightedContainment: 0.97,
      distinctiveSharedLines: 12,
      topSharedLines: ["/repo/src/a.ts:12", "/repo/src/a.ts:13"],
      smallerTestId: "spec.ts::alpha",
      largerTestId: "spec.ts::beta",
      kind: "subset",
      durationMs: 300,
    };
    const json = new RedundancyReport(
      analysis({
        pairs: [pair],
        tests: [
          { id: "spec.ts::alpha", name: "alpha", testFile: "spec.ts", lines: 40, distinctiveLines: 10, sourceFiles: 3, duration: 100 },
          { id: "spec.ts::beta", name: "beta", testFile: "spec.ts", lines: 300, distinctiveLines: 280, sourceFiles: 9, duration: 200 },
        ],
      }),
      { cwd: "/repo" },
    ).toJSON();

    expect(json.summary.pairsCompared).toBe(1);

    // Every column the tab renders must be present.
    const row = json.pairs[0];
    expect(row.verdict).toBe("contained");
    expect(row).toMatchObject({
      similarity: 0.09,
      containment: 0.97,
      rawSimilarity: 0.4,
      sharedLines: 38,
      sameTestFile: true,
    });
    expect(row.a.onlyLines).toBe(2);
    expect(row.b.onlyLines).toBe(260);
    expect(row.topSharedLines).toEqual(["src/a.ts:12", "src/a.ts:13"]);

    // Per-test table, most distinctive first.
    expect(json.tests.map((t) => t.name)).toEqual(["beta", "alpha"]);
    expect(json.tests[0]).toMatchObject({
      lines: 300,
      distinctiveLines: 280,
      sourceFiles: 9,
      durationMs: 200,
    });
    expect(json.tests[1].distinctiveRatio).toBeCloseTo(0.25, 3);
  });

  it("keeps the human-readable detail and saving hint on findings", () => {
    const json = new RedundancyReport(analysis()).toJSON();
    const cluster = json.findings.find((f) => f.id.startsWith("dup-"));

    expect(cluster.detail).toBeTruthy();
    expect(cluster.savingHint).toBe("~0.7s");
  });

  it("reports cleanly when there is nothing to fix", () => {
    const report = new RedundancyReport({
      summary: {
        testCount: 3,
        redundantTests: 0,
        redundantDurationMs: 0,
        sharedSetupLines: 0,
      },
      clusters: [],
      subsumptions: [],
    });

    expect(report.toJSON().findings).toEqual([]);
    expect(report.toMarkdown()).toContain("No redundant tests found");
  });

  it("writes both artifacts to disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redundancy-out-"));
    const result = new RedundancyReport(analysis()).write(dir);

    expect(fs.existsSync(result.jsonPath)).toBe(true);
    expect(fs.existsSync(result.markdownPath)).toBe(true);
    expect(result.findings).toBe(2);
    expect(() =>
      JSON.parse(fs.readFileSync(result.jsonPath, "utf8")),
    ).not.toThrow();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
