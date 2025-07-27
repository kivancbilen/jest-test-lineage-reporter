# 📦 Usage Guide: Jest Test Lineage Reporter

This guide shows you how to use the Jest Test Lineage Reporter in your external projects.

## 🚀 **Option 1: NPM Package (Recommended)**

### **Step 1: Publish to NPM**
```bash
# In this project directory
npm login
npm publish
```

### **Step 2: Install in Your Project**
```bash
# In your external project
npm install --save-dev jest-test-lineage-reporter
```

### **Step 3: Configure Jest**
```javascript
// jest.config.js in your project
module.exports = {
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts'
  ],
  // Add other Jest configurations as needed
};
```

### **Step 4: Run Tests**
```bash
npm test
```

The reporter will generate `test-lineage-report.html` in your project root.

---

## 💻 **Option 2: Local Path (For Development/Testing)**

### **Step 1: Copy the Reporter File**
```bash
# Copy the reporter to your project
cp /path/to/jest-test-lineage-reporter/src/TestCoverageReporter.js ./reporters/
```

### **Step 2: Configure Jest with Local Path**
```javascript
// jest.config.js in your project
module.exports = {
  reporters: [
    'default',
    './reporters/TestCoverageReporter.js'  // Local path
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts'
  ],
};
```

---

## 🔗 **Option 3: Git Dependency**

### **Step 1: Install from Git**
```bash
# Install directly from your Git repository
npm install --save-dev git+https://github.com/yourusername/jest-test-lineage-reporter.git
```

### **Step 2: Configure Jest**
```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts'
  ],
};
```

---

## 🔧 **Option 4: Symlink (For Local Development)**

### **Step 1: Create Global Link**
```bash
# In the jest-test-lineage-reporter directory
npm link
```

### **Step 2: Link in Your Project**
```bash
# In your external project directory
npm link jest-test-lineage-reporter
```

### **Step 3: Configure Jest**
```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts'
  ],
};
```

---

## ⚙️ **Configuration Options**

### **Basic Configuration**
```javascript
module.exports = {
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
};
```

### **Advanced Configuration**
```javascript
module.exports = {
  reporters: [
    'default',
    ['jest-test-lineage-reporter', {
      // Future: Add custom options here
      outputPath: './reports/test-lineage.html',
      includeUncovered: true
    }]
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

---

## 📁 **Project Structure Requirements**

Your project should have:
```
your-project/
├── src/                    # Source code
│   ├── components/
│   └── utils/
├── __tests__/             # Test files (or src/__tests__)
│   ├── components/
│   └── utils/
├── jest.config.js         # Jest configuration
├── package.json
└── test-lineage-report.html  # Generated report
```

---

## 🎯 **Example Usage in Different Project Types**

### **React Project**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/index.js',
    '!src/reportWebVitals.js'
  ],
};
```

### **Node.js Project**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts'
  ],
};
```

### **TypeScript Project**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
};
```

---

## 🔍 **Troubleshooting**

### **Common Issues**

1. **"Module not found"**
   - Ensure the reporter is properly installed
   - Check the path in jest.config.js

2. **"No coverage data"**
   - Make sure `collectCoverage: true` is set
   - Verify `collectCoverageFrom` includes your source files

3. **"HTML report not generated"**
   - Check console output for error messages
   - Ensure write permissions in project directory

### **Debug Mode**
Add console logs to see what's happening:
```javascript
// In your jest.config.js
module.exports = {
  verbose: true,  // Enable verbose output
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],
  collectCoverage: true,
};
```

---

## 📋 **Next Steps**

1. Choose your preferred installation method
2. Configure Jest in your project
3. Run your tests
4. Open `test-lineage-report.html` in your browser
5. Explore the interactive coverage visualization!

The reporter works with any Jest-compatible project and provides the same beautiful interactive HTML reports! 🎉
