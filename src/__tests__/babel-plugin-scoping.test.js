const babel = require("@babel/core");
const lineageTrackerPlugin = require("../babel-plugin-lineage-tracker");

/** Instrumented output calls the line tracker; un-instrumented output does not. */
function isInstrumented(filename, source = "function f() { return 1; }") {
  const { code } = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [lineageTrackerPlugin],
  });
  return code.includes("__TRACK_LINE_EXECUTION__");
}

describe("babel plugin recorded paths", () => {
  const babel = require("@babel/core");
  const lineageTrackerPlugin = require("../babel-plugin-lineage-tracker");
  const path = require("path");

  /** The `file:line` string the instrumented code will report at runtime. */
  function recordedPath(filename, pluginOptions = {}) {
    const saved = process.env.JEST_LINEAGE_ENABLED;
    process.env.JEST_LINEAGE_ENABLED = "true";
    try {
      const { code } = babel.transformSync("function f() { return 1; }", {
        filename,
        babelrc: false,
        configFile: false,
        plugins: [[lineageTrackerPlugin, pluginOptions]],
      });
      const match = code.match(/__TRACK_LINE_EXECUTION__\("((?:[^"\\]|\\.)*)"/);
      // The match is a *source* string literal, so a Windows separator arrives
      // here escaped. Decode it to get the path the running code will report.
      return match && JSON.parse(`"${match[1]}"`);
    } finally {
      if (saved === undefined) delete process.env.JEST_LINEAGE_ENABLED;
      else process.env.JEST_LINEAGE_ENABLED = saved;
    }
  }

  it("records paths relative to an explicit project root", () => {
    // The monorepo case: without a root the plugin relativises against the
    // nearest package.json, which differs per package, so a reporter running
    // from the repo root cannot find the file again.
    const root = path.resolve("/repo");
    const file = path.join(root, "packages", "zod", "src", "v4", "parse.ts");

    expect(recordedPath(file, { projectRoot: root })).toBe(
      path.join("packages", "zod", "src", "v4", "parse.ts"),
    );
  });

  it("leaves the default behaviour alone when no root is given", () => {
    const file = path.join(path.resolve("/repo"), "src", "a.ts");
    const recorded = recordedPath(file);

    // Still a relative path, just resolved the old way.
    expect(recorded).toBeTruthy();
    expect(path.isAbsolute(recorded)).toBe(false);
  });
});

describe("babel plugin line numbers", () => {
  const babel = require("@babel/core");
  const lineageTrackerPlugin = require("../babel-plugin-lineage-tracker");

  /** Every line number the instrumented code will report at runtime. */
  function recordedLines(source, filename = "/repo/src/a.ts") {
    const saved = process.env.JEST_LINEAGE_ENABLED;
    process.env.JEST_LINEAGE_ENABLED = "true";
    try {
      const { code } = babel.transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        presets: [
          [
            require.resolve("@babel/preset-typescript"),
            { allExtensions: true },
          ],
        ],
        plugins: [[lineageTrackerPlugin, { projectRoot: "/repo" }]],
      });
      return [
        ...code.matchAll(/__TRACK_LINE_EXECUTION__\("[^"]+",\s*(\d+)/g),
      ].map((m) => Number(m[1]));
    } finally {
      if (saved === undefined) delete process.env.JEST_LINEAGE_ENABLED;
      else process.env.JEST_LINEAGE_ENABLED = saved;
    }
  }

  it("reports the line numbers of the original TypeScript", () => {
    // The mutation tester edits the file on disk, so a line number recorded
    // here has to mean the same line a human sees. Instrumenting after a
    // TypeScript transform has stripped the types would not: erasing these
    // interfaces moves `answer()` up by many lines.
    const source = [
      "interface Big {", // 1
      "  a: string;",
      "  b: number;",
      "  c: boolean;",
      "}", // 5
      "type Alias = Big | null;", // 6
      "export function answer(): number {", // 7
      "  return 42;", // 8
      "}", // 9
    ].join("\n");

    const lines = recordedLines(source);

    expect(lines.length).toBeGreaterThan(0);
    // Everything instrumented belongs to the function at lines 7-9; nothing
    // may be attributed to the erased type declarations above it.
    expect(Math.min(...lines)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...lines)).toBeLessThanOrEqual(9);
  });
});

