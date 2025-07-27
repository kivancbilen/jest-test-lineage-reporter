import { 
  lightweightFunction,
  mediumFunction,
  heavyFunction,
  memoryIntensiveFunction,
  recursiveFunction,
  nestedCallsFunction,
  mixedPerformanceFunction,
  performanceVariableFunction
} from '../performance-example';

describe.skip('Performance Tracking Examples', () => {
  test('should track lightweight function performance', () => {
    // This should show minimal CPU cycles
    const result = lightweightFunction(5);
    expect(result).toBe(6);
  });

  test('should track medium function performance', () => {
    // This should show moderate CPU cycles
    const result = mediumFunction(4);
    expect(result).toBeGreaterThan(0);
  });

  test('should track heavy function performance', () => {
    // This should show high CPU cycles
    const result = heavyFunction(2);
    expect(result).toBeGreaterThan(0);
  });

  test('should track memory intensive function', () => {
    // This should show memory allocation patterns
    const result = memoryIntensiveFunction(1000);
    expect(result).toHaveLength(1000);
  });

  test('should track recursive function with exponential complexity', () => {
    // This should show very high CPU cycles due to recursion
    const result = recursiveFunction(5);
    expect(result).toBeGreaterThan(0);
  });

  test('should track nested calls with different depths', () => {
    // This should show performance at different call depths
    const result = nestedCallsFunction(10);
    expect(result).toBeGreaterThan(0);
  });

  test('should track mixed performance patterns', () => {
    // This should show variable performance within one test
    const result = mixedPerformanceFunction(10);
    expect(result).toBeGreaterThan(0);
  });

  test('should track fast mode performance', () => {
    // Fast execution path
    const result = performanceVariableFunction('fast');
    expect(result).toBe(43);
  });

  test('should track medium mode performance', () => {
    // Medium execution path
    const result = performanceVariableFunction('medium');
    expect(result).toBeGreaterThan(0);
  });

  test('should track slow mode performance', () => {
    // Slow execution path
    const result = performanceVariableFunction('slow');
    expect(result).toBeGreaterThan(0);
  });

  test('should demonstrate performance hotspot', () => {
    // Call heavy function multiple times to create hotspot
    let total = 0;
    let i = 0;
    while (i < 3) {
      total += heavyFunction(i);
      i++;
    }
    expect(total).toBeGreaterThan(0);
  });
});
