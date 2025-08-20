// This file contains functions with absolutely terrible tests that guarantee survived mutations

export function demonstrateSurvivedMutations(input: number): number {
  if (input === 42) {
    return 100;
  } else if (input > 50) {
    return input * 2;
  } else {
    return input + 10;
  }
}

export function anotherWeakFunction(x: number, y: number): boolean {
  if (x > y) {
    return true;
  } else {
    return false;
  }
}
