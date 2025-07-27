# Jest Test Lineage Reporter

A comprehensive test analytics platform that provides line-by-line test coverage, performance metrics, memory analysis, and test quality scoring.

## Features

- **Line-by-line coverage mapping**: See exactly which tests execute each line of your source code
- **Visual HTML reports**: Beautiful, interactive HTML reports for easy visualization
- **Test redundancy identification**: Identify multiple tests covering the same lines
- **Easy integration**: Simple Jest reporter that works alongside existing reporters
- **TypeScript support**: Built with TypeScript support out of the box
- **Statistics and insights**: File-level and overall statistics about test coverage patterns

## 📦 Installation

### **Option 1: Install from NPM (Recommended)**

```bash
npm install jest-test-lineage-reporter --save-dev
```

### **Option 2: Install from GitHub**

```bash
# Install latest from GitHub
npm install kivancbilen/jest-test-lineage-reporter --save-dev

# Install specific version/tag
npm install kivancbilen/jest-test-lineage-reporter#v2.0.0 --save-dev

# Install from specific branch
npm install kivancbilen/jest-test-lineage-reporter#main --save-dev
```

**Note**: Configuration paths differ slightly between NPM and GitHub installations (see setup instructions below).

## ⚙️ Quick Start

### 1. **Basic Setup**

#### **For NPM Installation:**

```javascript
// jest.config.js
module.exports = {
  // Enable coverage collection
  collectCoverage: true,

  // Add the reporter
  reporters: [
    'default',
    'jest-test-lineage-reporter'
  ],

  // Enable precise test tracking
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],

  // Configure Babel transformation (if using TypeScript/modern JS)
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  }
};
```

#### **For GitHub Installation:**

```javascript
// jest.config.js
module.exports = {
  // Enable coverage collection
  collectCoverage: true,

  // Add the reporter (use relative path for GitHub install)
  reporters: [
    'default',
    './node_modules/jest-test-lineage-reporter/src/TestCoverageReporter.js'
  ],

  // Enable precise test tracking
  setupFilesAfterEnv: ['./node_modules/jest-test-lineage-reporter/src/testSetup.js'],

  // Configure Babel transformation (if using TypeScript/modern JS)
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  }
};
```

### 2. **Babel Configuration**

#### **For NPM Installation:**

```javascript
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript' // If using TypeScript
  ],
  plugins: [
    // Add the lineage tracking plugin
    'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js'
  ]
};
```

#### **For GitHub Installation:**

```javascript
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript' // If using TypeScript
  ],
  plugins: [
    // Add the lineage tracking plugin (use full path for GitHub install)
    './node_modules/jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js'
  ]
};
```

### 3. **Install Required Dependencies**

If you don't have Babel setup already:

```bash
npm install --save-dev @babel/core @babel/preset-env babel-jest
# For TypeScript projects, also install:
npm install --save-dev @babel/preset-typescript
```

### 4. **Run Tests**

```bash
npm test
```

### 5. **View Results**

Open the generated report:

```bash
# macOS/Linux
open test-lineage-report.html

# Windows
start test-lineage-report.html
```

## 📊 What You'll Get

The reporter generates:
1. **📋 Console Report**: Detailed analytics in your terminal
2. **🌐 Interactive HTML Dashboard**: Beautiful visual report with 4 views
3. **📈 Performance Insights**: Memory leaks, GC pressure, slow tests
4. **🧪 Quality Metrics**: Test quality scores and improvement recommendations

## 🔧 How It Works

Jest Test Lineage Reporter uses a sophisticated multi-layered approach to provide precise test analytics:

### **1. 🔄 Babel Plugin Transformation**

The **Babel plugin** (`babel-plugin-lineage-tracker.js`) is the core of the system:

```javascript
// Your original code:
function add(a, b) {
  return a + b;
}

// Gets transformed to:
function add(a, b) {
  global.__TEST_LINEAGE_TRACKER__.trackExecution('src/calculator.js', 2, 1);
  return a + b;
}
```

**What the plugin does:**
- 🎯 **Injects tracking calls** into every line of your source code
- 📍 **Records exact line numbers** and file paths
- 🔢 **Tracks call depth** (how deep in the function call stack)
- ⚡ **Minimal overhead** - only active during testing

### **2. 🧪 Test Setup Integration**

