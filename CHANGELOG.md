# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.4.1] - 2026-09-11

### Fixed
- **`JEST_LINEAGE_RUN_GAP=0` did not start clean.** `prepareRun` treated a shard
  as part of the current run when `age <= gapMs`, and computed age as
  `Date.now() - mtimeMs` with no floor. The filesystem records mtime with
  sub-millisecond precision while `Date.now()` truncates to whole milliseconds,
  so a shard written moments earlier reads as very slightly *in the future* and
  its negative age satisfies any gap — including a gap of zero, which is
  documented as start-clean-every-time. Records from a previous run could
  therefore survive into the next report. Age is now clamped at zero and
  compared with `<`.
- **Report locations are platform-independent.** `test-redundancy.json` and
  `test-redundancy.md` built their `path/to/file.spec.ts:42` locations with
  `path.relative` and emitted them unchanged, so a report produced on Windows
  said `src\a.ts:12`. Editors, CI annotations and agents read these back as
  file:line references, so they are now always forward-slashed.
- **The package's own suite runs on Windows**, and under
  `JEST_LINEAGE_ENABLED=false`. npm scripts go through `cross-env` (inline
  `VAR=value cmd` is not valid in PowerShell), and Jest no longer mistakes
  `src/cli/commands/test.js` for a test suite.

### Added
- **`JEST_LINEAGE_INCLUDE` / `JEST_LINEAGE_EXCLUDE`** path scoping for the Babel
  plugin. Instrumentation previously covered every non-test source file outside
  `node_modules`, so in a monorepo each test recorded the lines it executed
  across every package rather than just the code under test. Measured at ~5.2 MB
  of lineage data *per test* on a large monorepo. Both variables take a
  comma-separated list; each entry is a regular expression when it compiles and
  a substring otherwise, and `EXCLUDE` wins over `INCLUDE`. Run
  `jest --clearCache` after changing either — Jest's transform cache key does
  not include the plugin's configuration.
- **`JEST_LINEAGE_RUN_ID` / `JEST_LINEAGE_RUN_GAP`** to say which Jest processes
  belong to the same logical test run. A harness that reruns a failed suite does
  so in a second Jest process; giving every process in the run the same
  `JEST_LINEAGE_RUN_ID` groups their lineage exactly. With no run id set, shards
  written within `JEST_LINEAGE_RUN_GAP` seconds (default 120) are treated as part
  of the run now starting, which covers the rerun case with no configuration;
  `JEST_LINEAGE_RUN_GAP=0` makes every process start from an empty directory.
  Carrying shards forward is always logged.

### Fixed
- **Lineage data was silently truncated after a few hundred tests.** Every
  completed test read the whole accumulated `.jest-lineage-data.json` back,
  re-parsed it and rewrote it, which made total IO O(n²) in the number of tests
  and, once the file passed V8's ~512 MB max string length, made `JSON.parse`
  throw. Both the writer and the loader caught that failure and reset to an
  empty array, so the run stayed green while every previously recorded test was
  discarded — a truncated report with no warning.

  Test records are now appended, one JSON object per line, to a per-process
  shard under `.jest-lineage-shards/`, and merged into `.jest-lineage-data.json`
  once at the end of the run. Recording a test is O(1), no accumulated document
  is parsed mid-run, and the merged file is streamed out record by record rather
  than built with a single `JSON.stringify`. The output file's format is
  unchanged, so the CLI, MCP server and mutation tester are unaffected.
- **Concurrent Jest workers lost each other's test records.** Every worker
  read-modify-wrote the same `.jest-lineage-data.json`, a lost-update race that
  dropped records nondeterministically whenever `maxWorkers > 1`. Each process
  now owns its own shard file and the shards are merged after the run.
- **Identically named `it` blocks in different spec files overwrote each other.**
  The merge keyed on the test name alone even though each record already carried
  its `testFile`, so one test's coverage was lost and the survivor was attributed
  to a single entry — which redundancy analysis would then read as a spurious
  near-identical overlap. The merge key is now `testFile::name`.
