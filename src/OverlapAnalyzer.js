/**
 * OverlapAnalyzer — finds `it` blocks that exercise almost the same lines.
 *
 * The naive way to do this is to compare each test's set of covered lines with
 * Jaccard similarity. On real suites that answer is useless: every integration
 * test in a file runs the same beforeEach/setup helpers, so any two tests look
 * 90% identical no matter what they assert. The signal is drowned by lines that
 * everything touches.
 *
 * So every line is weighted by how *rare* it is across the suite, the same idea
 * as IDF in text search:
 *
 *     weight(line) = log(totalTests / testsCoveringLine)
 *
 * A line every test runs (setup) weighs 0 and drops out. A line only two tests
 * run is what actually distinguishes them. Similarity is then computed over
 * those weights, so "these two tests share the same setup" no longer reads as
 * redundancy, while "these two tests drive the same branch of the code under
 * test" does.
 *
 * Raw (unweighted) similarity is kept alongside it, because the gap between the
 * two is itself informative: raw 0.98 / weighted 0.10 is the signature of two
 * genuinely different tests sitting behind a big shared fixture.
 */

const DEFAULTS = {
  // A pair must reach this weighted similarity to be reported at all.
  minWeightedSimilarity: 0.5,
  // Weighted Jaccard at/above this is treated as "these are the same test".
  duplicateThreshold: 0.9,
  nearDuplicateThreshold: 0.75,
  // Weighted containment at/above this means the smaller test adds nothing the
  // larger one does not already cover.
  subsetThreshold: 0.9,
  // Safety valve for very large suites: cap the number of reported pairs.
  maxPairs: 500,
  // A containment verdict ("B adds nothing A does not already reach") is only
  // meaningful when the two tests share code that is *specific* to them. In a
  // library where every test drives the same core path, a test that does
  // nothing unusual is a strict subset of almost every other test, and
  // containment saturates at 1.0 without meaning anything. So a pair must share
  // at least `minRareSharedLines` lines that no more than `rarityCeiling` of
  // the suite executes before it can be called a subset. The resulting
  // threshold never falls below two tests, since a shared line always has at
  // least two.
  rarityCeiling: 0.1,
  minRareSharedLines: 3,
  // "Rare" is a statistical claim, and a handful of tests has no distribution
  // to make it about. Below this many tests the guard is inactive: small suites
  // do not yet have the big shared core path that makes containment meaningless
  // in the first place.
  rarityGuardMinTests: 10,
  // Which containment observations to report. Checked against two real suites,
  // containment across *different* spec files is overwhelmingly noise: a small
  // test is a strict subset of any larger one that happens to run a superset of
  // its lines, however unrelated the two are. Within one spec file the two tests
  // are at least about the same unit. "any" restores the old behaviour.
  containmentScope: "same-file",
  // Tests covering fewer than this many lines are too small to say anything
  // meaningful about (often a `expect(() => x).toThrow()` one-liner).
  minLinesPerTest: 3,
  // Cost guard only: a line covered by more than this many tests generates no
  // candidate pairs. Its weight is near zero anyway, so this changes results
  // only in pathologically large suites.
  maxLineFanout: 200,
};

class OverlapAnalyzer {
  /**
   * @param {object} coverageData  reporter's coverageData: {filePath: {lineNumber: [testInfo]}}
   * @param {object} [options]     see DEFAULTS
   */
  constructor(coverageData, options = {}) {
    this.coverageData = coverageData || {};
    this.options = { ...DEFAULTS, ...options };
  }

