/**
 * RedundancyReport — the agent-readable side of the redundancy analysis.
 *
 * The HTML report is for humans and is far too large to feed to a model (a
 * single 11-test integration run produces ~50MB of it). This module turns the
 * same OverlapAnalyzer result into two small artifacts:
 *
 *   test-redundancy.json  — self-describing, stable ordering, ~10-100KB
 *   test-redundancy.md    — the same findings as prose an agent or human can act on
 *
 * Everything an agent needs to *act* is included: the spec file, the resolved
 * line number of the `it` block, and one unambiguous instruction per finding.
 */

const fs = require("fs");
const path = require("path");

const SCHEMA_VERSION = 2;

/** Analyzer edge kinds -> the vocabulary used in findings. */
const VERDICT_BY_KIND = {
  duplicate: "identical",
  "near-duplicate": "near-identical",
  subset: "contained",
  overlapping: "overlapping",
};

/**
 * What the numbers mean, shipped inside the JSON so a reader does not have to
 * guess or go find the docs.
 */
const METRIC_DOCS = {
  similarity:
    "Weighted Jaccard over the SOURCE LINES each test executed: shared weight / union weight. " +
    "Each line is weighted log(totalTests / testsCoveringLine), so lines every test runs (shared " +
    "setup) count for nothing. 1.0 means the two tests drove the code down the same path.",
  containment:
    "Same weighting, but divided by the smaller test's weight only. 1.0 means the smaller test " +
    "executed nothing the larger one did not also execute.",
  rawSimilarity:
    "Unweighted Jaccard over raw line counts, shared setup included. Shown only for contrast: a " +
    "high raw / low weighted pair is two genuinely different tests behind a big shared fixture.",
  importantCaveat:
    "These metrics describe LINES EXECUTED in the code under test, never the test code or its " +
    "assertions — spec files are excluded from instrumentation. Two tests can execute identical " +
    "lines while asserting different things. So a finding means 'these drive the same code path', " +
    "not automatically 'delete one'. Where they are meant to differ, the difference is not " +
    "reaching the source, which is itself worth knowing.",
};

class RedundancyReport {
  /**
   * @param {object} analysis  result of OverlapAnalyzer#analyze()
   * @param {object} [options] { cwd }
   */
  constructor(analysis, options = {}) {
    this.analysis = analysis || {};
    this.cwd = options.cwd || process.cwd();
    this.locationCache = new Map();
  }

  // ------------------------------------------------------------------ public

  /**
   * Compact, stable, self-describing findings object.
   */
  toJSON() {
    const { summary = {}, clusters = [], subsumptions = [] } = this.analysis;

    const findings = [
      ...clusters.map((c, i) => this.#clusterFinding(c, i)),
      ...subsumptions.map((s, i) => this.#subsumptionFinding(s, i)),
    ];

    // Most actionable first: identical before near-identical before contained,
    // then by how much runtime removing it would free.
    const rank = { identical: 0, "near-identical": 1, contained: 2 };
    findings.sort(
      (a, b) =>
        rank[a.verdict] - rank[b.verdict] ||
        b.removableDurationMs - a.removableDurationMs ||
        a.id.localeCompare(b.id),
    );

    const { pairs = [], tests = [] } = this.analysis;

    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      metrics: METRIC_DOCS,
      summary: {
        testsAnalysed: summary.testCount || 0,
        findings: findings.length,
        removableTests: summary.redundantTests || 0,
        removableDurationMs: summary.redundantDurationMs || 0,
        linesEveryTestRuns: summary.sharedSetupLines || 0,
        pairsCompared: pairs.length,
      },
      // The actionable conclusions.
      findings,
      // Everything the Redundancy tab's "All overlapping pairs" table shows, so
      // a reader can audit a verdict or apply its own threshold rather than
      // trusting the classification.
      pairs: pairs.map((pair) => this.#pairRow(pair)),
      // The tab's "What each test uniquely reaches" table: how much of a test's
      // coverage is its own rather than shared with the rest of the suite.
      tests: tests
        .slice()
        .sort((a, b) => b.distinctiveLines - a.distinctiveLines)
        .map((test) => ({
          name: test.name,
          location: this.#locate(test.testFile, test.name),
          lines: test.lines,
          distinctiveLines: test.distinctiveLines,
          distinctiveRatio: test.lines ? round(test.distinctiveLines / test.lines) : 0,
          sourceFiles: test.sourceFiles,
          durationMs: test.duration || 0,
        })),
    };
  }

  /**
   * One row of the pairs table. Both metrics are always present so a reader can
   * see why a pair was classified the way it was — a `contained` verdict is
   * driven by containment, not similarity, and the two can differ sharply.
   */
  #pairRow(pair) {
    return {
      verdict: VERDICT_BY_KIND[pair.kind] || pair.kind,
      a: {
        name: pair.aName,
        location: this.#locate(pair.aTestFile, pair.aName),
        onlyLines: pair.aOnlyLines,
      },
      b: {
        name: pair.bName,
        location: this.#locate(pair.bTestFile, pair.bName),
        onlyLines: pair.bOnlyLines,
      },
      similarity: round(pair.weightedJaccard),
      containment: round(pair.weightedContainment),
      rawSimilarity: round(pair.rawJaccard),
      rawContainment: round(pair.rawContainment),
      sharedLines: pair.sharedLines,
      distinctiveSharedLines: pair.distinctiveSharedLines,
      sameTestFile: pair.sameTestFile,
      // The rarest lines both tests run — the concrete evidence for the verdict.
      topSharedLines: (pair.topSharedLines || []).map((line) =>
        this.#relativeLineKey(line),
      ),
    };
  }

  #relativeLineKey(lineKey) {
    const idx = String(lineKey).lastIndexOf(":");
    if (idx === -1) return lineKey;
    return `${this.#relative(lineKey.slice(0, idx))}:${lineKey.slice(idx + 1)}`;
  }

