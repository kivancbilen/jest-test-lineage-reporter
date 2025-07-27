# 🚀 Jest Test Lineage Reporter - Zero Configuration Setup

Get **✅ PRECISE** per-test coverage tracking with **zero configuration**! The reporter automatically detects your project structure.

## 📦 Installation

```bash
npm install --save-dev jest-test-lineage-reporter @babel/core @babel/preset-env @babel/preset-typescript babel-jest
```

## ⚡ Quick Setup (3 steps)

### 1. **babel.config.js**
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript'
  ],
  plugins: [
    'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js'
  ]
};
```

### 2. **jest.config.js**
```javascript
module.exports = {
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],
  reporters: [
    'default',
    'jest-test-lineage-reporter/src/TestCoverageReporter.js'
  ],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.test.{ts,js}'],
  transform: { '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest' },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testEnvironment: 'node'
};
```

### 3. **Run Tests**
```bash
npm test
```

## 🎯 What You Get

### **Before (❌ Estimated)**
```
Line 2: Covered by 15 test(s)
  - "Calculator should add numbers" ⚠️ ESTIMATED
  - "Add Function should work" ⚠️ ESTIMATED
```

### **After (✅ Precise)**
```
Line 2: Covered by 3 test(s)
  - "should correctly add two numbers" (1 executions) ✅ PRECISE
  - "should add negative numbers" (1 executions) ✅ PRECISE
  - "should add zero" (1 executions) ✅ PRECISE
```

## 🔧 Works With Any Project Structure

**Zero configuration needed!** Automatically detects:

- ✅ `src/` (standard)
- ✅ `server/src/` (monorepo)
- ✅ `client/src/` (frontend)
- ✅ `app/src/` (mobile)
- ✅ `lib/` (library)
- ✅ `packages/*/src/` (lerna/nx)
- ✅ Any custom structure

## 📊 Output

- **Console Report**: Line-by-line coverage with test names
- **HTML Report**: `test-lineage-report.html` with interactive source code view
- **Real Execution Counts**: Actual numbers, not estimates
- **Individual Test Tracking**: Each test tracked separately

## 🚨 Troubleshooting

**Still seeing ⚠️ ESTIMATED?**

1. **Check Babel is working**: Look for `🔧 Instrumenting:` messages
2. **Verify transform**: Make sure `babel-jest` is in your Jest config
3. **Clear cache**: Run `npm test -- --clearCache`

**File reading errors?**

The reporter automatically finds files in any project structure. If you see errors, the source files might not exist or be in an unexpected location.

## 🎉 That's It!

No configuration files, no project-specific setup, no manual path configuration. Just install, configure Babel/Jest, and run tests!

**Get ✅ PRECISE tracking instead of ⚠️ ESTIMATED with zero hassle!** 🎯