  /**
   * @returns {{tests: Array, pairs: Array, clusters: Array, summary: object}}
   */
  analyze() {
    const tests = this.#collectTests();

    if (tests.length < 2) {
      return {
        tests,
        pairs: [],
        clusters: [],
        subsumptions: [],
        summary: this.#emptySummary(tests.length),
      };
    }

    const weights = this.#computeLineWeights(tests);
    const pairs = this.#findOverlappingPairs(tests, weights);
    const clusters = this.#buildClusters(tests, pairs);
    const subsumptions = this.#buildSubsumptions(pairs, clusters);

    return {
      tests: tests.map((t) => this.#publicTest(t, weights)),
      pairs,
      clusters,
      subsumptions,
      summary: this.#summarize(tests, pairs, clusters, subsumptions, weights),
    };
  }

  // ---------------------------------------------------------------- internals

  /**
   * Invert coverageData into one entry per test with its set of `file:line`
   * keys. A test is identified by test-file + test name, which is how jest
   * identifies an `it` block too.
   */
  #collectTests() {
    const byId = new Map();

    for (const filePath of Object.keys(this.coverageData)) {
      const lines = this.coverageData[filePath];
      if (!lines || typeof lines !== "object") continue;

      for (const lineNumber of Object.keys(lines)) {
        const testInfos = lines[lineNumber];
        if (!Array.isArray(testInfos)) continue;

        const lineKey = `${filePath}:${lineNumber}`;

        for (const info of testInfos) {
          // The reporter records `name`/`file`; the CLI's data-loader records
          // `testName`/`testFile`. Accept either so both entry points agree.
          const name = info && (info.name || info.testName);
          if (!name) continue;
          const testFile =
            info.file || info.testFile || info.fullPath || "unknown-test-file";
          const id = `${testFile}::${name}`;

          let entry = byId.get(id);
          if (!entry) {
            entry = {
              id,
              name,
              testFile,
              duration: info.duration || 0,
              lines: new Set(),
              sourceFiles: new Set(),
            };
            byId.set(id, entry);
          }
          entry.lines.add(lineKey);
          entry.sourceFiles.add(filePath);
          // Longest observed duration wins; the same test can be recorded once
          // per line and the value should be identical, but be defensive.
          if ((info.duration || 0) > entry.duration) {
            entry.duration = info.duration;
          }
        }
      }
    }

    return Array.from(byId.values()).filter(
      (t) => t.lines.size >= this.options.minLinesPerTest,
    );
  }

  /**
   * weight(line) = log(N / df). Lines every test covers get weight 0 and are
   * excluded from the similarity entirely.
   */
  #computeLineWeights(tests) {
    const documentFrequency = new Map();
    for (const test of tests) {
      for (const line of test.lines) {
        documentFrequency.set(line, (documentFrequency.get(line) || 0) + 1);
      }
    }

