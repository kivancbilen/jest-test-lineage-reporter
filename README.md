# Jest Test Lineage Reporter

**Find the tests you can delete.**

Jest tells you which lines are covered. It does not tell you _which test_ covered
them — so it cannot tell you that three of your tests are exercising the same
code. This reporter records line coverage **per `it` block**, then uses that to
find redundant tests, answer "what covers this line?", and score test quality.

[![npm](https://img.shields.io/npm/v/jest-test-lineage-reporter.svg)](https://www.npmjs.com/package/jest-test-lineage-reporter)
[![license](https://img.shields.io/npm/l/jest-test-lineage-reporter.svg)](./LICENSE)
[![CI](https://github.com/kivancbilen/jest-test-lineage-reporter/actions/workflows/ci.yml/badge.svg)](https://github.com/kivancbilen/jest-test-lineage-reporter/actions/workflows/ci.yml)

<!-- TODO: add a screenshot/GIF of the Redundancy tab here — docs/images/redundancy.png -->

## Install

```bash
npm install --save-dev jest-test-lineage-reporter
npx jest-lineage init      # writes jest.config.js + babel.config.js
npx jest-lineage test      # run your suite with lineage tracking
npx jest-lineage redundancy   # what can I delete?
```

Or wire it up by hand:

```js
// jest.config.js
module.exports = {
  collectCoverage: true,
  reporters: ["default", "jest-test-lineage-reporter"],
  setupFilesAfterEnv: ["jest-test-lineage-reporter/src/testSetup.js"],
  transform: { "^.+\\.(ts|tsx|js|jsx)$": "babel-jest" },
};

// babel.config.js
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
  plugins: ["jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js"],
};
```

Full setup, TypeScript and monorepo notes: [docs/SETUP.md](docs/SETUP.md).

## Finding redundant tests

Comparing raw coverage sets does not work on a real suite. Every test in a file
runs the same `beforeEach` and the same fixture helpers, so any two tests look
~90% identical no matter what they assert.

So each line is weighted by how _rare_ it is across the suite:

```
weight(line) = log(totalTests / testsCoveringLine)
```

A line every test runs weighs 0 and drops out. A line only two tests reach is
what actually distinguishes them. Both the raw and weighted numbers are shown,
and the gap between them is informative — raw 95% / weighted 10% is the
signature of two genuinely different tests sitting behind a big shared fixture.

Findings come in two kinds:

- **Tests that do the same thing** — groups of mutually near-identical tests.
  Fold them together, or use `it.each` if they differ only by input.
- **Tests already covered by another** — directional: everything test B reaches
  is already reached by test A. Delete B, or strengthen it so the difference
  actually reaches the source code.

Containment is reported per pair rather than clustered, because "A contains B"
does not chain — one broad end-to-end test contains many narrow ones without
those narrow tests being equivalent to each other.

```js
// jest.config.js
module.exports = {
  reporters: [
    "default",
    [
      "jest-test-lineage-reporter",
      {
        overlap: {
          duplicateThreshold: 0.9,
          subsetThreshold: 0.9,
          minLinesPerTest: 3,
        },
      },
    ],
  ],
};
```

### Output for CI and agents

The HTML report is for humans and gets large on a real suite, so every run also
writes two small artifacts beside it:

```
test-redundancy.json   self-describing findings, stable ordering
test-redundancy.md     the same findings as prose — for a PR comment or an agent
```

Each finding carries a verdict (`identical` / `near-identical` / `contained`),
the metrics behind it, and a `location` of `path/to/file.spec.ts:42` per test —
the line of the `it` block itself, resolved by reading the spec.

## Also included

|                          |                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **Line-by-line lineage** | `npx jest-lineage query src/calculator.ts 42` — which tests execute this line              |
| **Mutation testing**     | Built in, with parallel workers and Docker sharding — [docs](docs/MUTATION_DEBUG_GUIDE.md) |
| **Performance & memory** | Per-test CPU, allocation and GC-pressure tracking                                          |
| **Test quality scoring** | Assertion density, call depth, reliability heuristics                                      |
| **MCP server**           | Point Claude Code or Cursor at the data and ask what to delete                             |

## Documentation

- [Setup](docs/SETUP.md) · [Usage](docs/USAGE_GUIDE.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Full reference](docs/REFERENCE.md) — every option and environment variable
- [Docker](docs/DOCKER.md) · [Mutation testing](docs/MUTATION_DEBUG_GUIDE.md)
- [Changelog](CHANGELOG.md)

## Status

v2.x, actively developed and used daily on a large TypeScript monorepo. Much of
it was written with heavy AI assistance, and the API may still change between
minor versions — pin the version in CI. Bug reports and PRs are very welcome.

Requires Node 18+ and Jest 29+.

## License

MIT © [Kivanc Bilen](https://github.com/kivancbilen)