- **A rerun of a failed suite no longer discards the rest of the run.** Test
  harnesses often rerun a failed suite in a second Jest process and report the
  aggregate; because each process cleared the shard directory on start, the
  second one deleted the first one's records and the report silently contained
  only the retried suite. Measured: a 14-suite / 56-test run whose single failed
  suite was retried produced a report of 6 tests, with nothing to indicate the
  other 50 had been dropped. Each process now keeps the shards belonging to its
  own run — see `JEST_LINEAGE_RUN_ID` above — and says on stdout when it carries
  any forward.
- **A test recorded twice now resolves to the later attempt.** Records carry a
  `recordedAt` stamp and the merge compares it, so a rerun that turns a failure
  into a pass contributes the passing run's coverage. Previously the winner was
  whichever record happened to sort last by shard filename, which says nothing
  about when it was written.
- Singular/plural in the redundancy markdown summary ("1 finding", not
  "1 findings").
- **Failures to read or write lineage data are now reported.** Corrupt records,
  unwritable shards, oversized data files and failed merges log a warning naming
  what is missing from the report, instead of silently falling back to empty
  data.

## [2.4.0] - 2026-09-03

### Added
- **Test redundancy analysis** — finds `it` blocks that exercise almost the same
  lines. Similarity is weighted by line rarity (`log(totalTests / testsCoveringLine)`)
  so that setup code every test runs does not make unrelated tests look identical.
- New **Redundancy** tab in the HTML report: findings, suggested fixes, an
  overlapping-pairs table and a per-test distinctiveness table.
- Machine-readable `test-redundancy.json` and `test-redundancy.md`, written next
  to the HTML report on every run. Full parity with the tab, but ~150x smaller,
  so agents and CI can consume it. Each test carries a `file.spec.ts:line`
  location resolved from the spec.
- `jest-lineage redundancy` CLI command (`--json`, `--markdown`, `--out`,
  `--min-similarity`, `--min-lines`), working off existing lineage data with no
  test re-run.
- `find_test_duplication` MCP tool.

### Fixed
- **Babel plugin corrupted `for` loops.** The `VariableDeclaration` visitor called
  `path.insertBefore()` unconditionally, including on a `for` statement's init
  clause, where the declaration is not in statement position. That detached the
  loop binding and made instrumented code throw `ReferenceError: <var> is not
  defined` at runtime — turning passing tests red. For-in and for-of heads were
  affected the same way.

### Changed
- Refreshed report styling: neutral palette, dark/light via `prefers-color-scheme`.



### Added
- GitHub Actions workflows for automated publishing
- Continuous Integration workflow for testing on multiple platforms
- Automated NPM publishing with provenance
- GitHub Release creation on version tags

### Changed
- Improved documentation structure

## [2.0.2] - 2024-08-20

### Fixed
- Updated files list in package.json
- Bug fixes and stability improvements

## [2.0.1] - 2024-08-20

### Added
- Public disclaimer in README
- Comprehensive mutation testing support
- Enable/disable controls for all features

### Changed
- Documentation improvements

## [2.0.0] - 2024-07-27

### Added
- Mutation testing capabilities
- Mutation survival analysis
- Test effectiveness validation
- Debug mode for mutations
- Mutation type configurations

### Changed
- Major architecture improvements
- Enhanced HTML report with 5 specialized views
- Improved performance tracking

## [1.x.x] - Previous Releases

### Added
- Line-by-line test coverage tracking
- Performance monitoring (CPU, memory, GC)
- Test quality analysis
- Interactive HTML reports
- Call depth tracking
- Babel plugin instrumentation
- Test setup integration

---

## Release Types

- **Major (x.0.0)**: Breaking changes
- **Minor (0.x.0)**: New features, backward compatible
- **Patch (0.0.x)**: Bug fixes, no breaking changes

## Links

- [NPM Package](https://www.npmjs.com/package/jest-test-lineage-reporter)
- [GitHub Repository](https://github.com/kivancbilen/jest-test-lineage-reporter)
- [Issue Tracker](https://github.com/kivancbilen/jest-test-lineage-reporter/issues)
