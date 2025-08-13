// Example file to demonstrate call depth tracking

export function directFunction(x: number): number {
  return x * 2; // This will be depth 1 when called directly from tests
}
export function oneLevel(x: number): number {
  return directFunction(x) + 1; // directFunction will be depth 2 here
}
export function twoLevels(x: number): number {
  return oneLevel(x) + 1; // directFunction will be depth 3 here
}
export function threeLevels(x: number): number {
  return twoLevels(x) + 1; // directFunction will be depth 4 here
}

// Complex function that calls multiple other functions
export function complexFunction(x: number): number {
  const a = directFunction(x); // depth 2
  const b = oneLevel(x); // directFunction will be depth 3 here
  const c = twoLevels(x); // directFunction will be depth 4 here
  return a + b + c;
}

// Recursive function to test deep call stacks
export function recursiveFunction(n: number, depth: number = 0): number {
  if (depth >= 3) {
    return directFunction(n); // This will be very deep
  }
  return recursiveFunction(n, depth + 1) + 1;
}

// Global array to hold leaked memory - this will cause actual memory leaks
const memoryLeakStorage: any[] = [];
export function memoryLeakFunction(size: number): number {
  // Create large objects and store them globally (this leaks memory!)
  const largeObject = {
    id: Date.now(),
    data: new Array(size).fill(0).map((_, i) => ({
      index: i,
      value: Math.random(),
      timestamp: new Date(),
      largeString: 'x'.repeat(1000),
      // 1KB string per item
      metadata: {
        created: Date.now(),
        processed: false,
        tags: ['memory', 'leak', 'test', 'large'],
        history: new Array(100).fill(0).map(() => Math.random())
      }
    }))
  };

  // Store in global array - this prevents garbage collection (memory leak!)
  memoryLeakStorage.push(largeObject);

  // Also call our tracked function
  return directFunction(size);
}
export function clearMemoryLeaks(): number {
  const count = memoryLeakStorage.length;
  memoryLeakStorage.length = 0; // Clear the array
  return count;
}
export function getMemoryLeakCount(): number {
  return memoryLeakStorage.length;
}