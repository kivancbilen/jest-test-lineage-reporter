// Example file to demonstrate CPU cycle and performance tracking

export function lightweightFunction(x: number): number {
  return x + 1; // Very fast operation - minimal CPU cycles
}

export function mediumFunction(x: number): number {
  let result = x;
  let i = 0;
  while (i < 100) { // Medium CPU usage
    result = Math.sqrt(result + i);
    i++;
  }
  return result;
}

export function heavyFunction(x: number): number {
  let result = x;
  let i = 0;
  while (i < 1000) { // Heavy CPU usage - many cycles (reduced for testing)
    result = Math.sin(Math.cos(Math.sqrt(result + i)));
    i++;
  }
  return result;
}

export function memoryIntensiveFunction(size: number): number[] {
  const array = new Array(size); // Memory allocation
  let i = 0;
  while (i < size) {
    array[i] = Math.random() * i; // Memory writes
    i++;
  }
  return array;
}

export function recursiveFunction(n: number): number {
  if (n <= 1) {
    return lightweightFunction(n); // Light operation at leaf
  }
  if (n > 5) return n; // Prevent exponential explosion
  return recursiveFunction(n - 1) + recursiveFunction(n - 2); // Limited recursion
}

export function nestedCallsFunction(x: number): number {
  const light = lightweightFunction(x);     // Depth 2
  const medium = mediumFunction(light);     // Depth 2  
  const heavy = heavyFunction(medium);      // Depth 2
  return heavy;
}

export function mixedPerformanceFunction(iterations: number): number {
  let result = 0;
  let i = 0;

  while (i < iterations) {
    if (i % 3 === 0) {
      result += lightweightFunction(i);     // Fast path
    } else if (i % 3 === 1) {
      result += mediumFunction(i);          // Medium path
    } else {
      result += heavyFunction(i);           // Slow path
    }
    i++;
  }

  return result;
}

// Function that demonstrates different performance characteristics
export function performanceVariableFunction(mode: 'fast' | 'medium' | 'slow'): number {
  switch (mode) {
    case 'fast':
      return lightweightFunction(42);
    case 'medium':
      return mediumFunction(42);
    case 'slow':
      return heavyFunction(42);
    default:
      return 0;
  }
}