The **test setup file** (`testSetup.js`) provides:

```javascript
// Tracks which test is currently running
global.__TEST_LINEAGE_TRACKER__ = {
  currentTest: null,
  testCoverage: new Map(),
  isTracking: false
};
```

**Key features:**
- 🎯 **Per-test isolation** - knows exactly which test is executing
- 📊 **Performance monitoring** - CPU cycles, memory usage, GC pressure
- 🧪 **Test quality analysis** - assertion counting, test smell detection
- 🔍 **Call depth tracking** - maps function call chains

### **3. 📈 Jest Reporter Integration**

The **main reporter** (`TestCoverageReporter.js`) processes all collected data:

**Data Collection:**
- ✅ Aggregates tracking data from all tests
- ✅ Correlates line executions with specific tests
- ✅ Calculates performance metrics and quality scores
- ✅ Generates comprehensive analytics

**Output Generation:**
- 📋 **Console reports** with real-time alerts
- 🌐 **Interactive HTML dashboard** with 4 different views
- 📊 **Sortable data tables** with 11+ sorting options
- 🚨 **Visual alerts** for performance issues

### **4. 🎯 Precision Tracking System**

**Line-by-Line Accuracy:**
```javascript
// Each line gets unique tracking:
Line 1: trackExecution('file.js', 1, depth)  // Function declaration
Line 2: trackExecution('file.js', 2, depth)  // Variable assignment
Line 3: trackExecution('file.js', 3, depth)  // Return statement
```

**Call Depth Analysis:**
```javascript
function outer() {        // Depth 1 (D1)
  return inner();         // Depth 1 → calls inner
}

function inner() {        // Depth 2 (D2)
  return deepFunction();  // Depth 2 → calls deep
}

function deepFunction() { // Depth 3 (D3)
  return 42;             // Depth 3
}
```

### **5. 🔥 Performance Monitoring**

**Real-time Performance Tracking:**
- **🚨 Memory Leaks**: Detects allocations >50KB per test
- **🗑️ GC Pressure**: Monitors garbage collection frequency
- **🐌 Slow Tests**: Identifies performance outliers
- **⚡ CPU Cycles**: Hardware-level performance measurement

**Quality Analysis:**
- **📊 Assertion Counting**: Tracks test thoroughness
- **🧪 Test Smell Detection**: Identifies problematic patterns
- **🔍 Error Handling**: Measures test robustness
- **📈 Maintainability Scoring**: 0-100% quality metrics

### **6. 🎨 Data Visualization**

**Interactive HTML Dashboard:**
- **📁 Files View**: Expandable source code with coverage highlights
- **📊 Lines Analysis**: Sortable table with all metrics
- **🔥 Performance Analytics**: CPU, memory, and performance hotspots
- **🧪 Test Quality**: Quality scores, test smells, and recommendations

**Real-time Alerts:**
```bash
Line 21: "heavyFunction" (performance-example.ts, 80,000 executions,
depths 1,4, 571 cycles, 0.2μs, +5.4MB 🚨LEAK 🐌SLOW) ✅ PRECISE
```

This multi-layered approach provides **unprecedented visibility** into your test suite's behavior, performance, and quality!

## Example Output

### Console Output
```
--- Jest Test Lineage Reporter: Line-by-Line Test Coverage ---

📄 File: /path/to/your/src/calculator.ts
  Line 2: Covered by 4 test(s)
    - "Calculator should correctly add two numbers"
    - "Calculator should subtract a smaller number from a larger one"
    - "Calculator should subtract a larger number from a smaller one and return a positive result"
    - "Calculator should handle zero correctly in subtraction"
  Line 7: Covered by 3 test(s)
    - "Calculator should subtract a smaller number from a larger one"
    - "Calculator should subtract a larger number from a smaller one and return a positive result"
    - "Calculator should handle zero correctly in subtraction"

--- Report End ---

📄 Generating HTML coverage report...
✅ HTML report generated: /path/to/your/project/test-lineage-report.html
🌐 Open the file in your browser to view the visual coverage report
```

### HTML Report
The HTML report provides a beautiful, interactive code tree visualization with:
- **Complete source code display** with syntax highlighting and line numbers
- **Visual coverage indicators** showing covered (green) vs uncovered (red) lines
- **Interactive line-by-line exploration** - click coverage indicators to expand/collapse test details
- **Test grouping by file** showing which test files cover each line
- **Hover effects and tooltips** for enhanced user experience
- **File-level statistics** showing total lines, covered lines, and unique tests
- **Modern, responsive design** that works on all devices