describe("babel plugin path scoping", () => {
  const saved = {
    include: process.env.JEST_LINEAGE_INCLUDE,
    exclude: process.env.JEST_LINEAGE_EXCLUDE,
    enabled: process.env.JEST_LINEAGE_ENABLED,
  };

  // These cases are about which paths the plugin instruments, so they must not
  // inherit the ambient master switch — `npm run test:fast` sets it to "false",
  // which makes the plugin instrument nothing at all.
  beforeEach(() => {
    process.env.JEST_LINEAGE_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.JEST_LINEAGE_INCLUDE;
    delete process.env.JEST_LINEAGE_EXCLUDE;
    delete process.env.JEST_LINEAGE_ENABLED;
    if (saved.include !== undefined) process.env.JEST_LINEAGE_INCLUDE = saved.include;
    if (saved.exclude !== undefined) process.env.JEST_LINEAGE_EXCLUDE = saved.exclude;
    if (saved.enabled !== undefined) process.env.JEST_LINEAGE_ENABLED = saved.enabled;
  });

  it("instruments every source file when no filter is set", () => {
    expect(isInstrumented("/repo/packages/other/src/a.ts")).toBe(true);
    expect(isInstrumented("/repo/packages/inventory/src/b.ts")).toBe(true);
  });

  it("instruments only matching files when JEST_LINEAGE_INCLUDE is set", () => {
    process.env.JEST_LINEAGE_INCLUDE = "packages/inventory/";

    expect(isInstrumented("/repo/packages/inventory/src/b.ts")).toBe(true);
    expect(isInstrumented("/repo/packages/other/src/a.ts")).toBe(false);
  });

  it("accepts a comma-separated list of patterns", () => {
    process.env.JEST_LINEAGE_INCLUDE = "packages/inventory/, packages/sales/";

    expect(isInstrumented("/repo/packages/inventory/src/b.ts")).toBe(true);
    expect(isInstrumented("/repo/packages/sales/src/c.ts")).toBe(true);
    expect(isInstrumented("/repo/packages/other/src/a.ts")).toBe(false);
  });

  it("treats each pattern as a regular expression", () => {
    // Anchored at the resolved root, because Babel makes the filename absolute
    // and on Windows that gains a drive letter — "^/repo/" would never match.
    const root = require("path").resolve("/repo").replace(/\\/g, "/");
    process.env.JEST_LINEAGE_INCLUDE = `^${root}/packages/(inventory|sales)/src/`;

    expect(isInstrumented(`${root}/packages/inventory/src/b.ts`)).toBe(true);
    expect(isInstrumented(`${root}/vendor/packages/inventory/src/b.ts`)).toBe(false);
  });

  it("falls back to a substring match for patterns that are not valid regexes", () => {
    process.env.JEST_LINEAGE_INCLUDE = "src/a(.ts";

    expect(isInstrumented("/repo/src/a(.ts")).toBe(true);
    expect(isInstrumented("/repo/src/b.ts")).toBe(false);
  });

  it("lets JEST_LINEAGE_EXCLUDE win over the include list", () => {
    process.env.JEST_LINEAGE_INCLUDE = "packages/inventory/";
    process.env.JEST_LINEAGE_EXCLUDE = "packages/inventory/src/generated/";

    expect(isInstrumented("/repo/packages/inventory/src/b.ts")).toBe(true);
    expect(isInstrumented("/repo/packages/inventory/src/generated/g.ts")).toBe(
      false,
    );
  });

  it("still skips test files and node_modules that the include list matches", () => {
    process.env.JEST_LINEAGE_INCLUDE = "packages/inventory/";

    expect(isInstrumented("/repo/packages/inventory/src/b.spec.ts")).toBe(false);
    expect(
      isInstrumented("/repo/packages/inventory/node_modules/dep/index.js"),
    ).toBe(false);
  });
});
