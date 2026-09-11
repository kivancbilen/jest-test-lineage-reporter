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

describe("babel plugin path scoping", () => {
  const saved = {
    include: process.env.JEST_LINEAGE_INCLUDE,
    exclude: process.env.JEST_LINEAGE_EXCLUDE,
  };

  afterEach(() => {
    delete process.env.JEST_LINEAGE_INCLUDE;
    delete process.env.JEST_LINEAGE_EXCLUDE;
    if (saved.include !== undefined) process.env.JEST_LINEAGE_INCLUDE = saved.include;
    if (saved.exclude !== undefined) process.env.JEST_LINEAGE_EXCLUDE = saved.exclude;
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
    process.env.JEST_LINEAGE_INCLUDE = "^/repo/packages/(inventory|sales)/src/";

    expect(isInstrumented("/repo/packages/inventory/src/b.ts")).toBe(true);
    expect(isInstrumented("/repo/vendor/packages/inventory/src/b.ts")).toBe(false);
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
