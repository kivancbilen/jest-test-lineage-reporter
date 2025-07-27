# Jest Test Lineage Reporter

A comprehensive test analytics platform that provides line-by-line test coverage, performance metrics, memory analysis, and test quality scoring.

## Features

- **Line-by-line coverage mapping**: See exactly which tests execute each line of your source code
- **Visual HTML reports**: Beautiful, interactive HTML reports for easy visualization
- **Test redundancy identification**: Identify multiple tests covering the same lines
- **Easy integration**: Simple Jest reporter that works alongside existing reporters
- **TypeScript support**: Built with TypeScript support out of the box
- **Statistics and insights**: File-level and overall statistics about test coverage patterns

## Installation

### For External Projects

#### Option 1: NPM Package (Recommended)
```bash
npm install --save-dev jest-test-lineage-reporter
```

#### Option 2: Copy Local File
```bash
# Copy the reporter to your project
cp /path/to/this/project/src/TestCoverageReporter.js ./reporters/
```

#### Option 3: Use the Copy Script
```bash
# From this project directory
./copy-to-project.sh /path/to/your/project
```

### For Development/Testing
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Run the tests to see the lineage reporter in action:

```bash
npm test
```

The reporter will output:
1. **Console Report**: A detailed text breakdown in the terminal
2. **HTML Report**: A beautiful visual report saved as `test-lineage-report.html`

Both reports show:
- Which lines of code are covered by tests
- Which specific tests cover each line
- How many tests cover each line (useful for identifying redundancy)
- File-level and overall statistics

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

## Configuration

### For NPM Package
```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    'jest-test-lineage-reporter'  // NPM package
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts'
  ],
};
```

### For Local File
```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    './reporters/TestCoverageReporter.js'  // Local file
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts'
  ],
};
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

## Contributing

Feel free to extend this reporter with additional features such as:
- HTML report generation
- JSON output for integration with other tools
- Filtering options for specific files or test patterns
- Integration with CI/CD pipelines

## License

ISC License
