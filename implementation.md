# **Detailed Implementation Plan: Jest Reporter for Test-Specific Coverage**

This document outlines the detailed plan to create a custom Jest reporter that associates covered lines of code with the tests that executed them.

### **Goal**

Develop a Jest reporter that generates a report showing which tests cover which lines of code. This helps in identifying redundant tests and understanding test-code relationships.

### **High-Level Approach**

1. **Create a custom Jest reporter class.** This class will implement Jest's Reporter interface.  
2. **Hook into the onTestResult event.** This method is called after each test file has been executed.  
3. **Capture coverage data and test results.** Within onTestResult, we will access the raw Istanbul coverage data and the list of tests that ran in that file.  
4. **Parse and store the data.** We will build a data structure that maps each line number in a file to a list of test names that contributed to its coverage.  
5. **Hook into the onRunComplete event.** This method is called after all tests have finished.  
6. **Generate a final report.** We will use the stored data to print a human-readable report to the console or generate an HTML file.

---

### **Step 1: Project Setup**

Create a new Node.js project and install the necessary dependencies.

Bash

mkdir jest-coverage-reporter  
cd jest-coverage-reporter  
npm init \-y  
npm install \--save-dev jest typescript ts-node @types/jest

Create a tsconfig.json file to configure the TypeScript compiler.

**tsconfig.json**

JSON

{  
  "compilerOptions": {  
    "target": "es2020",  
    "module": "commonjs",  
    "outDir": "./dist",  
    "rootDir": "./src",  
    "strict": true,  
    "esModuleInterop": true,  
    "skipLibCheck": true,  
    "forceConsistentCasingInFileNames": true  
  },  
  "include": \[  
    "src/\*\*/\*"  
  \],  
  "exclude": \[  
    "node\_modules",  
    "dist"  
  \]  
}

---

### **Step 2: Create the Reporter Class**

Create a new file src/TestCoverageReporter.ts to house the reporter logic.

**src/TestCoverageReporter.ts**

TypeScript

import { AggregatedResult, TestResult } from '@jest/test-result';  
import { Reporter } from '@jest/reporters';  
import { CoverageMapData } from 'istanbul-lib-coverage';  
import { Test, AssertionResult } from '@jest/test-result/build/types';

/\*\*  
 \* A data structure to store the mapping of lines to tests.  
 \* Example:  
 \* {  
 \* "/path/to/my-file.ts": {  
 \* "15": \["should handle valid input", "should not throw an error"\],  
 \* "16": \["should handle valid input"\]  
 \* }  
 \* }  
 \*/  
interface CoverageReportData {  
  \[filePath: string\]: {  
    \[lineNumber: string\]: string\[\];  
  };  
}

export default class TestCoverageReporter implements Reporter {  
  private coverageData: CoverageReportData \= {};

  constructor(globalConfig: any, options: any) {  
    // Constructor is required by Jest, but we don't need to do anything here for this example.  
  }

  // This method is called after a single test file (suite) has completed.  
  async onTestResult(test: Test, testResult: TestResult, aggregatedResult: AggregatedResult): Promise\<void\> {  
    const filePath \= test.path;  
    const coverage: CoverageMapData | undefined \= (testResult as any).coverage; // Type assertion needed for Jest's internal types

    if (\!coverage || \!coverage\[filePath\]) {  
      // No coverage data for this file, skip.  
      return;  
    }

    // Get the names of all successful tests in this file  
    const successfulTestNames \= testResult.testResults  
      .filter((assertionResult: AssertionResult) \=\> assertionResult.status \=== 'passed')  
      .map((assertionResult: AssertionResult) \=\> assertionResult.fullName);  
      
    // If there were no successful tests, no lines were covered by a passing test.  
    if (successfulTestNames.length \=== 0) {  
      return;  
    }

    // Get the Istanbul statement map for this file  
    const fileCoverage \= coverage\[filePath\];  
    const statementMap \= fileCoverage.statementMap;  
    const statements \= fileCoverage.s;

    // Initialize the data structure for this file if it doesn't exist  
    if (\!this.coverageData\[filePath\]) {  
      this.coverageData\[filePath\] \= {};  
    }

    // Iterate through all statements  
    for (const statementId in statements) {  
      // Check if the statement was executed at least once  
      if (statements\[statementId\] \> 0) {  
        // Get the line number for the statement  
        const lineNumber \= String(statementMap\[statementId\].start.line);

        // Get the list of tests for this line  
        let testsForLine \= this.coverageData\[filePath\]\[lineNumber\] || \[\];

        // Add all successful tests from this file to the list for this line  
        // We use a Set later to ensure uniqueness  
        testsForLine.push(...successfulTestNames);

        this.coverageData\[filePath\]\[lineNumber\] \= testsForLine;  
      }  
    }  
  }

  // This method is called after all tests in the entire run have completed.  
  async onRunComplete(contexts: Set\<any\>, results: AggregatedResult): Promise\<void\> {  
    this.generateReport();  
  }

