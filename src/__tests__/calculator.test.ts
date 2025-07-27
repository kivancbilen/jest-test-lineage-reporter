import { add, subtract, multiply } from '../calculator';

describe('Calculator', () => {
  it('should correctly add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('should subtract a smaller number from a larger one', () => {
    expect(subtract(5, 2)).toBe(3); // This will hit line 9
  });

  it('should subtract a larger number from a smaller one and return a positive result', () => {
    expect(subtract(2, 5)).toBe(3); // This will hit line 7
  });
    
  // This test covers the same line as the first subtraction test, which our report will show.
  it('should handle zero correctly in subtraction', () => {
    expect(subtract(10, 0)).toBe(10); // This will also hit line 9
  });

  // This test ONLY calls multiply, so it will show different coverage
  it('should multiply two numbers correctly', () => {
    expect(multiply(3, 4)).toBe(12); // This will ONLY hit line 13 (multiply function)
  });

  // This test ONLY calls add, so it will show different coverage
  it('should add negative numbers', () => {
    expect(add(-5, -3)).toBe(-8); // This will ONLY hit lines 2-3 (add function)
  });
});
