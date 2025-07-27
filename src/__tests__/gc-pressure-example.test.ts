import {
  badGCPressureFunction,
  goodGCPressureFunction,
  badStringConcatenation,
  goodStringConcatenation,
  badArrayOperations,
  goodArrayOperations,
  objectPoolExample
} from '../gc-pressure-example';

describe.skip('GC Pressure Examples', () => {
  test.skip('should demonstrate BAD GC pressure with many small objects', () => {
    // This test creates many small objects and should trigger 🗑️GC alerts
    
    const result1 = badGCPressureFunction(1000); // Creates 2000+ small objects
    expect(result1).toBeGreaterThan(0);
    expect(typeof result1).toBe('number');
    
    const result2 = badGCPressureFunction(500);  // Creates 1000+ small objects
    expect(result2).toBeGreaterThan(0);
    expect(result2).toBeLessThan(result1);
    
    // Test edge cases
    expect(badGCPressureFunction(0)).toBe(0);
    expect(badGCPressureFunction(1)).toBeGreaterThan(0);
    
    // This should show:
    // - 🗑️GC alerts due to many small object allocations
    // - High memory churn but relatively small total memory
    // - Multiple expect statements for good test quality
  });

  test('should demonstrate GOOD GC behavior with object reuse', () => {
    // This test reuses objects and should have minimal GC pressure
    
    const result1 = goodGCPressureFunction(1000); // Reuses same objects
    expect(result1).toBeGreaterThan(0);
    expect(typeof result1).toBe('number');
    
    const result2 = goodGCPressureFunction(500);
    expect(result2).toBeGreaterThan(0);
    expect(result2).toBeLessThan(result1);
    
    // Test edge cases
    expect(goodGCPressureFunction(0)).toBe(0);
    expect(goodGCPressureFunction(1)).toBeGreaterThan(0);
    
    // This should show:
    // - Minimal or no 🗑️GC alerts
    // - Lower memory usage than the bad example
    // - Better performance consistency
  });

  test('should demonstrate BAD string concatenation GC pressure', () => {
    // String concatenation in loops creates many temporary strings
    
    const items = Array.from({ length: 1000 }, (_, i) => `item${i}`);
    
    const result = badStringConcatenation(items);
    expect(result).toContain('item0');
    expect(result).toContain('item999');
    expect(result.split(', ')).toHaveLength(1001); // 1000 items + empty string at end
    
    // Test with smaller arrays
    const smallItems = ['a', 'b', 'c'];
    const smallResult = badStringConcatenation(smallItems);
    expect(smallResult).toBe('a, b, c, ');
    
    // This should trigger 🗑️GC due to many temporary string objects
  });

  test('should demonstrate GOOD string concatenation', () => {
    // Array.join() creates only one final string
    
    const items = Array.from({ length: 1000 }, (_, i) => `item${i}`);
    
    const result = goodStringConcatenation(items);
    expect(result).toContain('item0');
    expect(result).toContain('item999');
    expect(result.split(', ')).toHaveLength(1000);
    
    // Test with smaller arrays
    const smallItems = ['a', 'b', 'c'];
    const smallResult = goodStringConcatenation(smallItems);
    expect(smallResult).toBe('a, b, c');
    
    // This should have minimal GC pressure
  });

  test('should demonstrate BAD array operations with multiple allocations', () => {
    // Chained array operations create many intermediate arrays
    
    const numbers = Array.from({ length: 1000 }, (_, i) => i);
    
    const result = badArrayOperations(numbers);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(x => x % 2 === 0)).toBe(true);
    expect(result.every(x => x > 10)).toBe(true);
    
    // Test edge cases
    expect(badArrayOperations([])).toEqual([]);
    expect(badArrayOperations([1, 2, 3])).toEqual([]);
    expect(badArrayOperations([10, 20, 30])).toEqual([22, 42, 62]);
    
    // This should trigger 🗑️GC due to multiple intermediate arrays
  });

  test('should demonstrate GOOD array operations with single allocation', () => {
    // Single reduce operation creates only one final array
    
    const numbers = Array.from({ length: 1000 }, (_, i) => i);
    
    const result = goodArrayOperations(numbers);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(x => x % 2 === 0)).toBe(true);
    expect(result.every(x => x > 10)).toBe(true);
    
    // Test edge cases
    expect(goodArrayOperations([])).toEqual([]);
    expect(goodArrayOperations([1, 2, 3])).toEqual([]);
    expect(goodArrayOperations([10, 20, 30])).toEqual([22, 42, 62]);
    
    // This should have minimal GC pressure
  });

  test('should demonstrate object pooling for optimal GC behavior', () => {
    // Object pooling reuses pre-allocated objects
    
    const result1 = objectPoolExample(1000);
    expect(result1).toBeGreaterThan(0);
    expect(typeof result1).toBe('number');
    
    const result2 = objectPoolExample(500);
    expect(result2).toBeGreaterThan(0);
    expect(result2).toBeLessThan(result1);
    
    // Test edge cases
    expect(objectPoolExample(0)).toBe(0);
    expect(objectPoolExample(1)).toBeGreaterThan(0);
    
    // This should have the best GC behavior - minimal allocations
  });

  test('should compare all GC pressure patterns', () => {
    // Compare all patterns to show the difference
    
    const testSize = 100;
    
    const badResult = badGCPressureFunction(testSize);
    const goodResult = goodGCPressureFunction(testSize);
    const poolResult = objectPoolExample(testSize);
    
    // All should produce similar numerical results
    expect(badResult).toBeGreaterThan(0);
    expect(goodResult).toBeGreaterThan(0);
    expect(poolResult).toBeGreaterThan(0);
    
    // But GC behavior should be very different:
    // - badResult: High 🗑️GC pressure
    // - goodResult: Medium 🗑️GC pressure  
    // - poolResult: Minimal 🗑️GC pressure
    
    expect(typeof badResult).toBe('number');
    expect(typeof goodResult).toBe('number');
    expect(typeof poolResult).toBe('number');
  });
});
