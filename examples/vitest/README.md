# Using the reporter with Vitest

Three pieces, mirroring the Jest setup:

| Piece | What it does |
| --- | --- |
| `vitest/plugin` | Vite plugin that instruments your source |
| `vitest/setup` | records which lines each `it` block executed |
| `vitest/reporter` | writes the HTML, JSON and Markdown reports |

Copy `vitest.config.mjs` from this directory, then:

```bash
npm install --save-dev jest-test-lineage-reporter @babel/core
npx vitest run
```

`@babel/core` is a peer dependency: the instrumentation is a Babel plugin, and
Vitest projects do not usually have Babel installed.

## Scoping what gets instrumented

The same environment variables work on both runners:

```bash
JEST_LINEAGE_INCLUDE="/src/" JEST_LINEAGE_EXCLUDE="/tests/" npx vitest run
```

In a monorepo this matters — without it, every test records the lines it
executed across every package.

## Turning it off

`JEST_LINEAGE_ENABLED=false` skips instrumentation and reporting, for a fast run.

## Differences from the Jest integration

- **Shard files are not used.** Vitest carries each test's lineage back to the
  reporter on `task.meta`, so there is nothing to write to disk and nothing to
  merge. `JEST_LINEAGE_RUN_ID` and `JEST_LINEAGE_RUN_GAP` have no effect here.
- **Performance and memory tracking are Jest-only.** They wrap the test
  function, which the Vitest integration does not do. Lineage, redundancy
  analysis and mutation testing are the same on both.
- **Mutation testing** is opt-in: pass `enableMutationTesting: true` to the
  reporter. Each mutant re-runs only the tests whose lineage covers the mutated
  line, and results are written to `test-mutations.json`. Note that mutations
  are applied to your source file on disk and restored afterwards; an
  interrupted run can leave one behind, so check `git status` before
  committing.
- **Babel runs after Vite's own transform**, which costs a second parse. Scope
  instrumentation with `JEST_LINEAGE_INCLUDE` on a large codebase.