  /**
   * Markdown rendering of the same findings — for agents that read prose better
   * than JSON, and for pasting into a PR.
   */
  toMarkdown() {
    const report = this.toJSON();
    const out = [];

    out.push("# Test redundancy");
    out.push("");
    out.push(
      `${plural(report.summary.testsAnalysed, "test")} analysed · ` +
        `**${plural(report.summary.findings, "finding")}** · ` +
        `${plural(report.summary.removableTests, "test")} could go · ` +
        `${(report.summary.removableDurationMs / 1000).toFixed(1)}s of runtime`,
    );
    out.push("");
    out.push(
      "> Similarity is measured over **source lines executed**, weighted so that lines every " +
        "test runs (shared setup) count for nothing. It says nothing about the test code or its " +
        "assertions — spec files are not instrumented.",
    );
    out.push("");

    if (report.findings.length === 0) {
      out.push(
        "No redundant tests found. Every test reaches a materially different set of lines.",
      );
      out.push("");
      return out.join("\n");
    }

    for (const finding of report.findings) {
      out.push(`## ${finding.id} — ${finding.headline}`);
      out.push("");
      out.push(`**Verdict:** \`${finding.verdict}\` · ${finding.evidence}`);
      out.push("");
      if (finding.detail) {
        out.push(finding.detail);
        out.push("");
      }

      out.push("| role | test | location | lines |");
      out.push("| --- | --- | --- | --- |");
      for (const t of finding.tests) {
        out.push(
          `| ${t.role} | ${escapePipes(t.name)} | \`${t.location}\` | ${t.lines} |`,
        );
      }
      out.push("");
      out.push(`**Action:** ${finding.action}`);
      out.push("");
    }

    if (report.tests.length) {
      out.push("## What each test uniquely reaches");
      out.push("");
      out.push("| test | location | lines | distinctive | files | duration |");
      out.push("| --- | --- | --- | --- | --- | --- |");
      for (const test of report.tests) {
        out.push(
          `| ${escapePipes(test.name)} | \`${test.location}\` | ${test.lines} | ` +
            `${test.distinctiveLines} (${(test.distinctiveRatio * 100).toFixed(0)}%) | ` +
            `${test.sourceFiles} | ${(test.durationMs / 1000).toFixed(2)}s |`,
        );
      }
      out.push("");
    }

    if (report.pairs.length) {
      out.push(`## All overlapping pairs (${report.pairs.length})`);
      out.push("");
      out.push(
        "| verdict | A | B | similarity | containment | raw | shared | only A | only B |",
      );
      out.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
      for (const pair of report.pairs) {
        out.push(
          `| ${pair.verdict} | ${escapePipes(pair.a.name)} | ${escapePipes(pair.b.name)} | ` +
            `${pct(pair.similarity)} | ${pct(pair.containment)} | ${pct(pair.rawSimilarity)} | ` +
            `${pair.sharedLines} | ${pair.a.onlyLines} | ${pair.b.onlyLines} |`,
        );
      }
      out.push("");
    }

    return out.join("\n");
  }

  /**
   * Writes both artifacts next to the HTML report.
   * @returns {{jsonPath: string, markdownPath: string, findings: number}}
   */
  write(outputDir = this.cwd) {
    const report = this.toJSON();
    const jsonPath = path.join(outputDir, "test-redundancy.json");
    const markdownPath = path.join(outputDir, "test-redundancy.md");

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(markdownPath, this.toMarkdown(), "utf8");

    return { jsonPath, markdownPath, findings: report.findings.length };
  }