## ⚙️ Configuration Options

### **Basic Configuration**

```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-test-lineage-reporter', {
      outputFile: 'my-test-report.html',
      memoryLeakThreshold: 100 * 1024, // 100KB
      qualityThreshold: 70
    }]
  ],
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts'
  ]
};
```

### **Advanced Configuration**

```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-test-lineage-reporter', {
      // Output settings
      outputFile: 'test-analytics-report.html',
      enableConsoleOutput: true,
      enableDebugLogging: false,

      // Performance thresholds
      memoryLeakThreshold: 50 * 1024, // 50KB - triggers 🚨LEAK alerts
      gcPressureThreshold: 5, // Number of allocations - triggers 🗑️GC alerts
      slowExecutionThreshold: 2.0, // Multiplier for slow tests - triggers 🐌SLOW alerts

      // Quality thresholds
      qualityThreshold: 60, // Minimum quality score (0-100%)
      reliabilityThreshold: 60, // Minimum reliability score
      maintainabilityThreshold: 60, // Minimum maintainability score
      maxTestSmells: 2, // Maximum test smells before flagging

      // Feature toggles
      enableCpuCycleTracking: true, // Hardware-level performance tracking
      enableMemoryTracking: true, // Memory leak detection
      enableCallDepthTracking: true, // Function call depth analysis
      enableInteractiveFeatures: true, // Interactive HTML dashboard

      // File filtering
      includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**']
    }]
  ],
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts'
  ]
};
```

### **Environment Variables**

You can also configure via environment variables:

```bash
# 🎛️ FEATURE TOGGLES (Master Controls)
export JEST_LINEAGE_ENABLED=true           # Master switch (default: true)
export JEST_LINEAGE_TRACKING=true          # Line-by-line tracking (default: true)
export JEST_LINEAGE_PERFORMANCE=true       # Performance monitoring (default: true)
export JEST_LINEAGE_QUALITY=true           # Quality analysis (default: true)

# 📁 OUTPUT SETTINGS
export JEST_LINEAGE_OUTPUT_FILE=custom-report.html
export JEST_LINEAGE_DEBUG=true

# 🎯 PERFORMANCE THRESHOLDS
export JEST_LINEAGE_MEMORY_THRESHOLD=100000  # 100KB
export JEST_LINEAGE_GC_THRESHOLD=10
export JEST_LINEAGE_QUALITY_THRESHOLD=70
```

## 🎛️ **Enable/Disable Controls**

### **Quick Disable/Enable**

```bash
# 🚫 COMPLETELY DISABLE (fastest - no instrumentation)
export JEST_LINEAGE_ENABLED=false
npm test

# ✅ RE-ENABLE
export JEST_LINEAGE_ENABLED=true
npm test

# 🎯 SELECTIVE DISABLE (keep basic tracking, disable heavy features)
export JEST_LINEAGE_PERFORMANCE=false  # Disable CPU/memory monitoring
export JEST_LINEAGE_QUALITY=false      # Disable test quality analysis
npm test
```

### **Configuration-Based Control**

```javascript
// jest.config.js - Conditional setup
const enableLineage = process.env.NODE_ENV !== 'production';

module.exports = {
  reporters: [
    'default',
    ...(enableLineage ? ['jest-test-lineage-reporter'] : [])
  ],
  setupFilesAfterEnv: [
    ...(enableLineage ? ['jest-test-lineage-reporter/src/testSetup.js'] : [])
  ]
};
```

### **Babel Plugin Control**

```javascript
// babel.config.js - Conditional instrumentation
const enableLineage = process.env.JEST_LINEAGE_ENABLED !== 'false';

module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ],
  plugins: [
    // Only add plugin when enabled
    ...(enableLineage ? [
      ['jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js', {
        enabled: true
      }]
    ] : [])
  ]
};
```

### **Use Cases for Disabling**

#### **🚀 CI/CD Pipelines**
```bash
# Fast CI runs - disable detailed tracking
export JEST_LINEAGE_ENABLED=false
npm test

# Detailed analysis runs - enable everything
export JEST_LINEAGE_ENABLED=true
npm test
```

