# 🔧 Troubleshooting Guide

## ❌ "Cannot convert undefined or null to object" Error

### **Symptoms:**
```
Error: Cannot convert undefined or null to object
File: /path/to/your/file.ts
Suggestion: Make sure the file exists and is readable.
```

### **Root Causes & Solutions:**

#### **1. Coverage Data is Null/Undefined**
**Cause**: The file has no coverage data or invalid data structure.

**Solution**: Check if tests are actually running and covering the file:
```bash
# Run with verbose output to see what's happening
npm test -- --verbose

# Look for these messages:
# ✅ "🔧 Instrumenting: your-file.ts" (Babel working)
# ✅ "🎯 Found precise lineage tracking data" (Tracking working)
# ✅ "✅ PRECISE" in output (Data processed correctly)
```

#### **2. Babel Instrumentation Not Working**
**Cause**: Source files aren't being instrumented by Babel.

**Solution**: Verify Babel configuration:
```javascript
// babel.config.js - Make sure this exists and is correct
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

#### **3. Jest Transform Configuration**
**Cause**: Jest isn't using Babel to transform files.

**Solution**: Update jest.config.js:
```javascript
module.exports = {
  // Make sure you're using babel-jest, not ts-jest
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  // NOT this: preset: 'ts-jest'
};
```

#### **4. File Path Resolution Issues**
**Cause**: The reporter can't find the source file.

**Solution**: The reporter now auto-detects file paths, but you can debug:
```bash
# Check if your source file exists
ls -la server/src/services/calculationService.ts

# Run tests and look for path resolution messages
npm test 2>&1 | grep -E "(Instrumenting|Resolved|Found file)"
```

## ⚠️ Still Seeing "ESTIMATED" Instead of "PRECISE"

### **Debug Steps:**

1. **Check Babel Plugin Loading**:
```bash
npm test 2>&1 | grep "Instrumenting"
# Should see: 🔧 Instrumenting: your-file.ts
```

2. **Check Test Setup Loading**:
```bash
npm test 2>&1 | grep "Test lineage tracking setup"
# Should see: 🎯 Test lineage tracking setup completed
```

3. **Check Precise Data Detection**:
```bash
npm test 2>&1 | grep "Found precise lineage"
# Should see: 🎯 Found precise lineage tracking data from file!
```

4. **Clear Jest Cache**:
```bash
npm test -- --clearCache
```

## 🔍 Debug Mode

Enable debug logging by temporarily uncommenting debug lines in the reporter:

```javascript
// In TestCoverageReporter.js, uncomment these lines:
console.log(`🔍 Processing ${testDataArray.length} test data entries`);
console.log(`✅ Processed tracking data for ${Object.keys(this.coverageData).length} files`);
console.log(`✅ Validated ${validFiles.length} files for HTML report`);
```

## 🚨 Common Issues

### **Issue: "Module not found" errors**
**Solution**: Make sure npm link is working:
```bash
# In jest-test-lineage-reporter directory
npm link

# In your project directory
npm link jest-test-lineage-reporter

# Verify the link
ls -la node_modules/ | grep jest-test-lineage-reporter
```

### **Issue: TypeScript compilation errors**
**Solution**: Make sure you're using babel-jest, not ts-jest:
```javascript
// Remove this from jest.config.js:
// preset: 'ts-jest'

// Use this instead:
transform: {
  '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
}
```

### **Issue: No coverage data at all**
**Solution**: Check collectCoverageFrom pattern:
```javascript
// Make sure this matches your source files
collectCoverageFrom: [
  'server/src/**/*.{ts,js}',  // Adjust path as needed
  '!server/src/**/*.test.{ts,js}',
  '!server/src/**/*.spec.{ts,js}'
]
```

## ✅ Verification Checklist

- [ ] Babel dependencies installed
- [ ] babel.config.js exists with correct plugin
- [ ] jest.config.js uses babel-jest transform
- [ ] npm link working correctly
- [ ] Source files match collectCoverageFrom pattern
- [ ] Tests are actually running and passing
- [ ] See "🔧 Instrumenting:" messages in output
- [ ] See "✅ PRECISE" in test output

## 🆘 Still Having Issues?

If you're still having problems:

1. **Create a minimal test case** with a simple function and test
2. **Run with maximum verbosity**: `npm test -- --verbose --no-cache`
3. **Check the generated tracking file**: `cat .jest-lineage-data.json`
4. **Compare with the working example** in the jest-test-lineage-reporter project

The enhanced error handling should now provide much clearer error messages about what's going wrong!