  // --------------------------------------------------------------- internals

  #clusterFinding(cluster, index) {
    const verdict =
      cluster.kind === "duplicate" ? "identical" : "near-identical";

    return {
      id: `dup-${index + 1}`,
      verdict,
      headline: cluster.suggestion.headline,
      detail: cluster.suggestion.detail,
      savingHint: cluster.suggestion.savingHint,
      evidence:
        `${(cluster.avgWeightedJaccard * 100).toFixed(0)}% similarity ` +
        `(${(cluster.avgRawJaccard * 100).toFixed(0)}% raw) across ${cluster.size} tests`,
      similarity: round(cluster.avgWeightedJaccard),
      rawSimilarity: round(cluster.avgRawJaccard),
      removableTests: cluster.size - 1,
      removableDurationMs: cluster.redundantDurationMs || 0,
      tests: cluster.members.map((m) => ({
        role: m.isKeep ? "keep" : "remove",
        name: m.name,
        location: this.#locate(m.testFile || cluster.testFile, m.name),
        lines: m.lines,
        durationMs: m.duration || 0,
      })),
      action: cluster.suggestion.action,
    };
  }

  #subsumptionFinding(item, index) {
    return {
      id: `cov-${index + 1}`,
      verdict: "contained",
      headline: item.suggestion.headline,
      detail: item.suggestion.detail,
      evidence:
        `${(item.weightedContainment * 100).toFixed(0)}% of its distinctive lines are ` +
        `already covered (${(item.rawContainment * 100).toFixed(0)}% raw)`,
      containment: round(item.weightedContainment),
      rawSimilarity: round(item.rawContainment),
      removableTests: 1,
      removableDurationMs: 0,
      tests: [
        {
          role: "keep",
          name: item.container.name,
          location: this.#locate(item.container.testFile, item.container.name),
          lines: item.container.lines,
        },
        {
          role: "remove",
          name: item.contained.name,
          location: this.#locate(item.contained.testFile, item.contained.name),
          lines: item.contained.lines,
          uniqueLines: item.contained.onlyLines,
        },
      ],
      action: item.suggestion.action,
    };
  }

  /**
   * Resolve "spec file + test name" to `path:line` by finding the `it(`/`test(`
   * call that declares it. An agent can then open the exact block. Falls back to
   * the bare file path when the name cannot be found (dynamic titles, it.each).
   */
  #locate(testFile, testName) {
    if (!testFile || testFile === "unknown-test-file" || !testName) {
      return testFile || "unknown";
    }

    const relative = this.#relative(testFile);
    const cacheKey = `${testFile}::${testName}`;
    if (this.locationCache.has(cacheKey))
      return this.locationCache.get(cacheKey);

    let result = relative;
    try {
      if (fs.existsSync(testFile)) {
        const lines = fs.readFileSync(testFile, "utf8").split("\n");
        const needle = escapeRegExp(testName);
        const declaration = new RegExp(
          `\\b(it|test)\\s*(\\.\\w+)?\\s*\\(\\s*['"\`]${needle}['"\`]`,
        );

        let lineNumber = lines.findIndex((line) => declaration.test(line));
        // Long titles are often wrapped onto their own line by formatters, so
        // fall back to a plain substring match on the title.
        if (lineNumber === -1) {
          lineNumber = lines.findIndex((line) => line.includes(testName));
        }
        if (lineNumber !== -1) result = `${relative}:${lineNumber + 1}`;
      }
    } catch {
      // Keep the file-only fallback.
    }

    this.locationCache.set(cacheKey, result);
    return result;
  }

  #relative(filePath) {
    try {
      const rel = path.relative(this.cwd, filePath);
      // Forward slashes regardless of platform: these locations are read back
      // by editors, CI annotations and agents as `path/to/file.spec.ts:42`, so
      // a report produced on Windows must say the same thing as one produced
      // on Linux.
      return rel && !rel.startsWith("..")
        ? rel.split(path.sep).join("/")
        : filePath;
    } catch {
      return filePath;
    }
  }
}

/** "1 test", "2 tests" — counts read as prose in the markdown summary. */
function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function round(value) {
  return Math.round((value || 0) * 1000) / 1000;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pct(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function escapePipes(text) {
  return String(text).replace(/\|/g, "\\|");
}

module.exports = RedundancyReport;
module.exports.METRIC_DOCS = METRIC_DOCS;
module.exports.SCHEMA_VERSION = SCHEMA_VERSION;
