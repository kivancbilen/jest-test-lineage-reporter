import { 
  simpleFunction,
  complexFunction,
  asyncFunction,
  errorProneFunction,
  wellTestedFunction,
  Calculator
} from '../quality-example';

describe('Test Quality Examples', () => {
  // High quality test - good assertions, error handling, edge cases
  test('wellTestedFunction should handle all edge cases properly', async () => {
    // Test normal cases
    expect(wellTestedFunction(5, 3)).toBe(8);
    expect(wellTestedFunction(0, 0)).toBe(0);
    expect(wellTestedFunction(1.5, 2.5)).toBe(4);
    
    // Test error cases
    expect(() => wellTestedFunction(null as any, 5)).toThrow('Parameter a is required');
    expect(() => wellTestedFunction(5, undefined as any)).toThrow('Parameter b is required');
    expect(() => wellTestedFunction('5' as any, 3)).toThrow('Both parameters must be numbers');
    expect(() => wellTestedFunction(-1, 5)).toThrow('Parameters must be non-negative');
    expect(() => wellTestedFunction(5, -1)).toThrow('Parameters must be non-negative');
    
    // Test boundary cases
    expect(wellTestedFunction(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
    expect(wellTestedFunction(0.1, 0.2)).toBeCloseTo(0.3);
  });

  // Medium quality test - some assertions, basic testing
  test('complexFunction should handle different data types', () => {
    expect(complexFunction('hello')).toBe('HELLO');
    expect(complexFunction(5)).toBe(25);
    expect(complexFunction(-3)).toBe(3);
    expect(complexFunction(0)).toBe(1);
    expect(complexFunction([1, 2, 3])).toEqual([2, 4, 6]);
    expect(complexFunction({ key: 'value' })).toBe('{"key":"value"}');
    
    // Test error cases
    expect(() => complexFunction(null)).toThrow('Data is required');
    expect(() => complexFunction(undefined)).toThrow('Data is required');
  });

  // Low quality test - minimal assertions, no error handling
  test('simpleFunction basic test', () => {
    expect(simpleFunction(5)).toBe(10);
  });

  // Async test with proper error handling
  test('asyncFunction should handle async operations correctly', async () => {
    const result = await asyncFunction(10);
    expect(result).toBe('Completed after 10ms');
    
    // Test error case
    await expect(asyncFunction(-1)).rejects.toThrow('Delay cannot be negative');
  });

  // Poor quality test - no error handling for error-prone function
  test('errorProneFunction test', () => {
    expect(errorProneFunction('hello')).toBe('HELLO');
    expect(errorProneFunction(123)).toBe('123');
    // Missing: null/undefined tests that would reveal bugs
  });

  // Test with mocking (affects isolation score)
  test('Calculator with mocking', () => {
    const calculator = new Calculator();
    const spy = jest.spyOn(calculator, 'add');
    
    calculator.add(2, 3);
    expect(spy).toHaveBeenCalledWith(2, 3);
    expect(calculator.getHistory()).toEqual([5]);
    
    spy.mockRestore();
  });

  // Long test (test smell)
  test('long test with many assertions', () => {
    const calc = new Calculator();
    
    // Too many assertions in one test
    expect(calc.add(1, 1)).toBe(2);
    expect(calc.add(2, 2)).toBe(4);
    expect(calc.add(3, 3)).toBe(6);
    expect(calc.add(4, 4)).toBe(8);
    expect(calc.add(5, 5)).toBe(10);
    expect(calc.add(6, 6)).toBe(12);
    expect(calc.add(7, 7)).toBe(14);
    expect(calc.add(8, 8)).toBe(16);
    expect(calc.add(9, 9)).toBe(18);
    expect(calc.add(10, 10)).toBe(20);
    expect(calc.add(11, 11)).toBe(22);
    expect(calc.add(12, 12)).toBe(24);
    
    expect(calc.getHistory()).toHaveLength(12);
    calc.clearHistory();
    expect(calc.getHistory()).toHaveLength(0);
  });

  // Test with complex control flow (high complexity)
  test('complex control flow test', () => {
    let result = 0;
    
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        if (i % 4 === 0) {
          result += complexFunction(i);
        } else {
          result += simpleFunction(i);
        }
      } else {
        if (i > 5) {
          result -= i;
        } else {
          result += i;
        }
      }
    }
    
    expect(result).toBeGreaterThan(0);
  });
});
