# Jest Exit Code 7 Analysis - Mutation Testing

## Error Details

### Primary Error
```
TypeError: Class extends value undefined is not a constructor or null
    at Object.<anonymous> (/usr/local/lib/node_modules/npm/node_modules/fs-minipass/lib/index.js:136:4)
```

### Jest Exit Behavior
- **Normal Test Run**: Exit code 0 (success)
- **Mutation Test Run**: Exit code 7 (module loading error)
- **Consistency**: 100% of mutations trigger this error

## Technical Investigation

### Error Location Analysis
The error occurs in `/usr/local/lib/node_modules/npm/node_modules/fs-minipass/lib/index.js:136:4`

This suggests:
1. **npm module system involvement**: The error is in npm's internal modules
2. **fs-minipass dependency**: Related to file system operations
3. **Class extension failure**: A class is trying to extend `undefined`

### Module Loading Chain
```
Jest Test Runner
  ↓
Node.js Module System
  ↓
npm modules (fs-minipass)
  ↓
ERROR: Class extends undefined
```

### Timing Analysis
- **Before Mutation**: Jest loads modules successfully
- **During Mutation**: Module loading fails consistently
- **After Mutation**: N/A (Jest exits)

## Environment Differences

### Normal Test Execution
```bash
npm test -- --testPathPatterns=truly-weak-example.test.ts
# ✅ Success: Exit code 0
# ✅ All modules load correctly
# ✅ Tests execute normally
```

### Mutation Test Execution
```bash
JEST_LINEAGE_MUTATION=true npm test -- --testPathPatterns=truly-weak-example.test.ts
# ❌ Failure: Exit code 7
# ❌ Module loading fails
# ❌ Tests don't execute
```

## Hypothesis: Module State Corruption

### Theory
The mutation testing process is corrupting Node.js module state, causing subsequent module loads to fail.

### Evidence
1. **First mutation works**: Initial setup succeeds
2. **Subsequent failures**: All mutations after setup fail
3. **Consistent location**: Always fails in fs-minipass
4. **Class extension**: Suggests prototype chain corruption

### Potential Causes
1. **File System Mutations**: Writing mutated files may corrupt module cache
2. **Babel Transformation**: AST manipulation may affect module resolution
3. **Jest Module Mocking**: Mutation testing may interfere with Jest's module system
4. **Memory Corruption**: Repeated file operations may corrupt module state

## Code Analysis

### Mutation File Operations
```javascript
// Current approach - may cause module corruption
const backupPath = `${filePath}.backup`;
fs.writeFileSync(backupPath, originalCode);  // Backup original
fs.writeFileSync(filePath, mutatedCode);     // Write mutation
// Run tests...
fs.writeFileSync(filePath, originalCode);    // Restore original
```

### Potential Issues
1. **File Handle Conflicts**: Jest may have open handles to source files
2. **Module Cache Invalidation**: Changing files may not invalidate Node.js cache
3. **Race Conditions**: File operations may conflict with Jest's file watching
4. **Path Resolution**: Temporary files may confuse module resolution

## Debug Information Collected

### Successful Mutation (Conditional)
```
🔍 Debug: /path/to/truly-weak-example.ts:30:conditional
  Test success: true
  Status: survived
  Error: none
```

### Failed Mutation (Comparison)
```
🔍 Debug: /path/to/truly-weak-example.ts:6:comparison
  Test success: false
  Status: killed
  Error: Jest exited with code 7
  Output snippet: /usr/lo...
```

## Attempted Solutions

### 1. Lineage Tracking Disable ✅ PARTIAL
```javascript
// Added to testSetup.js
if (process.env.JEST_LINEAGE_MUTATION === 'true') {
  return; // Skip lineage tracking
}
```
**Result**: Reduced conflicts but didn't eliminate exit code 7

### 2. Minimal Babel Configuration ❌ FAILED
```javascript
// Removed @babel/preset-env, kept only TypeScript
presets: ['@babel/preset-typescript']
```
**Result**: Still triggers exit code 7

### 3. Direct String Replacement ❌ FAILED
```javascript
// Avoided Babel entirely, used regex replacement
mutatedLine = targetLine.replace(/===/g, '!==');
```
**Result**: Still triggers exit code 7

### 4. File Operation Optimization ❌ FAILED
```javascript
// Used backup/restore pattern
const backupPath = `${filePath}.backup`;
fs.writeFileSync(backupPath, originalCode);
```
**Result**: Still triggers exit code 7

## Alternative Approaches to Investigate

### 1. Child Process Isolation
```javascript
// Run each mutation in separate Node.js process
const result = spawn('npm', ['test', '--', testPattern], {
  env: { ...process.env, MUTATION_DATA: mutationInfo }
});
```

### 2. Jest Programmatic API
```javascript
// Use Jest's programmatic API instead of CLI
const jest = require('jest');
const result = await jest.runCLI(config, [projectPath]);
```

### 3. Memory-Only Mutations
```javascript
// Apply mutations in memory without file system changes
// Use Jest's module mocking to provide mutated code
jest.mock(filePath, () => mutatedCode);
```

### 4. Alternative Test Runner
```javascript
// Use Node.js directly instead of Jest
const testFunction = require(testFilePath);
const result = await testFunction();
```

## Debugging Commands

### Enable Node.js Debug Mode
```bash
NODE_OPTIONS="--inspect-brk" JEST_LINEAGE_MUTATION=true npm test
```

### Trace Module Loading
```bash
NODE_OPTIONS="--trace-warnings" JEST_LINEAGE_MUTATION=true npm test
```

### Memory Analysis
```bash
NODE_OPTIONS="--max-old-space-size=4096 --trace-gc" JEST_LINEAGE_MUTATION=true npm test
```

## Next Investigation Steps

1. **Module Cache Analysis**: Investigate Node.js module cache state
2. **File Handle Tracking**: Monitor open file handles during mutation testing
3. **Jest Internal State**: Examine Jest's internal module resolution
4. **fs-minipass Source**: Analyze the specific failing line in fs-minipass
5. **Process Isolation**: Test child process approach for mutation execution

## Priority Actions

1. **HIGH**: Implement child process isolation for mutation testing
2. **HIGH**: Investigate Jest programmatic API usage
3. **MEDIUM**: Analyze fs-minipass source code at failing line
4. **MEDIUM**: Test memory-only mutation approach
5. **LOW**: Investigate alternative test runners
