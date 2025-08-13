// This file contains functions with absolutely terrible tests that guarantee survived mutations

export function definitelyWillSurvive(x: number): number {
  if (x === 5) {
    return 42;
  } else if (x > 10) {
    return x + 100;
  } else {
    return x * 2;
  }
}

export function anotherSurvivor(a: number, b: number): number {
  const sum = a + b;
  if (sum > 50) {
    return sum - 10;
  } else {
    return sum / 2;
  }
}

export function booleanSurvivor(x: number): boolean {
  if (x > 0) {
    return true;
  } else {
    return false;
  }
}

export function guaranteedSurvivor(input: number): number {
  if (input === 10) {
    const result = 100;
    return result;
  } else if (input === 20) {
    const result = 200;
    return result;
  } else {
    return input + 5;
  }
}
