export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  if (a < b) {
    return b - a;
  }
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
