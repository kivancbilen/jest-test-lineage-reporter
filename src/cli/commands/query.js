/**
 * Query Command
 * Query test coverage for specific files/lines
 */

const { loadLineageData, processLineageDataForMutation } = require('../utils/data-loader');
const { section, error, formatPath } = require('../utils/output-formatter');
const Table = require('cli-table3');
const chalk = require('chalk');
const path = require('path');

async function queryCommand(file, line, options) {
  try {
    // Load lineage data
    const rawData = loadLineageData(options.data);
    const lineageData = processLineageDataForMutation(rawData);

    // Normalize file path
    const normalizedFile = path.normalize(file);

    // Find matching files
    const matchingFiles = Object.keys(lineageData).filter(f =>
      f.includes(normalizedFile) || normalizedFile.includes(path.basename(f))
    );

    if (matchingFiles.length === 0) {
      error(`No coverage data found for file: ${chalk.yellow(file)}`);
      process.exit(1);
    }

    // If multiple matches, show them
    if (matchingFiles.length > 1) {
      console.log(chalk.yellow(`Found multiple matching files:`));
      matchingFiles.forEach(f => console.log(`  - ${formatPath(f)}`));
      console.log(chalk.yellow(`\nUsing first match: ${matchingFiles[0]}\n`));
    }

    const targetFile = matchingFiles[0];
    const fileCoverage = lineageData[targetFile];

    // If line specified, show coverage for that line
    if (line) {
      const lineNumber = line.toString();
      if (!fileCoverage[lineNumber]) {
        error(`No coverage data for line ${chalk.yellow(lineNumber)} in ${chalk.yellow(file)}`);
        process.exit(1);
      }

      section(`📍 Coverage for ${formatPath(targetFile)}:${lineNumber}`);

      const tests = fileCoverage[lineNumber];
      const table = new Table({
        head: [chalk.cyan('Test Name'), chalk.cyan('File'), chalk.cyan('Exec Count')],
        colWidths: [50, 30, 12]
      });

      tests.forEach(test => {
        table.push([
          test.testName,
          path.basename(test.testFile),
          test.executionCount
        ]);
      });

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal: ${tests.length} test(s) cover this line`));
    } else {
      // Show coverage for entire file
      section(`📁 Coverage for ${formatPath(targetFile)}`);

      const lines = Object.keys(fileCoverage).sort((a, b) => parseInt(a) - parseInt(b));
      const totalTests = new Set(
        lines.flatMap(lineNum => fileCoverage[lineNum].map(t => t.testName))
      ).size;

      console.log(chalk.gray(`Lines covered: ${lines.length}`));
      console.log(chalk.gray(`Tests covering file: ${totalTests}\n`));

      // Show sample of lines
      const sampleSize = 10;
      const sampled = lines.slice(0, sampleSize);

      sampled.forEach(lineNum => {
        const tests = fileCoverage[lineNum];
        console.log(chalk.cyan(`Line ${lineNum}:`));
        tests.slice(0, 3).forEach(test => {
          console.log(`  ${chalk.gray('•')} ${test.testName} ${chalk.gray(`(${path.basename(test.testFile)})`)}`);
        });
        if (tests.length > 3) {
          console.log(chalk.gray(`  ... and ${tests.length - 3} more test(s)`));
        }
      });

      if (lines.length > sampleSize) {
        console.log(chalk.gray(`\n... and ${lines.length - sampleSize} more lines`));
        console.log(chalk.yellow(`\nTip: Specify a line number to see details: jest-lineage query ${file} <line>`));
      }
    }

    process.exit(0);
  } catch (err) {
    error(`Query failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = queryCommand;
