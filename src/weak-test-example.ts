// This file contains functions with weak tests that will allow mutations to survive

export function simpleAdd(a: number, b: number): number {
  return a + b;
}

export function complexLogic(x: number, y: number): number {
  if (x > 10) {
    return x * 2;
  } else if (x < 0) {
    return 0;
  } else {
    return x + y;
  }
}

export function boundaryCheck(value: number): string {
  if (value >= 100) {
    return "high";
  } else if (value <= 0) {
    return "low";
  } else {
    return "medium";
  }
}

export function logicalOperations(a: boolean, b: boolean): boolean {
  if (a && b) {
    return true;
  } else if (a || b) {
    return !a;
  } else {
    return false;
  }
}

export function mathOperations(x: number): number {
  const squared = x * x;
  const doubled = x * 2;
  const halved = x / 2;
  return squared + doubled - halved;
}

export function stringOperations(str: string): string {
  if (str.length > 5) {
    return str.toUpperCase();
  } else if (str.length === 0) {
    return "empty";
  } else {
    return str.toLowerCase();
  }
}

export function incrementOperations(x: number): number {
  if (x > 10) {
    return ++x;
  } else if (x > 15) {
    return --x;
  } else {
    return x;
  }
}

export function subtleBugFunction(x: number, y: number): number {
  if (x === 0) {
    return 1;
  } else if (x > 0) {
    return x + y;
  } else {
    return x - y;
  }
}

export function reallyWeakFunction(a: number, b: number): number {
  const result = a * b;
  if (result > 100) {
    return result + 10;
  } else {
    return result - 5;
  }
}

export function guaranteedSurvivedMutations(x: number): number {
  if (x === 5) {
    return 42;
  } else if (x > 10) {
    return x * 2;
  } else {
    return x + 1;
  }
}
