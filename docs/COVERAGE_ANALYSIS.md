# Coverage Analysis: Demonstrating Test Lineage Differences

This document shows how the Jest Test Lineage Reporter reveals different coverage patterns when tests are organized in separate files.

## Test Organization

We created three test files:
1. **calculator.test.ts** - Tests all functions (add, subtract, multiply)
2. **add-only.test.ts** - Tests only the `add` function
3. **multiply-only.test.ts** - Tests only the `multiply` function

## Coverage Results Analysis

### Key Findings

The reporter successfully shows **different coverage patterns** for different lines:

#### Lines with ALL 12 tests (Lines 2, 3, 4, 5):
```
Line 2: Covered by 12 test(s)
  - All calculator.test.ts tests (6)
  - All add-only.test.ts tests (3) 
  - All multiply-only.test.ts tests (3)
```
These are likely function declaration lines that get executed regardless of which function is called.

#### Lines with FEWER tests (Line 7):
```
Line 7: Covered by 9 test(s)
  - All calculator.test.ts tests (6)
  - All add-only.test.ts tests (3)
  - NO multiply-only.test.ts tests
```
This shows Line 7 is **NOT** executed by multiply-only tests, indicating it's specific to add/subtract logic.

#### Lines with SPECIFIC function tests (Line 10, 11, 13):
```
Line 10: Covered by 6 test(s)
Line 11: Covered by 6 test(s)
  - ONLY calculator.test.ts tests (6)
  - NO add-only.test.ts tests
  - NO multiply-only.test.ts tests

Line 13: Covered by 6 test(s)
  - ONLY calculator.test.ts tests (6)
  - NO add-only.test.ts tests  
  - NO multiply-only.test.ts tests
```
These lines are only covered by the comprehensive calculator.test.ts file.

#### Lines with MULTIPLY function tests (Line 16):
```
Line 16: Covered by 9 test(s)
  - All calculator.test.ts tests (6)
  - All multiply-only.test.ts tests (3)
  - NO add-only.test.ts tests
```
This shows Line 16 is specific to multiply function logic.

## What This Reveals

### 1. **Function-Specific Coverage**
- **Add function**: Lines 2-5, 7 are covered by add-only tests
- **Multiply function**: Lines 2-5, 16 are covered by multiply-only tests  
- **Subtract function**: Only covered by comprehensive calculator tests

### 2. **Test Redundancy Identification**
- Lines 2-5 are covered by **ALL** tests - potential redundancy
- Some lines are only covered by specific test files - good isolation

### 3. **Missing Coverage Gaps**
- Lines 10, 11, 13 are only covered by calculator.test.ts
- No dedicated subtract-only tests exist

## Practical Benefits

This analysis helps developers:

1. **Identify redundant tests**: Lines covered by many tests might indicate over-testing
2. **Find coverage gaps**: Lines only covered by one test file might need additional coverage
3. **Understand test isolation**: See which tests actually exercise which code paths
4. **Optimize test suites**: Remove redundant tests or add missing specific tests

## Conclusion

The Jest Test Lineage Reporter successfully demonstrates **different coverage patterns** when tests are organized in separate files, providing valuable insights into:
- Which specific tests cover which lines
- Test redundancy and coverage gaps
- Function-specific vs. shared code coverage
- Opportunities for test suite optimization