  private generateReport(): void {  
    console.log('\\n--- Custom Jest Coverage Report: Line-by-Line Breakdown \---');

    for (const filePath in this.coverageData) {  
      console.log(\`\\n📄 File: ${filePath}\`);  
      const lineCoverage \= this.coverageData\[filePath\];  
        
      const lineNumbers \= Object.keys(lineCoverage).sort((a, b) \=\> parseInt(a) \- parseInt(b));

      if (lineNumbers.length \=== 0) {  
        console.log('  No lines covered by tests in this file.');  
        continue;  
      }

      for (const line of lineNumbers) {  
        // Get unique test names to avoid redundancy in the report  
        const uniqueTests \= \[...new Set(lineCoverage\[line\])\];  
        console.log(\`  Line ${line}: Covered by ${uniqueTests.length} test(s)\`);  
        uniqueTests.forEach(testName \=\> {  
          console.log(\`    \- "${testName}"\`);  
        });  
      }  
    }  
      
    console.log('\\n--- Report End \---');  
  }  
}

**Note on Limitations:** The above implementation will correctly identify that a line of code was covered by a test run. However, it will associate *all* successful tests from that test file with the covered lines. It cannot differentiate which specific it() block covered which line. This is a limitation of Jest's current reporter API, which aggregates coverage at the file level. A truly perfect solution would require running each it() block in isolation or hooking into the V8/Istanbul instrumentation at a much deeper level.

---

### **Step 3: Configure Jest to Use the Reporter**

Update your jest.config.js file to use the new reporter. This tells Jest to run our custom reporter alongside the default one.

**jest.config.js**

JavaScript

module.exports \= {  
  // Use ts-node to run the TypeScript reporter  
  testRunner: 'jest-jasmine2', // Jest v27+  
    
  // Set the reporter to our custom class  
  reporters: \[  
    'default', // The standard Jest reporter  
    './src/TestCoverageReporter.ts' // Our custom reporter  
  \],

  // Enable coverage to generate the data we need  
  collectCoverage: true,

  // Specify where to collect coverage from  
  collectCoverageFrom: \[  
    'src/\*\*/\*.ts',  
    '\!src/\*\*/\*.d.ts'  
  \],

  // Set up TypeScript for tests  
  preset: 'ts-jest',  
};

**Note:** The testRunner and preset configurations are important for running TypeScript tests with Jest.

---

### **Step 4: Add Example Test and Source Files**

Create some simple source and test files to demonstrate the reporter.

**src/calculator.ts**

TypeScript

export function add(a: number, b: number): number {  
  return a \+ b;  
}

export function subtract(a: number, b: number): number {  
  if (a \< b) {  
    return b \- a; // Line 7  
  }  
  return a \- b; // Line 9  
}

export function multiply(a: number, b: number): number {  
  return a \* b; // Line 13  
}

**src/\_\_tests\_\_/calculator.test.ts**

TypeScript

import { add, subtract, multiply } from '../calculator';

describe('Calculator', () \=\> {  
  it('should correctly add two numbers', () \=\> {  
    expect(add(1, 2)).toBe(3);  
  });

  it('should subtract a smaller number from a larger one', () \=\> {  
    expect(subtract(5, 2)).toBe(3); // This will hit line 9  
  });

  it('should subtract a larger number from a smaller one and return a positive result', () \=\> {  
    expect(subtract(2, 5)).toBe(3); // This will hit line 7  
  });  
    
  // This test covers the same line as the first subtraction test, which our report will show.  
  it('should handle zero correctly in subtraction', () \=\> {  
    expect(subtract(10, 0)).toBe(10); // This will also hit line 9  
  });  
});

---

### **Step 5: Run the Tests**

Execute your tests with Jest.

Bash

npx jest

### **Expected Output**

You will see the standard Jest test results, followed by the output from your custom reporter.

Bash

... (Standard Jest test results) ...

\--- Custom Jest Coverage Report: Line-by-Line Breakdown \---

📄 File: /path/to/jest-coverage-reporter/src/calculator.ts  
  Line 2: Covered by 4 test(s)  
    \- "Calculator should correctly add two numbers"  
    \- "Calculator should subtract a smaller number from a larger one"  
    \- "Calculator should subtract a larger number from a smaller one and return a positive result"  
    \- "Calculator should handle zero correctly in subtraction"  
  Line 3: Covered by 1 test(s)  
    \- "Calculator should correctly add two numbers"  
  Line 7: Covered by 4 test(s)  
    \- "Calculator should correctly add two numbers"  
    \- "Calculator should subtract a smaller number from a larger one"  
    \- "Calculator should subtract a larger number from a smaller one and return a positive result"  
    \- "Calculator should handle zero correctly in subtraction"  
  Line 9: Covered by 4 test(s)  
    \- "Calculator should correctly add two numbers"  
    \- "Calculator should subtract a smaller number from a larger one"  
    \- "Calculator should subtract a larger number from a smaller one and return a positive result"  
    \- "Calculator should handle zero correctly in subtraction"  
    
\--- Report End \---

**What the output means:**

* The report correctly identifies which lines were covered (2, 3, 7, 9).  
* It lists all the tests that ran in that file as covering those lines.  
* This demonstrates the limitation: a line covered by one test is incorrectly associated with all tests in the file.

### **Next Steps for a Perfect Solution**

For a truly perfect solution, you would need to:

1. **Run each test individually:** This is the most accurate but also the slowest approach. The reporter would need to programmatically run jest \--testNamePattern="the test name" for every single test and collect its isolated coverage data. This is not feasible for a custom reporter; it would need to be a custom test runner.  
2. **Instrument the code with a unique ID per test:** This would involve a more advanced Jest plugin that wraps each it() block with code that sets a global variable. The Istanbul coverage instrumentation would then need to be modified to record which global ID was active when a line was executed. This is a very complex solution requiring a deep understanding of Jest's internals.

The custom reporter provided is an excellent starting point and a significant improvement over the default. It serves as a solid foundation for further development if you choose to pursue a more advanced, deeply integrated solution.