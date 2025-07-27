import {
  directFunction,
  oneLevel,
  twoLevels,
  threeLevels,
  complexFunction,
  recursiveFunction,
  memoryLeakFunction,
  clearMemoryLeaks,
  getMemoryLeakCount
} from '../depth-example';

describe('Call Depth Tracking Examples', () => {
  test('should call directFunction directly (depth 1)', () => {
    const result = directFunction(5);
    expect(result).toBe(10);
  });

  test('should call directFunction through oneLevel (depth 2)', () => {
    const result = oneLevel(5);
    expect(result).toBe(11);
  });

  test('should call directFunction through twoLevels (depth 3)', () => {
    const result = twoLevels(5);
    expect(result).toBe(12);
  });

  test('should call directFunction through threeLevels (depth 4)', () => {
    const result = threeLevels(5);
    expect(result).toBe(13);
  });

  test('should call directFunction at multiple depths in complexFunction', () => {
    const result = complexFunction(5);
    expect(result).toBe(33); // 10 + 11 + 12 = 33
  });

  test('should call directFunction through recursive calls (very deep)', () => {
    const result = recursiveFunction(5);
    expect(result).toBe(13); // 10 + 1 + 1 + 1 = 13
  });

  test('should demonstrate memory leak detection with large allocations', () => {
    // This test intentionally creates memory leaks to demonstrate tracking
    const largeArrays = [];

    // Create multiple large arrays (each >1MB) to trigger memory leak detection
    for (let i = 0; i < 3; i++) {
      // Allocate ~2MB array (will trigger 🚨LEAK alert)
      const largeArray = new Array(500000).fill(0).map((_, index) => ({
        id: index,
        data: `Large data string for item ${index} with extra padding to increase memory usage`,
        timestamp: Date.now(),
        metadata: {
          created: new Date(),
          processed: false,
          tags: ['memory', 'test', 'large', 'allocation']
        }
      }));

      largeArrays.push(largeArray);

      // Call our function to track memory usage at different call depths
      const result = directFunction(i);
      expect(result).toBe(i * 2);
    }

    // Verify we created the expected number of arrays
    expect(largeArrays).toHaveLength(3);
    expect(largeArrays[0]).toHaveLength(500000);

    // Test edge cases with memory allocation
    expect(largeArrays[0][0]).toHaveProperty('id', 0);
    expect(largeArrays[0][0]).toHaveProperty('data');
    expect(largeArrays[0][0].metadata).toHaveProperty('tags');
    expect(largeArrays[0][0].metadata.tags).toContain('memory');

    // Test error conditions
    expect(() => {
      if (largeArrays.length === 0) {
        throw new Error('No arrays created');
      }
    }).not.toThrow();

    // Test boundary conditions
    expect(largeArrays[2][499999]).toHaveProperty('id', 499999);

    // This should show high memory usage, multiple assertions, and good error handling
    // Expected quality metrics:
    // - High assertion count (8+ expect statements)
    // - Error handling (try/catch equivalent with expect().not.toThrow())
    // - Edge case testing (boundary values, null checks)
    // - Memory leak detection (large allocations)
  });

  test('should demonstrate GC pressure with many small allocations', () => {
    const smallObjects = [];

    // Create many small objects to trigger GC pressure detection
    for (let i = 0; i < 1000; i++) {
      // Small allocations (<1KB each) to trigger 🗑️GC alert
      const smallObj = {
        id: i,
        value: Math.random(),
        processed: false
      };
      smallObjects.push(smallObj);

      // Call function at different depths to test performance impact
      if (i % 100 === 0) {
        const result = oneLevel(i);
        expect(result).toBeGreaterThan(i);
      }
    }

    expect(smallObjects).toHaveLength(1000);
    expect(smallObjects[999]).toHaveProperty('id', 999);

    // This should show GC pressure but smaller memory footprint
  });

  test('should demonstrate slow execution patterns', () => {
    const results = [];

    // Create intentionally variable performance to trigger slow execution detection
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      // Sometimes do heavy work, sometimes light work (creates performance variance)
      if (i % 2 === 0) {
        // Heavy work - should be slower
        let heavyResult = 0;
        for (let j = 0; j < 10000; j++) {
          heavyResult += Math.sin(j) * Math.cos(j);
        }
        results.push(heavyResult);
      } else {
        // Light work - should be faster
        results.push(i * 2);
      }

      const result = directFunction(i);
      expect(result).toBe(i * 2);

      const endTime = Date.now();
      expect(endTime).toBeGreaterThanOrEqual(startTime);
    }

    expect(results).toHaveLength(5);

    // This should show performance variance and trigger 🐌SLOW alert
  });

  test('should create actual memory leaks with large objects', () => {
    // Clear any existing leaks first
    const initialCount = getMemoryLeakCount();
    expect(initialCount).toBeGreaterThanOrEqual(0);

    // Create multiple memory leaks with large objects
    for (let i = 0; i < 3; i++) {
      // Each call creates ~1MB of leaked memory (1000 items * 1KB each)
      const result = memoryLeakFunction(1000);
      expect(result).toBe(1000 * 2); // directFunction returns x * 2

      // Verify memory leak count is increasing
      const currentCount = getMemoryLeakCount();
      expect(currentCount).toBe(initialCount + i + 1);
    }

    // Verify we have created 3 memory leaks
    const finalCount = getMemoryLeakCount();
    expect(finalCount).toBe(initialCount + 3);

    // This test should show:
    // - High memory usage (3MB+ leaked)
    // - 🚨LEAK alerts in console
    // - Multiple expect() statements (good assertion count)
    // - Error handling with expect().toBe() validations
  });

  test('should create massive memory leak for testing', () => {
    // Create a very large memory leak to ensure detection
    const initialMemoryCount = getMemoryLeakCount();

    // Create 5 large objects (each ~2MB)
    for (let i = 0; i < 5; i++) {
      const result = memoryLeakFunction(2000); // 2000 items * ~1KB each = ~2MB
      expect(result).toBe(2000 * 2);

      // Verify the leak is growing
      expect(getMemoryLeakCount()).toBeGreaterThan(initialMemoryCount + i);
    }

    // Verify total memory leaks
    const totalLeaks = getMemoryLeakCount();
    expect(totalLeaks).toBeGreaterThanOrEqual(initialMemoryCount + 5);

    // Test edge cases
    expect(() => memoryLeakFunction(0)).not.toThrow();
    expect(memoryLeakFunction(0)).toBe(0);

    // Test error conditions
    expect(() => {
      if (totalLeaks < 0) {
        throw new Error('Invalid leak count');
      }
    }).not.toThrow();

    // This should create ~10MB of leaked memory and trigger multiple 🚨LEAK alerts
    // Quality metrics should show:
    // - High assertion count (8+ expect statements)
    // - Good error handling (expect().not.toThrow())
    // - Edge case testing (zero values, negative checks)
    // - Boundary testing (memory thresholds)
  });

  test('should demonstrate memory cleanup', () => {
    // Create some leaks first
    const result1 = memoryLeakFunction(500);
    const result2 = memoryLeakFunction(500);

    expect(result1).toBe(1000);
    expect(result2).toBe(1000);
    expect(getMemoryLeakCount()).toBeGreaterThanOrEqual(2);

    // Clear all memory leaks
    const clearedCount = clearMemoryLeaks();
    expect(clearedCount).toBeGreaterThanOrEqual(2);
    expect(getMemoryLeakCount()).toBe(0);

    // Verify cleanup worked
    expect(getMemoryLeakCount()).toBe(0);

    // This test shows proper cleanup and should have fewer memory issues
  });
});
