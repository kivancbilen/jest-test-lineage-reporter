# Complete Testing Guide for jest-test-lineage-reporter

## Quick Start Testing

This guide shows you how to test the package after installing from npm.

## 1. Create a Test Project

```bash
# Create project
mkdir jest-lineage-demo
cd jest-lineage-demo
npm init -y

# Install dependencies
npm install --save-dev \
  jest \
  babel-jest \
  @babel/core \
  @babel/preset-env \
  jest-test-lineage-reporter
```

## 2. Create Source File

**`src/calculator.js`:**
```javascript
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  if (b === 0) {
    throw new Error('Cannot divide by zero');
  }
  return a / b;
}

module.exports = { add, subtract, multiply, divide };
```

## 3. Create Test File

**`src/calculator.test.js`:**
```javascript
const { add, subtract, multiply, divide } = require('./calculator');

describe('Calculator', () => {
  test('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });

  test('should subtract two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
    expect(subtract(0, 5)).toBe(-5);
  });

  test('should multiply two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
    expect(multiply(-2, 5)).toBe(-10);
  });

  test('should divide two numbers', () => {
    expect(divide(10, 2)).toBe(5);
    expect(divide(9, 3)).toBe(3);
  });

  test('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });
});
```

## 4. Initialize Configuration (Automatic!)

**Use the init command to automatically create configuration:**

```bash
# Automatically creates jest.config.js and babel.config.js
npx jest-lineage init
```

**Expected Output:**
```
🚀 Initializing jest-test-lineage-reporter...

══════════════════════════════════════════════════
✅ Configuration complete! ✨

✅ Created jest.config.js
✅ Created babel.config.js

📋 Next steps:

1. Run your tests with lineage tracking:
   npx jest-lineage test

2. Query coverage data:
   npx jest-lineage query src/yourfile.js

3. Generate HTML report:
   npx jest-lineage report --open

══════════════════════════════════════════════════
```

<details>
<summary>📝 Manual Configuration (if you prefer)</summary>

**`jest.config.js`:**
```javascript
module.exports = {
  testEnvironment: 'node',

  // CRITICAL: Add setup file for lineage tracking
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],

  // Add the lineage reporter
  reporters: [
    'default',
    [
      'jest-test-lineage-reporter',
      {
        outputFile: '.jest-lineage-data.json',
        enableMutationTesting: false,
      }
    ]
  ],

  // Enable coverage
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
  ],

  // Use babel-jest for transformation
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
```

**`babel.config.js`:**
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
  plugins: [
    // CRITICAL: Add lineage tracker plugin
    'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js',
  ],
};
```
</details>

## 5. Test All CLI Commands

### Test Command
```bash
# Run tests with lineage tracking
npx jest-lineage test

# Verify data file was created
ls -lh .jest-lineage-data.json
# Expected: File should exist (~10-20KB)
```

**Expected Output:**
```
✅ Tests completed successfully
ℹ️  Lineage data saved to: .jest-lineage-data.json
   - 5 tests tracked
   - 1 files analyzed
```

### Query Command
```bash
# Query entire file
npx jest-lineage query src/calculator.js

# Query specific line
npx jest-lineage query src/calculator.js 2
```

**Expected Output:**
```
📁 Coverage for ./src/calculator.js
═════════════════════════════════════
Lines covered: 5
Tests covering file: 5

Line 2:
  • should add two numbers (calculator.test.js)
Line 6:
  • should subtract two numbers (calculator.test.js)
...
```

### Report Command
```bash
# Generate HTML report
npx jest-lineage report

# Generate and open in browser
npx jest-lineage report --open

# Verify report was created
ls -lh test-lineage-report.html
```

**Expected Output:**
```
✅ Report saved to: test-lineage-report.html
✔ HTML report generated!
```

### Mutation Command
```bash
# Run mutation testing
npx jest-lineage mutate --threshold 80

# Run with debug mode (creates mutation files)
npx jest-lineage mutate --debug --debug-dir ./mutations
```

**Expected Output:**
```
🧬 Mutation Testing Results:
══════════════════════════════════════════════════
📊 Total Mutations: 11
✅ Killed: 8
🔴 Survived: 0
⏰ Timeout: 0
❌ Error: 3
🎯 Mutation Score: 100%
🎉 Mutation score meets threshold!
```

### Analyze Command (Full Workflow)
```bash
# Run everything: test + mutate + report
npx jest-lineage analyze --open

# Skip mutation testing
npx jest-lineage analyze --skip-mutation --open

# Use existing data, skip tests
npx jest-lineage analyze --skip-tests --open
```

**Expected Output:**
```
✅ Tests completed successfully
✅ Mutation testing completed
✅ Report generated
✅ Full analysis complete!
```

## 6. Verify Everything Works

### Checklist

- [ ] `.jest-lineage-data.json` file created (10-20KB)
- [ ] `test-lineage-report.html` file created
- [ ] Query command shows line-by-line coverage
- [ ] Mutation testing shows mutation score
- [ ] No errors in console output

### Common Files Generated

```
my-test-project/
├── .jest-lineage-data.json      # Lineage tracking data
├── test-lineage-report.html      # HTML report
├── coverage/                     # Jest coverage data
└── mutations-debug/              # Debug mutations (if --debug used)
```

## 7. Test with TypeScript

For TypeScript projects, also install:

```bash
npm install --save-dev @babel/preset-typescript typescript
```

Update `babel.config.js`:
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',  // Add this
  ],
  plugins: [
    'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js',
  ],
};
```

## 8. Global Installation Test

```bash
# Install globally
npm install -g jest-test-lineage-reporter

# Test commands work without npx
jest-lineage --version
jest-lineage test
jest-lineage query src/calculator.js

# Uninstall when done
npm uninstall -g jest-test-lineage-reporter
```

## Troubleshooting

### Issue: "Tracking data file not found"

**Cause:** Missing `setupFilesAfterEnv` or babel plugin

**Fix:** Ensure both are configured:
1. `jest.config.js`: `setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js']`
2. `babel.config.js`: Include lineage tracker plugin

### Issue: ".jest-lineage-data.json not created"

**Cause:** Babel not transforming files

**Fix:**
1. Install babel-jest: `npm install --save-dev babel-jest`
2. Add transform to jest.config.js
3. Create babel.config.js with lineage tracker plugin

### Issue: "No tests tracked"

**Cause:** Tests running but instrumentation not working

**Fix:**
1. Check babel.config.js has the plugin
2. Clear jest cache: `npx jest --clearCache`
3. Run tests again

### Issue: "Module not found: 'jest-test-lineage-reporter'"

**Cause:** Package not installed

**Fix:**
```bash
npm install --save-dev jest-test-lineage-reporter
```

## Expected Test Results

When everything is configured correctly:

1. **Test Output**: Shows test pass/fail + lineage tracking message
2. **Data File**: `.jest-lineage-data.json` created (~10-20KB)
3. **Query Works**: Shows which tests cover specific lines
4. **Report Generated**: HTML file with interactive visualization
5. **Mutation Testing**: Shows mutation score and analysis

## Quick Verification Script

Run this to verify everything:

```bash
# Run full workflow
npx jest-lineage test && \
  ls .jest-lineage-data.json && \
  npx jest-lineage query src/calculator.js && \
  npx jest-lineage report && \
  ls test-lineage-report.html && \
  echo "✅ All commands work!"
```

If all steps pass, your installation is working correctly! 🎉
