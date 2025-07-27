// Example file to demonstrate test quality metrics

export function simpleFunction(x: number): number {
  return x * 2;
}

export function complexFunction(data: any): any {
  if (data === null || data === undefined) {
    throw new Error('Data is required');
  }
  
  if (typeof data === 'string') {
    return data.toUpperCase();
  } else if (typeof data === 'number') {
    if (data < 0) {
      return Math.abs(data);
    } else if (data === 0) {
      return 1;
    } else {
      return data * data;
    }
  } else if (Array.isArray(data)) {
    return data.map(item => item * 2);
  } else {
    return JSON.stringify(data);
  }
}

export async function asyncFunction(delay: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (delay < 0) {
      reject(new Error('Delay cannot be negative'));
    } else {
      setTimeout(() => {
        resolve(`Completed after ${delay}ms`);
      }, delay);
    }
  });
}

export function errorProneFunction(input: any): string {
  // This function has potential issues
  return input.toString().toUpperCase();
}

export function wellTestedFunction(a: number, b: number): number {
  if (a === null || a === undefined) {
    throw new Error('Parameter a is required');
  }
  if (b === null || b === undefined) {
    throw new Error('Parameter b is required');
  }
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both parameters must be numbers');
  }
  if (a < 0 || b < 0) {
    throw new Error('Parameters must be non-negative');
  }
  
  return a + b;
}

export class Calculator {
  private history: number[] = [];
  
  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }
  
  getHistory(): number[] {
    return [...this.history];
  }
  
  clearHistory(): void {
    this.history = [];
  }
}
