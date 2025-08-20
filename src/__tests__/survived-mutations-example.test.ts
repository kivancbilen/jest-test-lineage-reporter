import { demonstrateSurvivedMutations, anotherWeakFunction } from '../survived-mutations-example';

describe('Survived Mutations Example', () => {
  // This test is intentionally terrible to demonstrate survived mutations
  
  describe('demonstrateSurvivedMutations', () => {
    it('should just call the function', () => {
      // This test literally does NOTHING except call the function
      // No assertions whatsoever!

      demonstrateSurvivedMutations(42);   // Covers input === 42, return 100
      demonstrateSurvivedMutations(60);   // Covers input > 50, return input * 2
      demonstrateSurvivedMutations(5);    // Covers default case, return input + 10

      // NO EXPECTATIONS AT ALL!
      // This means ALL mutations will survive because we don't check anything
    });
  });

  describe('anotherWeakFunction', () => {
    it('should execute the function', () => {
      // This test calls the function but makes NO assertions!

      anotherWeakFunction(10, 5);   // Covers x > y, return true
      anotherWeakFunction(3, 8);    // Covers x <= y, return false

      // NO EXPECTATIONS AT ALL!
      // return true -> return false: SURVIVES
      // return false -> return true: SURVIVES
    });
  });
});
