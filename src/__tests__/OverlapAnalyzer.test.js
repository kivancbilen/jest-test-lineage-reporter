const OverlapAnalyzer = require("../OverlapAnalyzer");

/**
 * Builds the reporter's coverageData shape from a compact spec:
 *   { "test name": ["file.ts:1", "file.ts:2"] }
 */
function coverageFrom(spec, testFile = "suite.spec.ts") {
  const data = {};
  for (const [testName, lineKeys] of Object.entries(spec)) {
    for (const key of lineKeys) {
      const idx = key.lastIndexOf(":");
      const filePath = key.slice(0, idx);
      const lineNumber = key.slice(idx + 1);
      data[filePath] = data[filePath] || {};
      data[filePath][lineNumber] = data[filePath][lineNumber] || [];
      data[filePath][lineNumber].push({
        name: testName,
        file: testFile,
        duration: 100,
      });
    }
  }
  return data;
}

const lines = (file, from, to) => {
  const out = [];
  for (let i = from; i <= to; i++) out.push(`${file}:${i}`);
  return out;
};

describe("OverlapAnalyzer", () => {
  it("reports nothing when there are fewer than two comparable tests", () => {
    const result = new OverlapAnalyzer(
      coverageFrom({ only: lines("a.ts", 1, 10) }),
    ).analyze();

    expect(result.pairs).toEqual([]);
    expect(result.clusters).toEqual([]);
    expect(result.summary.testCount).toBe(1);
  });

  it("flags two tests covering identical lines as duplicates", () => {
    const same = lines("a.ts", 1, 20);
    const result = new OverlapAnalyzer(
      coverageFrom({ first: same, second: same, other: lines("b.ts", 1, 20) }),
    ).analyze();

    const pair = result.pairs.find(
      (p) =>
        (p.aName === "first" && p.bName === "second") ||
        (p.aName === "second" && p.bName === "first"),
    );

    expect(pair).toBeDefined();
    expect(pair.kind).toBe("duplicate");
    expect(pair.rawJaccard).toBe(1);
    expect(pair.weightedJaccard).toBe(1);
    expect(pair.aOnlyLines).toBe(0);
    expect(pair.bOnlyLines).toBe(0);
  });

  it("does NOT flag tests that only share setup lines", () => {
    // Every test runs setup.ts:1-100. Each then drives its own 40 distinct
    // lines. Raw Jaccard is ~0.71 — high enough to look redundant — but the
    // shared part carries zero weight, so the verdict must be "not similar".
    const setup = lines("setup.ts", 1, 100);
    const result = new OverlapAnalyzer(
      coverageFrom({
        alpha: [...setup, ...lines("alpha.ts", 1, 40)],
        beta: [...setup, ...lines("beta.ts", 1, 40)],
        gamma: [...setup, ...lines("gamma.ts", 1, 40)],
      }),
    ).analyze();

    expect(result.clusters).toEqual([]);
    expect(result.pairs).toEqual([]);
    // The setup lines are correctly identified as carrying no signal.
    expect(result.summary.sharedSetupLines).toBe(100);
  });

  it("still flags duplicates that sit behind shared setup", () => {
    const setup = lines("setup.ts", 1, 100);
    const body = lines("feature.ts", 1, 40);
    const result = new OverlapAnalyzer(
      coverageFrom({
        alpha: [...setup, ...body],
        beta: [...setup, ...body],
        gamma: [...setup, ...lines("gamma.ts", 1, 40)],
      }),
    ).analyze();

    expect(result.clusters).toHaveLength(1);
    const cluster = result.clusters[0];
    expect(cluster.kind).toBe("duplicate");
    expect(cluster.members.map((m) => m.name).sort()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(cluster.suggestion.action).toContain("alpha");
  });

  it("classifies a test whose lines are a strict subset of another", () => {
    const result = new OverlapAnalyzer(
      coverageFrom({
        broad: lines("a.ts", 1, 60),
        narrow: lines("a.ts", 1, 25),
        unrelated: lines("b.ts", 1, 60),
      }),
    ).analyze();

    const pair = result.pairs.find(
      (p) =>
        [p.aName, p.bName].includes("broad") &&
        [p.aName, p.bName].includes("narrow"),
    );

    expect(pair).toBeDefined();
    expect(pair.kind).toBe("subset");
    expect(pair.weightedContainment).toBeGreaterThanOrEqual(0.9);
    expect(pair.smallerTestId).toContain("narrow");
    expect(pair.largerTestId).toContain("broad");
  });

  it("does not call a pair contained when they only share the common path", () => {
    // The shape that made containment meaningless on a real suite: every test
    // drives the library's main entry path, so a test that does nothing unusual
    // is a strict subset of almost every other test. Containment saturates at
    // 1.0 while telling you nothing — the two tests have no code in common that
    // is specific to them.
    const common = lines("core.ts", 1, 40);
    const spec = { featureless: [...common] };
    for (let i = 0; i < 12; i++) {
      spec[`worker${i}`] = [...common, ...lines(`feature${i}.ts`, 1, 30)];
    }

    const result = new OverlapAnalyzer(coverageFrom(spec)).analyze();

    const pair = result.pairs.find(
      (p) =>
        [p.aName, p.bName].includes("featureless") &&
        [p.aName, p.bName].includes("worker0"),
    );

    // Every line "featureless" runs is also run by worker0 ...
    expect(pair === undefined || pair.kind !== "subset").toBe(true);
    // ... but none of the shared lines are specific to the two of them.
    expect(
      result.subsumptions.some((s) => s.contained.name === "featureless"),
    ).toBe(false);
  });

  it("still reports containment when the shared code is specific to the pair", () => {
    // Same suite shape, but now the narrow test shares lines that only it and
    // one other test reach. That is real evidence, and must survive the guard.
    const common = lines("core.ts", 1, 40);
    const spec = { narrow: [...common, ...lines("feature0.ts", 1, 10)] };
    for (let i = 0; i < 12; i++) {
      spec[`worker${i}`] = [...common, ...lines(`feature${i}.ts`, 1, 30)];
    }

    const result = new OverlapAnalyzer(coverageFrom(spec)).analyze();

    const pair = result.pairs.find(
      (p) =>
        [p.aName, p.bName].includes("narrow") &&
        [p.aName, p.bName].includes("worker0"),
    );

    expect(pair).toBeDefined();
    expect(pair.kind).toBe("subset");
    expect(pair.rareSharedLines).toBeGreaterThanOrEqual(3);
  });

  it("clusters equivalent tests and reports containment separately", () => {
    // mid and small are identical; big is a strict superset of both. The two
    // identical tests are one cluster; "big contains mid" is a directional
    // observation, not evidence that big is the same test as mid.
    const body = lines("f.ts", 1, 50);
    const result = new OverlapAnalyzer(
      coverageFrom({
        big: [...body, ...lines("f.ts", 51, 60)],
        mid: body,
        small: body,
        unrelated: lines("z.ts", 1, 60),
      }),
    ).analyze();

    expect(result.clusters).toHaveLength(1);
    const cluster = result.clusters[0];
    expect(cluster.kind).toBe("duplicate");
    expect(cluster.members.map((m) => m.name).sort()).toEqual(["mid", "small"]);
    expect(cluster.members.filter((m) => m.isKeep)).toHaveLength(1);
    expect(cluster.members.map((m) => m.name)).not.toContain("big");

    // big swallowing mid/small shows up as containment instead.
    expect(result.subsumptions.length).toBeGreaterThan(0);
    for (const item of result.subsumptions) {
      expect(item.container.name).toBe("big");
      expect(["mid", "small"]).toContain(item.contained.name);
      expect(item.contained.lines).toBeLessThan(item.container.lines);
    }
  });

  it("does not chain containment into one bogus mega-cluster", () => {
    // One broad test contains three narrow ones that have nothing to do with
    // each other. Chaining subset edges would merge all four into a single
    // "these are all the same test" group, which is false.
    const broad = [
      ...lines("a.ts", 1, 40),
      ...lines("b.ts", 1, 40),
      ...lines("c.ts", 1, 40),
    ];
    const result = new OverlapAnalyzer(
      coverageFrom({
        broad,
        narrowA: lines("a.ts", 1, 40),
        narrowB: lines("b.ts", 1, 40),
        narrowC: lines("c.ts", 1, 40),
      }),
    ).analyze();

    // narrowA/B/C share no lines with each other, so no cluster may contain
    // more than one of them.
    for (const cluster of result.clusters) {
      const narrow = cluster.members.filter((m) => m.name.startsWith("narrow"));
      expect(narrow.length).toBeLessThanOrEqual(1);
    }
    expect(result.subsumptions.length).toBe(3);
    expect(result.subsumptions.every((s) => s.container.name === "broad")).toBe(
      true,
    );
  });

  it("counts each removable test once across overlapping findings", () => {
    const body = lines("f.ts", 1, 50);
    const result = new OverlapAnalyzer(
      coverageFrom({
        big: [...body, ...lines("f.ts", 51, 60)],
        mid: body,
        small: body,
        unrelated: lines("z.ts", 1, 60),
      }),
    ).analyze();

    // mid and small appear in both the cluster and the subsumption list; the
    // suite only has 4 tests, so at most 2 can be called removable here.
    expect(result.summary.redundantTests).toBeLessThanOrEqual(2);
    expect(result.summary.redundantTests).toBeGreaterThan(0);
  });

  it("groups a run of identical tests into one cluster, not N pairs", () => {
    const body = lines("f.ts", 1, 40);
    const spec = { unrelated: lines("z.ts", 1, 40) };
    for (const n of ["t1", "t2", "t3", "t4"]) spec[n] = body;

    const result = new OverlapAnalyzer(coverageFrom(spec)).analyze();

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].size).toBe(4);
    expect(result.pairs.length).toBeGreaterThan(1);
  });

  it("ignores tests below the minimum line count", () => {
    const result = new OverlapAnalyzer(
      coverageFrom({
        tiny: lines("a.ts", 1, 2),
        alsoTiny: lines("a.ts", 1, 2),
        real: lines("b.ts", 1, 30),
        realToo: lines("b.ts", 1, 30),
      }),
    ).analyze();

    expect(result.tests.map((t) => t.name).sort()).toEqual(["real", "realToo"]);
  });

  it("marks pairs that span different test files", () => {
    const body = lines("f.ts", 1, 40);
    const data = coverageFrom({ here: body }, "one.spec.ts");
    const other = coverageFrom({ there: body }, "two.spec.ts");
    for (const file of Object.keys(other)) {
      data[file] = data[file] || {};
      for (const line of Object.keys(other[file])) {
        data[file][line] = (data[file][line] || []).concat(other[file][line]);
      }
    }
    // A third, unrelated test so the weighting has something to discount.
    const third = coverageFrom(
      { elsewhere: lines("g.ts", 1, 40) },
      "one.spec.ts",
    );
    Object.assign(data, third);

    const result = new OverlapAnalyzer(data).analyze();
    const pair = result.pairs.find(
      (p) =>
        [p.aName, p.bName].includes("here") &&
        [p.aName, p.bName].includes("there"),
    );

    expect(pair).toBeDefined();
    expect(pair.sameTestFile).toBe(false);
  });

  it("survives malformed coverage data without throwing", () => {
    expect(() => new OverlapAnalyzer(null).analyze()).not.toThrow();
    expect(() => new OverlapAnalyzer({}).analyze()).not.toThrow();
    expect(() =>
      new OverlapAnalyzer({
        "a.ts": { 1: null, 2: "nope", 3: [{}] },
      }).analyze(),
    ).not.toThrow();
  });
});
