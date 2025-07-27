// Examples demonstrating GC pressure and how to fix it

// BAD: Creates many small objects (causes GC pressure)
export function badGCPressureFunction(count: number): number {
  let total = 0;
  
  for (let i = 0; i < count; i++) {
    // Creating new objects in a loop - BAD for GC
    const tempObj = {
      id: i,
      value: Math.random(),
      timestamp: Date.now(),
      processed: false
    };
    
    // More object creation
    const result = {
      input: tempObj,
      output: tempObj.value * 2,
      metadata: {
        created: new Date(),
        index: i
      }
    };
    
    total += result.output;
  }
  
  return total;
}

// GOOD: Reuses objects (reduces GC pressure)
export function goodGCPressureFunction(count: number): number {
  let total = 0;
  
  // Reuse objects instead of creating new ones
  const reusableObj = {
    id: 0,
    value: 0,
    timestamp: 0,
    processed: false
  };
  
  const reusableResult = {
    input: reusableObj,
    output: 0,
    metadata: {
      created: new Date(),
      index: 0
    }
  };
  
  for (let i = 0; i < count; i++) {
    // Reuse existing objects - GOOD for GC
    reusableObj.id = i;
    reusableObj.value = Math.random();
    reusableObj.timestamp = Date.now();
    reusableObj.processed = false;
    
    reusableResult.output = reusableObj.value * 2;
    reusableResult.metadata.index = i;
    
    total += reusableResult.output;
  }
  
  return total;
}

// BAD: String concatenation in loop (creates many temporary strings)
export function badStringConcatenation(items: string[]): string {
  let result = '';
  
  for (const item of items) {
    // Each += creates a new string object - BAD for GC
    result += item + ', ';
  }
  
  return result;
}

// GOOD: Use array join (single allocation)
export function goodStringConcatenation(items: string[]): string {
  // Single allocation - GOOD for GC
  return items.join(', ');
}

// BAD: Array operations that create many intermediate arrays
export function badArrayOperations(numbers: number[]): number[] {
  return numbers
    .map(x => x * 2)        // Creates new array
    .filter(x => x > 10)    // Creates another new array
    .map(x => x + 1)        // Creates another new array
    .filter(x => x % 2 === 0); // Creates final array
}

// GOOD: Single pass with reduce (one allocation)
export function goodArrayOperations(numbers: number[]): number[] {
  return numbers.reduce((acc: number[], x: number) => {
    const doubled = x * 2;
    if (doubled > 10) {
      const incremented = doubled + 1;
      if (incremented % 2 === 0) {
        acc.push(incremented);
      }
    }
    return acc;
  }, []);
}

// Object pool pattern for heavy reuse
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  
  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize: number = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    
    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  acquire(): T {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}

// Example using object pool
export function objectPoolExample(count: number): number {
  const pool = new ObjectPool(
    () => ({ id: 0, value: 0, result: 0 }),
    (obj) => { obj.id = 0; obj.value = 0; obj.result = 0; },
    50
  );
  
  let total = 0;
  
  for (let i = 0; i < count; i++) {
    const obj = pool.acquire();
    obj.id = i;
    obj.value = Math.random();
    obj.result = obj.value * 2;
    
    total += obj.result;
    
    pool.release(obj); // Return to pool for reuse
  }
  
  return total;
}
