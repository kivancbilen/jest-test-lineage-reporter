interface TestLineageTracker {
  currentTest: {
    name: string;
    testFile: string;
    startTime: number;
    coverage: Map<string, unknown>;
    qualityMetrics?: Record<string, unknown>;
  } | null;
  testCoverage: Map<string, unknown>;
  isTracking: boolean;
  isPerformanceTracking: boolean;
  isQualityTracking: boolean;
  currentTestFile: string | null;
  config: {
    enabled: boolean;
    lineageTracking: boolean;
    performanceTracking: boolean;
    qualityTracking: boolean;
  };
}

declare global {
  var __TRACK_LINE_EXECUTION__:
    | ((filePath: string, lineNumber: number) => void)
    | undefined;
  var __GET_LINEAGE_RESULTS__:
    | (() => Record<string, Record<string, unknown[]>>)
    | undefined;
  var __TEST_LINEAGE_TRACKER__: TestLineageTracker | undefined;
}

export {};