    const total = tests.length;
    const weights = new Map();
    for (const [line, df] of documentFrequency) {
      weights.set(line, Math.log(total / df));
    }
    this.lineTestCounts = documentFrequency;
    this.rarityGuardActive = total >= this.options.rarityGuardMinTests;
    // A shared line is covered by at least two tests by definition, so the
    // threshold can never drop below 2 — otherwise no shared line is ever rare
    // and small suites lose containment entirely.
    this.rareLineMaxTests = Math.max(
      2,
      Math.ceil(this.options.rarityCeiling * total),
    );
    return weights;
  }

  /** True when few enough tests execute this line for it to carry signal. */
  #isRareLine(line) {
    if (!this.rarityGuardActive) return true;
    const df = this.lineTestCounts && this.lineTestCounts.get(line);
    return df !== undefined && df <= this.rareLineMaxTests;
  }

  #weightOf(weights, line) {
    return weights.get(line) || 0;
  }

  #weightedSize(weights, lines) {
    let sum = 0;
    for (const line of lines) sum += this.#weightOf(weights, line);
    return sum;
  }

  /**
   * Only pairs that share at least one *distinctive* line can be similar, so an
   * inverted index over distinctive lines gives us the candidate pairs without
   * the O(n²) sweep over the whole suite.
   */
  #findOverlappingPairs(tests, weights) {
    const indexByTestId = new Map(tests.map((t, i) => [t.id, i]));
    const distinctiveIndex = new Map();

    for (const test of tests) {
      for (const line of test.lines) {
        if (this.#weightOf(weights, line) <= 0) continue;
        let holders = distinctiveIndex.get(line);
        if (!holders) {
          holders = [];
          distinctiveIndex.set(line, holders);
        }
        holders.push(indexByTestId.get(test.id));
      }
    }

    const candidates = new Set();
    for (const holders of distinctiveIndex.values()) {
      // Zero-weight lines are already excluded above, so every line reaching
      // here carries signal. The only reason to skip one is cost: a line
      // touched by hundreds of tests emits a huge number of candidate pairs for
      // very little discrimination, since its weight is correspondingly tiny.
      if (holders.length > 1 && holders.length <= this.options.maxLineFanout) {
        for (let i = 0; i < holders.length; i++) {
          for (let j = i + 1; j < holders.length; j++) {
            const a = Math.min(holders[i], holders[j]);
            const b = Math.max(holders[i], holders[j]);
            candidates.add(a * tests.length + b);
          }
        }
      }
    }

    const pairs = [];
    for (const encoded of candidates) {
      const a = Math.floor(encoded / tests.length);
      const b = encoded % tests.length;
      const pair = this.#comparePair(tests[a], tests[b], weights);
      // Admit a pair on either measure. Jaccard alone misses the most
      // actionable case: a small test wholly contained in a much larger one has
      // low Jaccard (the big test has lots of unique lines) but containment of
      // 1.0 — and "this test adds no coverage the other doesn't" is precisely
      // what we want to surface.
      if (
        pair &&
        (pair.weightedJaccard >= this.options.minWeightedSimilarity ||
          (pair.weightedContainment >= this.options.subsetThreshold &&
            pair.rareSharedLines >= this.options.minRareSharedLines))
      ) {
        pairs.push(pair);
      }
    }

    // Rank by whichever measure flagged the pair, so subsets are not buried
    // beneath merely-overlapping pairs with a higher Jaccard.
    const score = (p) => Math.max(p.weightedJaccard, p.weightedContainment);
    pairs.sort((x, y) => score(y) - score(x));
    return pairs.slice(0, this.options.maxPairs);
  }

  #comparePair(testA, testB, weights) {
    const [small, large] =
      testA.lines.size <= testB.lines.size ? [testA, testB] : [testB, testA];

    const shared = [];
    for (const line of small.lines) {
      if (large.lines.has(line)) shared.push(line);
    }
    if (shared.length === 0) return null;

    const unionSize = testA.lines.size + testB.lines.size - shared.length;

    const sharedWeight = this.#weightedSize(weights, shared);
    const weightA = this.#weightedSize(weights, testA.lines);
    const weightB = this.#weightedSize(weights, testB.lines);
    const unionWeight = weightA + weightB - sharedWeight;
    const smallerWeight = Math.min(weightA, weightB);

    // If neither test has any distinctive lines they are, by this measure,
    // indistinguishable — which is itself the strongest possible signal.
    const weightedJaccard =
      unionWeight > 0 ? sharedWeight / unionWeight : shared.length > 0 ? 1 : 0;
    const weightedContainment =
      smallerWeight > 0 ? sharedWeight / smallerWeight : weightedJaccard;

    const distinctiveShared = shared
      .filter((line) => this.#weightOf(weights, line) > 0)
      .sort((l, r) => this.#weightOf(weights, r) - this.#weightOf(weights, l));

    // Shared lines that are rare across the suite. This is what separates "these
    // two tests exercise the same specific behaviour" from "both tests, like
    // every other test, went through the library's main entry path".
    const rareShared = shared.filter((line) => this.#isRareLine(line));

    return {
      a: testA.id,
      b: testB.id,
      aName: testA.name,
      bName: testB.name,
      aTestFile: testA.testFile,
      bTestFile: testB.testFile,
      sameTestFile: testA.testFile === testB.testFile,
      sharedLines: shared.length,
      aOnlyLines: testA.lines.size - shared.length,
      bOnlyLines: testB.lines.size - shared.length,
      rawJaccard: unionSize > 0 ? shared.length / unionSize : 0,
      rawContainment:
        shared.length / Math.min(testA.lines.size, testB.lines.size),
      weightedJaccard,
      weightedContainment,
      distinctiveSharedLines: distinctiveShared.length,
      rareSharedLines: rareShared.length,
      topSharedLines: distinctiveShared.slice(0, 8),
      smallerTestId: small.id,
      largerTestId: large.id,
      kind: this.#classify(
        weightedJaccard,
        weightedContainment,
        rareShared.length,
      ),
      durationMs: (testA.duration || 0) + (testB.duration || 0),
    };
  }

  #classify(weightedJaccard, weightedContainment, rareSharedLines) {
    if (weightedJaccard >= this.options.duplicateThreshold) return "duplicate";
    if (weightedJaccard >= this.options.nearDuplicateThreshold)
      return "near-duplicate";
    // Containment alone is not evidence: see `minRareSharedLines` in DEFAULTS.
    if (
      weightedContainment >= this.options.subsetThreshold &&
      rareSharedLines >= this.options.minRareSharedLines
    )
      return "subset";
    return "overlapping";
  }

  /**
   * Connected components over the duplicate / near-duplicate edges, so a group
   * of five tests that all do the same thing is reported once rather than as
   * ten pairs.
   *
   * Subset edges are deliberately excluded. "A contains B" is directional and
   * not transitive in any useful sense: one broad end-to-end test contains a
   * dozen narrow ones, and chaining those edges collapses the whole suite into
   * a single bogus "these are all the same test" blob. Containment is reported
   * separately by #buildSubsumptions.
   */
  #buildClusters(tests, pairs) {
    const strong = pairs.filter(
      (p) => p.kind === "duplicate" || p.kind === "near-duplicate",
    );
    if (strong.length === 0) return [];

    const parent = new Map(tests.map((t) => [t.id, t.id]));
    const find = (id) => {
      while (parent.get(id) !== id) {
        parent.set(id, parent.get(parent.get(id)));
        id = parent.get(id);
      }
      return id;
    };
    const union = (x, y) => {
      const rx = find(x);
      const ry = find(y);
      if (rx !== ry) parent.set(rx, ry);
    };

    for (const pair of strong) union(pair.a, pair.b);

    const byRoot = new Map();
    for (const test of tests) {
      const root = find(test.id);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(test);
    }

    const testById = new Map(tests.map((t) => [t.id, t]));
    const clusters = [];

    for (const members of byRoot.values()) {
      if (members.length < 2) continue;

      const memberIds = new Set(members.map((m) => m.id));
      const edges = strong.filter(
        (p) => memberIds.has(p.a) && memberIds.has(p.b),
      );

      // The member covering the most lines is the natural one to keep.
      const keep = members.reduce((best, m) =>
        m.lines.size > best.lines.size ? m : best,
      );

      const avgWeighted =
        edges.reduce((s, e) => s + e.weightedJaccard, 0) / edges.length;
      const avgRaw = edges.reduce((s, e) => s + e.rawJaccard, 0) / edges.length;

      // Grade the group on its average, not on "some edge somewhere hit the
      // duplicate threshold" — one strong edge must not let a loosely related
      // group be reported as identical.
      const kind =
        avgWeighted >= this.options.duplicateThreshold
          ? "duplicate"
          : "near-duplicate";

      clusters.push({
        kind,
        size: members.length,
        keepTestId: keep.id,
        keepTestName: keep.name,
        testFile: keep.testFile,
        members: members
          .map((m) => ({
            id: m.id,
            name: m.name,
            testFile: m.testFile,
            lines: m.lines.size,
            duration: m.duration,
            isKeep: m.id === keep.id,
          }))
          .sort((x, y) => y.lines - x.lines),
        avgWeightedJaccard: avgWeighted,
        avgRawJaccard: avgRaw,
        redundantDurationMs: members
          .filter((m) => m.id !== keep.id)
          .reduce((s, m) => s + (m.duration || 0), 0),
        suggestion: this.#suggestForCluster(
          kind,
          members,
          keep,
          avgRaw,
          avgWeighted,
        ),
      });
    }

    // Attribute unused in the reduce above; kept for clarity of intent.
    void testById;

    return clusters.sort(
      (x, y) => y.size - x.size || y.avgWeightedJaccard - x.avgWeightedJaccard,
    );
  }

  /**
   * Directional "B adds nothing A does not already cover" findings, one per
   * pair. Kept out of the clusters because containment does not chain: a broad
   * test containing ten narrow ones is ten separate observations, not one group
   * of eleven equivalent tests.
   *
   * A pair is dropped if both tests already sit in the same duplicate cluster —
   * that group has been reported already.
   */
  #buildSubsumptions(pairs, clusters) {
    const clusterOf = new Map();
    clusters.forEach((cluster, index) => {
      for (const member of cluster.members) clusterOf.set(member.id, index);
    });

    return pairs
      .filter((p) => p.kind === "subset")
      .filter(
        (p) => this.options.containmentScope !== "same-file" || p.sameTestFile,
      )
      .filter((p) => {
        const ca = clusterOf.get(p.a);
        const cb = clusterOf.get(p.b);
        return ca === undefined || cb === undefined || ca !== cb;
      })
      .map((p) => {
        const containedIsA = p.smallerTestId === p.a;
        const contained = {
          id: p.smallerTestId,
          name: containedIsA ? p.aName : p.bName,
          testFile: containedIsA ? p.aTestFile : p.bTestFile,
          lines: containedIsA ? p.sharedLines + p.aOnlyLines : p.sharedLines + p.bOnlyLines,
          onlyLines: containedIsA ? p.aOnlyLines : p.bOnlyLines,
        };
        const container = {
          id: p.largerTestId,
          name: containedIsA ? p.bName : p.aName,
          testFile: containedIsA ? p.bTestFile : p.aTestFile,
          lines: containedIsA ? p.sharedLines + p.bOnlyLines : p.sharedLines + p.aOnlyLines,
        };
        return {
          contained,
          container,
          sameTestFile: p.sameTestFile,
          weightedContainment: p.weightedContainment,
          rawContainment: p.rawContainment,
          sharedLines: p.sharedLines,
          durationMs: p.durationMs,
          suggestion: this.#suggestForSubsumption(contained, container, p),
        };
      })
      .sort((x, y) => y.weightedContainment - x.weightedContainment);
  }

  #suggestForSubsumption(contained, container, pair) {
    const pct = (pair.weightedContainment * 100).toFixed(0);
    return {
      headline: `"${contained.name}" reaches no code the other misses`,
      detail:
        `${pct}% of what this test distinctively reaches is already reached by ` +
        `"${container.name}"` +
        (contained.onlyLines > 0
          ? `. It touches ${contained.onlyLines} line${contained.onlyLines === 1 ? "" : "s"} the other does not, but ` +
            `those carry little weight — they are lines most of the suite runs anyway.`
          : `, and it touches nothing the other does not.`),
      action:
        `Check what each one asserts before acting. If they assert different ` +
        `things, the difference is not reaching the source code — strengthen the ` +
        `assertions or drive a different input. Only if they assert the same ` +
        `thing is this a candidate to fold into "${container.name}".`,
    };
  }

  #suggestForCluster(kind, members, keep, avgRaw, avgWeighted) {
    const others = members.filter((m) => m.id !== keep.id);
    const names = others.map((m) => `"${m.name}"`).join(", ");
    const seconds = (
      others.reduce((s, m) => s + (m.duration || 0), 0) / 1000
    ).toFixed(1);

    if (kind === "duplicate") {
      return {
        headline: `${members.length} tests exercise the same code`,
        detail:
          `After discounting shared setup these tests still reach the same lines ` +
          `(${(avgWeighted * 100).toFixed(0)}% weighted similarity). They are ` +
          `probably the same scenario written more than once.`,
        action:
          `Compare what they assert. Executing the same lines is not the same as ` +
          `testing the same thing — a test can assert a different outcome, or a ` +
          `property line coverage cannot see at all, such as how many times ` +
          `something re-rendered. If they do assert the same thing, keep ` +
          `"${keep.name}" and fold ${names} into it. If they do not, the ` +
          `difference never reaches the source code, which is worth knowing on ` +
          `its own.`,
        savingHint: `~${seconds}s of runtime`,
      };
    }

    if (kind === "near-duplicate") {
      return {
        headline: `${members.length} tests are near-identical`,
        detail:
          `${(avgWeighted * 100).toFixed(0)}% weighted similarity — they differ ` +
          `only at the margins.`,
        action:
          `Consider a table-driven test (\`it.each\`) over the differing inputs ` +
          `instead of ${members.length} separate blocks.`,
        savingHint: `~${seconds}s of runtime`,
      };
    }

    // Clusters are only ever "duplicate" or "near-duplicate" — containment is
    // reported by #buildSubsumptions — so this is a defensive fallback.
    return {
      headline: `${members.length} tests overlap heavily`,
      detail: `${(avgRaw * 100).toFixed(0)}% raw line overlap.`,
      action: `Review whether ${names} still earn their place alongside "${keep.name}".`,
      savingHint: `~${seconds}s of runtime`,
    };
  }

  #publicTest(test, weights) {
    let distinctive = 0;
    for (const line of test.lines) {
      if (this.#weightOf(weights, line) > 0) distinctive++;
    }
    return {
      id: test.id,
      name: test.name,
      testFile: test.testFile,
      lines: test.lines.size,
      distinctiveLines: distinctive,
      sourceFiles: test.sourceFiles.size,
      duration: test.duration,
    };
  }

  #emptySummary(testCount) {
    return {
      testCount,
      pairCount: 0,
      clusterCount: 0,
      duplicateClusters: 0,
      subsumptionCount: 0,
      findingCount: 0,
      redundantTests: 0,
      redundantDurationMs: 0,
      sharedSetupLines: 0,
      distinctiveLineRatio: 1,
    };
  }

  #summarize(tests, pairs, clusters, subsumptions, weights) {
    let sharedSetupLines = 0;
    let totalLines = 0;
    for (const [, weight] of weights) {
      totalLines++;
      if (weight <= 0) sharedSetupLines++;
    }

    // A test can appear in several findings; count each one once so the tile
    // does not claim more removable tests than the suite contains.
    const removable = new Set();
    let removableDurationMs = 0;
    for (const cluster of clusters) {
      for (const member of cluster.members) {
        if (!member.isKeep && !removable.has(member.id)) {
          removable.add(member.id);
          removableDurationMs += member.duration || 0;
        }
      }
    }
    // Containment is deliberately absent from `redundantTests` and
    // `findingCount`. Checked by hand against two suites it is the weakest
    // signal the analysis produces — "B runs no line A misses" is true of any
    // small test against any larger one — so it is reported as a separate,
    // lower-confidence observation rather than counted as a finding.

    return {
      testCount: tests.length,
      pairCount: pairs.length,
      clusterCount: clusters.length,
      duplicateClusters: clusters.filter((c) => c.kind === "duplicate").length,
      subsumptionCount: subsumptions.length,
      findingCount: clusters.length,
      redundantTests: removable.size,
      redundantDurationMs: removableDurationMs,
      sharedSetupLines,
      distinctiveLineRatio:
        totalLines > 0 ? (totalLines - sharedSetupLines) / totalLines : 1,
    };
  }
}

module.exports = OverlapAnalyzer;
module.exports.DEFAULTS = DEFAULTS;
