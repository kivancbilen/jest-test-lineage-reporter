declare global {
  var __TRACK_LINE_EXECUTION__: ((filePath: string, lineNumber: number) => void) | undefined;
  var __GET_LINEAGE_RESULTS__: (() => any) | undefined;
  var __TEST_LINEAGE_TRACKER__: any;
}

export {};
