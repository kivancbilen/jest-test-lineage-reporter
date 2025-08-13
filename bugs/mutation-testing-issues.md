# Mutation Testing Implementation Issues

## Summary
This document outlines the issues discovered during the implementation of mutation testing functionality in the jest-test-lineage-reporter package.

## Current Status: PARTIALLY WORKING ⚠️

### ✅ What's Working
1. **Mutation Detection**: Successfully identifies lines to mutate based on coverage data
2. **Mutation Application**: Can apply mutations using direct string replacement
3. **Test Execution**: Can run targeted tests for each mutation
4. **Progress Tracking**: Shows mutation progress and completion
5. **Basic Mutation Types**: Supports conditional, literal, and arithmetic mutations

### ❌ Critical Issues

#### 1. Jest Exit Code 7 Error (HIGH PRIORITY)
**Problem**: Jest consistently exits with code 7 during mutation testing, causing all mutations to be marked as "killed" even when they should survive.

**Error Message**:
```
TypeError: Class extends value undefined is not a constructor or null
    at Object.<anonymous> (/usr/local/lib/node_modules/npm/node_modules/fs-minipass/lib/index.js:136:4)
```

**Root Cause**: Node.js module loading conflicts during test execution. This appears to be related to:
- Babel transformation conflicts with Node.js module system
- Potential issues with Jest's module resolution during mutation testing
- Possible conflicts between lineage tracking instrumentation and mutation testing

**Impact**: 100% of mutations are incorrectly marked as "killed" instead of "survived"

**Attempted Fixes**:
- ✅ Disabled lineage tracking during mutation testing (`JEST_LINEAGE_MUTATION=true`)
- ✅ Switched from Babel transformation to direct string replacement
- ✅ Removed `@babel/preset-env` to minimize transformation
- ❌ Issue persists across all approaches

#### 2. Comparison Operator Mutation Conflicts (MEDIUM PRIORITY)
**Problem**: Direct string replacement for comparison operators was causing conflicts due to overlapping regex patterns.

**Example**:
```javascript
// Original: x === 5
// Step 1: Replace === with !== → x !== 5
// Step 2: Replace !== with === → x === 5 (back to original!)
```

**Status**: ✅ FIXED using temporary placeholders to avoid conflicts

#### 3. Limited Mutation Coverage (MEDIUM PRIORITY)
**Problem**: Direct string replacement approach is more limited than AST-based mutations.

**Missing Features**:
- Complex expression mutations
- Return statement mutations
- Method call mutations
- Advanced conditional logic mutations

**Trade-off**: Chose simplicity over completeness to avoid Babel transformation issues

## Technical Analysis

### Architecture Decision: Direct String Replacement vs Babel AST
We switched from Babel AST transformation to direct string replacement due to persistent Node.js module loading conflicts.

**Babel Approach (Original)**:
```javascript
// Pros: Precise, handles complex cases, AST-aware
// Cons: Module loading conflicts, Jest exit code 7 errors
const result = babel.transformSync(code, {
  plugins: [mutationPlugin]
});
```

**Direct String Replacement (Current)**:
```javascript
// Pros: No module conflicts, simpler, more reliable
// Cons: Limited mutation types, regex-based, less precise
mutatedLine = targetLine.replace(/===/g, '!==');
```

### Test Environment Conflicts
The mutation testing environment has conflicts with:
1. **Jest's module system**: Exit code 7 suggests module resolution issues
2. **Node.js module loading**: fs-minipass errors indicate npm/Node.js conflicts
3. **Lineage tracking**: Even when disabled, some conflicts remain

## Reproduction Steps

1. Run normal tests: `npm test -- --testPathPatterns=truly-weak-example.test.ts`
   - ✅ Works perfectly, exit code 0
2. Run mutation testing: `JEST_LINEAGE_MUTATION=true npm test -- --testPathPatterns=truly-weak-example.test.ts`
   - ❌ Jest exits with code 7, mutations marked as killed

## Expected vs Actual Behavior

### Expected (for weak tests with no assertions)
```
🧬 Mutation Testing Results:
- truly-weak-example.ts: 100% survived (all mutations should survive)
- Total: 218 mutations, 218 survived, 0 killed
```

### Actual
```
🧬 Mutation Testing Results:
- truly-weak-example.ts: 0% survived (all mutations incorrectly killed)
- Total: 218 mutations, 0 survived, 218 killed
```

## Investigation Needed

### High Priority
1. **Jest Exit Code 7 Root Cause**: Deep dive into why Jest fails during mutation testing
2. **Module Loading Analysis**: Investigate fs-minipass and npm module conflicts
3. **Alternative Test Execution**: Consider using child processes or different test runners

### Medium Priority
1. **Babel Configuration**: Investigate minimal Babel configs that avoid conflicts
2. **Jest Configuration**: Test different Jest settings for mutation testing
3. **Environment Isolation**: Consider running mutations in isolated environments

## Workarounds Attempted

1. **Lineage Tracking Disable**: Added `JEST_LINEAGE_MUTATION` check ✅
2. **Minimal Babel Config**: Removed preset-env, kept only TypeScript ❌
3. **Direct String Replacement**: Avoided Babel entirely ❌
4. **Temporary File Approach**: Write mutations to disk instead of memory ❌

## Next Steps

1. **Investigate Jest Child Process**: Run mutations in separate Jest processes
2. **Alternative Test Runners**: Consider using Node.js directly instead of Jest
3. **Module Isolation**: Investigate Jest's `--isolatedModules` flag
4. **Debugging Tools**: Use Node.js debugger to trace module loading issues

## Files Modified

- `src/MutationTester.js`: Main mutation testing implementation
- `src/testSetup.js`: Added mutation testing detection
- `src/__tests__/truly-weak-example.test.ts`: Test file for validation

## Test Files for Validation

- `src/truly-weak-example.ts`: Functions designed to have surviving mutations
- `src/__tests__/truly-weak-example.test.ts`: Tests with no assertions (should allow mutations to survive)

## Performance Notes

- **218 mutations** processed in ~87 seconds when working
- **Direct string replacement** is significantly faster than Babel transformation
- **Memory usage** appears normal during mutation testing
