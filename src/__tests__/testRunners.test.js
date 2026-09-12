const path = require("path");
const { detectRunner, buildRunCommand } = require("../testRunners");

describe("buildRunCommand", () => {
  const opts = {
    testFiles: ["/repo/a.test.ts", "/repo/b.test.ts"],
    testNames: ["adds two numbers"],
  };

  it("asks jest for the covering files and test names", () => {
    const { args } = buildRunCommand("jest", "/repo", opts);

    expect(args).toContain("--testPathPatterns=/repo/a.test.ts|/repo/b.test.ts");
    expect(args).toContain("--testNamePattern=(adds two numbers)");
    // A mutation is applied to a file on disk, so the run must be serial.
    expect(args).toContain("--runInBand");
  });

  it("asks vitest for the same thing in its own spelling", () => {
    const { command, args } = buildRunCommand("vitest", "/repo", opts);

    // With no local binary the call goes through npx, which shifts everything
    // along by one; the subcommand is what matters either way.
    const subcommand = command === "npx" ? args[1] : args[0];
    expect(subcommand).toBe("run");
    // Vitest takes file filters positionally rather than as a flag.
    expect(args).toContain("/repo/a.test.ts");
    expect(args).toContain("/repo/b.test.ts");
    expect(args).toContain("--testNamePattern");
    expect(args).toContain("(adds two numbers)");
    // The equivalent of --runInBand: one process, or workers race over the
    // mutated source file.
    expect(args).toContain("--no-file-parallelism");
  });

  it("escapes regex metacharacters in test names", () => {
    const { args } = buildRunCommand("vitest", "/repo", {
      testFiles: ["a.test.ts"],
      testNames: ["parses a.b(c) [x]"],
    });

    const pattern = args[args.indexOf("--testNamePattern") + 1];
    expect(pattern).toBe("(parses a\\.b\\(c\\) \\[x\\])");
    expect(() => new RegExp(pattern)).not.toThrow();
  });

  it("omits the name filter when no test names are known", () => {
    const { args } = buildRunCommand("vitest", "/repo", {
      testFiles: ["a.test.ts"],
      testNames: [],
    });

    expect(args).not.toContain("--testNamePattern");
  });

  it("passes a config path through to vitest", () => {
    const { args } = buildRunCommand("vitest", "/repo", {
      ...opts,
      configPath: "/repo/vitest.lineage.config.ts",
    });

    expect(args).toContain("--config");
    expect(args).toContain("/repo/vitest.lineage.config.ts");
  });

  it("falls back to npx when the project has no local binary", () => {
    const { command, args } = buildRunCommand("vitest", "/nonexistent", opts);

    expect(command).toBe("npx");
    expect(args[0]).toBe("vitest");
  });

  it("treats an unknown runner as jest", () => {
    const { args } = buildRunCommand("mocha", "/repo", opts);
    expect(args.some((a) => a.startsWith("--testPathPatterns="))).toBe(true);
  });
});

describe("detectRunner", () => {
  it("honours an explicit choice", () => {
    expect(detectRunner("/repo", "vitest")).toBe("vitest");
    expect(detectRunner("/repo", "jest")).toBe("jest");
  });

  it("ignores an explicit choice it does not know", () => {
    expect(detectRunner("/repo", "ava")).toBe("jest");
  });

  it("defaults to jest when nothing is installed", () => {
    expect(detectRunner("/nonexistent")).toBe("jest");
  });

  it("finds the runner installed in the project", () => {
    // This package has jest in its own node_modules and not vitest.
    const repoRoot = path.resolve(__dirname, "..", "..");
    expect(detectRunner(repoRoot)).toBe("jest");
  });
});
