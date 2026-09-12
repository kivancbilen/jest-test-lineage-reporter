# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Line numbers recorded on Vitest pointed at the wrong statement.** The Vite
  plugin instrumented after Vite's own transform, so Babel saw JavaScript and
  needed no TypeScript preset — but esbuild does not merely strip type
  annotations, it erases interfaces and type declarations outright. zod's
  `core/checks.ts` collapses from 1,207 lines to 518, and a comparison at source
  line 83 is recorded as line 31. Every source line number a Vitest run produced
  was therefore wrong, and mutation testing was worse than wrong: it mutates the
  file on disk by source line, looked up which tests covered that line, got the
  tests for an unrelated statement, ran them, and reported the mutant as
  survived. On zod this showed as a 9% mutation score. Instrumentation now runs
  before Vite's transform, with `@babel/preset-typescript` so Babel can parse
  the types itself. The same run now scores 66%, and the surviving mutants are
  real: `core/checks.ts:301` decides whether an unsafe integer reports `too_big`
  or `too_small`, and inverting it passes all 2,254 of zod's tests.
  `@babel/preset-typescript` is a new optional peer dependency.

### Added
- **Mutation testing works on Vitest.** Finding mutants, applying them and
  choosing which tests to re-run from the lineage were already runner-agnostic;
  only the command was not. `src/testRunners.js` now holds the per-runner
  spelling of "run these test names in these files" — Vitest takes file filters
  positionally and needs `--no-file-parallelism` where Jest needs `--runInBand`,
  since a mutation lives in a file on disk and parallel workers would race over
  it. Set `enableMutationTesting` on the Vitest reporter; the runner is detected
  from the project unless `testRunner` says otherwise.
- **`test-mutations.json`** beside the HTML report, listing every mutant with
  its line, mutator and status. A surviving mutant names a line whose behaviour
  no test checks, which is the most actionable thing this tool produces, and it
  was previously only visible inside a multi-megabyte HTML page.


## [3.0.0] - 2026-09-12

Adds Vitest support, and changes what the report is willing to claim. Both
changes came from pointing the analysis at codebases nobody here wrote.

### Breaking
- **`test-redundancy.json` is now schema version 3.** `summary.findings` counts
  duplicate clusters only, where version 2 counted duplicates and containment
  together, so the same field now reports a materially smaller number — 23
  rather than 470 on zod's suite. Containment moved to a new top-level
  `observations` array with its own `summary.observations` count. Anything
  reading `summary.findings`, or expecting containment inside `findings`, needs
  updating; check `schemaVersion` before parsing.
- **Roles are `keep` and `review`, not `keep` and `remove`.** Similarity is
  computed over lines executed in the code under test and never sees the
  assertions, so two tests can execute identical lines while asserting different
  outcomes, asserting something coverage cannot represent such as a re-render
  count, or taking different branches that resolve within one line — all three
  occur in react-hook-form. The report says "these drive the same code path",
  which is a weaker claim than it used to make.

### Added
- **Vitest support** for lineage tracking and redundancy analysis, as three
  pieces mirroring the Jest setup: `jest-test-lineage-reporter/vitest/plugin`
  (a Vite plugin), `/vitest/setup` and `/vitest/reporter`. The Vite plugin runs
  the *same* Babel plugin the Jest integration uses, so both runners agree on
  what gets instrumented and `JEST_LINEAGE_ENABLED` / `INCLUDE` / `EXCLUDE` mean
  the same thing on each. Everything downstream of collection — the overlap
  analysis, the redundancy report, the HTML — is shared unchanged. Verified
  against zod's suite (2,194 tests). Mutation testing, performance and memory
  tracking stay Jest-only: they wrap the test function, which the Vitest
  integration does not do.
- `projectRoot` option on the Babel plugin, so a runner that knows its own root
  can pin every recorded path to it.
- `containmentScope` option, `"same-file"` by default. `"any"` restores the
  pre-3.0 behaviour of reporting containment across spec files.

### Changed
- **Containment is reported, but no longer counted as a finding.** It is the
  weakest signal the analysis produces: "B reaches no line A misses" is true of
  any small test against a larger one that happens to run a superset of its
  lines. Two guards now apply and neither makes it strong. A pair must share at
  least `minRareSharedLines` (3) lines executed by no more than `rarityCeiling`
  (10%) of the suite — on react-hook-form this took one featureless test from 28
  observations to 1, while on zod, whose 2,194 tests are partitioned across four
  API surfaces so no line reaches 10% of the suite, the same guard changed
  nothing at all. And containment is now scoped to one spec file, because across
  files it was 357 of zod's 447 containment pairs and overwhelmingly unrelated
  tests: `z.minLength` "containing" `zod/mini has no validate method`. Duplicate
  detection held up on both suites under hand-checking; containment did not.
- **Findings lead with comparing assertions** rather than with deleting a test.

### Fixed
- **Recorded paths were wrong in a monorepo.** The plugin relativised each file
  against the nearest `package.json`, which differs per package, while the
  reporter reads them from wherever it was started — so in zod every path came
  back as `src/v4/...` when the reporter needed `packages/zod/src/v4/...`, and
  the HTML report could not find the sources to render. Runners now pass their
  project root; the Vitest plugin takes Vite's, and Jest's behaviour is
  unchanged when no root is given.
- **The publish workflow ran Node 14 and 16** against Jest 30, which needs 18+,
  so every release tag left a failed run behind. CI also now runs on every pull
  request rather than only those targeting `main`.

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
