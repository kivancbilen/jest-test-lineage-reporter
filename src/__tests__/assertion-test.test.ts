import { directFunction } from '../depth-example';

describe('Assertion Counting Test', () => {
  test('should count multiple expect statements correctly', () => {
    // This test has many expect statements to test assertion counting
    
    const result1 = directFunction(5);
    expect(result1).toBe(10);
    expect(result1).toBeGreaterThan(5);
    expect(result1).toBeLessThan(20);
    
    const result2 = directFunction(0);
    expect(result2).toBe(0);
    expect(result2).toEqual(0);
    expect(result2).not.toBe(1);
    
    const result3 = directFunction(-5);
    expect(result3).toBe(-10);
    expect(result3).toBeLessThan(0);
    expect(result3).toBeGreaterThan(-20);
    
    // Test arrays and objects
    const results = [result1, result2, result3];
    expect(results).toHaveLength(3);
    expect(results).toContain(10);
    expect(results).toContain(0);
    expect(results).toContain(-10);
    
    // Test properties
    const obj = { value: result1 };
    expect(obj).toHaveProperty('value');
    expect(obj).toHaveProperty('value', 10);
    
    // Test null/undefined
    expect(result1).toBeDefined();
    expect(result1).not.toBeNull();
    expect(result1).not.toBeUndefined();
    
    // Test truthiness
    expect(result1).toBeTruthy();
    expect(result2).toBeFalsy();
    
    // Test error handling
    expect(() => {
      if (result1 < 0) {
        throw new Error('Should not be negative');
      }
    }).not.toThrow();
    
    // This test should show:
    // - 22+ expect statements (high assertion count)
    // - Error handling with expect().not.toThrow()
    // - Property testing with toHaveProperty()
    // - Array testing with toContain() and toHaveLength()
    // - Boundary testing with toBeGreaterThan/toBeLessThan
    // - Null/undefined testing
    // - Truthiness testing
  });
});