#### **🔧 Development Workflow**
```bash
# Quick development testing
export JEST_LINEAGE_PERFORMANCE=false
npm test

# Deep analysis when needed
export JEST_LINEAGE_PERFORMANCE=true
npm test
```

#### **📊 Performance Testing**
```bash
# Measure test performance without instrumentation overhead
export JEST_LINEAGE_ENABLED=false
npm test

# Analyze test quality and performance
export JEST_LINEAGE_ENABLED=true
npm test
```

### **📦 NPM Scripts (For Package Development)**

If you're working on the jest-test-lineage-reporter package itself, you can use these scripts:

```bash
# 🚀 Fast testing (no instrumentation)
npm run test:fast

# 📊 Full lineage analysis
npm run test:lineage

# 🔥 Performance focus (no quality analysis)
npm run test:performance

# 🧪 Quality focus (no performance monitoring)
npm run test:quality

# 👀 Watch mode with lineage
npm run test:watch
```

## How It Works

1. **Coverage Collection**: Jest collects Istanbul coverage data during test execution
2. **Test Result Processing**: The reporter hooks into Jest's `onTestResult` event to capture both test results and coverage data
3. **Line Mapping**: For each covered line, the reporter associates it with all successful tests from the test file that executed it
4. **Report Generation**: After all tests complete, the reporter generates a comprehensive line-by-line breakdown

## Limitations

Due to Jest's architecture, this reporter has one important limitation:

- **File-level granularity**: The reporter associates all successful tests in a test file with all lines covered during that file's execution. It cannot determine which specific `it()` block covered which line.

For a truly perfect solution that maps individual test cases to specific lines, you would need:
1. To run each test in isolation (very slow)
2. Deep integration with Jest's internals and V8/Istanbul instrumentation

However, this reporter provides significant value for understanding test coverage patterns and identifying potential redundancies at the file level.

## Project Structure

```
jest-test-lineage-reporter/
├── src/
│   ├── __tests__/
│   │   └── calculator.test.ts    # Example test file
│   ├── calculator.ts             # Example source file
│   ├── TestCoverageReporter.js   # Main reporter implementation
│   └── TestCoverageReporter.ts   # TypeScript version (reference)
├── jest.config.js                # Jest configuration
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

## 🔧 Troubleshooting

### **Common Issues**

#### **"Cannot find module" Error**
```bash
Error: Cannot find module 'jest-test-lineage-reporter/src/testSetup.js'
```
**Solutions**:
1. **Make sure the package is installed**:
   ```bash
   npm install jest-test-lineage-reporter --save-dev
   ```

2. **Use the correct path in jest.config.js**:
   ```javascript
   // ✅ Correct - short path (recommended)
   setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js']

   // ✅ Also correct - explicit path
   setupFilesAfterEnv: ['./node_modules/jest-test-lineage-reporter/src/testSetup.js']
   ```

3. **For Babel plugin in babel.config.js**:
   ```javascript
   plugins: [
     // ✅ Recommended - short path
     'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js'

     // ✅ Also works - explicit path
     // './node_modules/jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js'
   ]
   ```

#### **No HTML Report Generated**
**Possible causes**:
- Tests failed before completion
- No coverage data collected
- File permissions issue

**Solution**:
1. Ensure `collectCoverage: true` is set
2. Check that tests are passing
3. Verify write permissions in the project directory

#### **Performance Tracking Not Working**
**Solution**: Make sure Babel plugin is configured:
```javascript
// babel.config.js
module.exports = {
  plugins: [
    './node_modules/jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js'
  ]
};
```

#### **TypeScript Issues**
**Solution**: Install TypeScript preset:
```bash
npm install --save-dev @babel/preset-typescript
```

### **Getting Help**

- 📖 **Documentation**: Check the examples in `/src/__tests__/`
- 🐛 **Issues**: [GitHub Issues](https://github.com/kivancbilen/jest-test-lineage-reporter/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/kivancbilen/jest-test-lineage-reporter/discussions)

## 🆘 Requirements

- **Jest**: 24.0.0 or higher
- **Node.js**: 14.0.0 or higher
- **Babel**: 7.0.0 or higher (for advanced features)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Jest team for the excellent testing framework
- Istanbul for coverage instrumentation
- The open-source community for inspiration and feedback
