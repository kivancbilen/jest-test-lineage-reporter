#!/usr/bin/env node

/**
 * MCP Server for Jest Test Lineage Reporter
 * Exposes test analytics functionality via Model Context Protocol
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const { runJest } = require('../cli/utils/jest-runner');
const { loadLineageData, processLineageDataForMutation } = require('../cli/utils/data-loader');
const { loadFullConfig } = require('../cli/utils/config-loader');
const MutationTester = require('../MutationTester');
const TestCoverageReporter = require('../TestCoverageReporter');

// Create MCP server
const server = new Server(
  {
    name: 'jest-test-lineage-reporter',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'run_tests',
        description: 'Run Jest tests with lineage tracking and generate coverage data',
        inputSchema: {
          type: 'object',
          properties: {
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Jest command-line arguments (e.g., ["--watch", "--testPathPattern=calculator"])',
              default: [],
            },
            enableLineage: {
              type: 'boolean',
              description: 'Enable lineage tracking',
              default: true,
            },
            enablePerformance: {
              type: 'boolean',
              description: 'Enable performance tracking',
              default: true,
            },
            enableQuality: {
              type: 'boolean',
              description: 'Enable quality analysis',
              default: true,
            },
          },
        },
      },
      {
        name: 'run_mutation_testing',
        description: 'Run mutation testing on existing lineage data to assess test effectiveness',
        inputSchema: {
          type: 'object',
          properties: {
            dataPath: {
              type: 'string',
              description: 'Path to lineage data file',
              default: '.jest-lineage-data.json',
            },
            threshold: {
              type: 'number',
              description: 'Minimum mutation score threshold (0-100)',
              default: 80,
            },
            timeout: {
              type: 'number',
              description: 'Timeout per mutation in milliseconds',
              default: 5000,
            },
            debug: {
              type: 'boolean',
              description: 'Create debug mutation files instead of running tests',
              default: false,
            },
          },
        },
      },
      {
        name: 'generate_report',
        description: 'Generate HTML report from existing lineage data',
        inputSchema: {
          type: 'object',
          properties: {
            dataPath: {
              type: 'string',
              description: 'Path to lineage data file',
              default: '.jest-lineage-data.json',
            },
            outputPath: {
              type: 'string',
              description: 'Output HTML file path',
              default: 'test-lineage-report.html',
            },
          },
        },
      },
      {
        name: 'query_coverage',
        description: 'Query which tests cover specific files or lines',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'File path to query (e.g., "src/calculator.ts")',
            },
            line: {
              type: 'number',
              description: 'Optional line number to query',
            },
            dataPath: {
              type: 'string',
              description: 'Path to lineage data file',
              default: '.jest-lineage-data.json',
            },
          },
          required: ['file'],
        },
      },
      {
        name: 'analyze_full',
        description: 'Run full workflow: tests, mutation testing, and generate report',
        inputSchema: {
          type: 'object',
          properties: {
            skipTests: {
              type: 'boolean',
              description: 'Skip running tests (use existing data)',
              default: false,
            },
            skipMutation: {
              type: 'boolean',
              description: 'Skip mutation testing',
              default: false,
            },
            threshold: {
              type: 'number',
              description: 'Mutation score threshold',
              default: 80,
            },
            outputPath: {
              type: 'string',
              description: 'Output HTML file path',
              default: 'test-lineage-report.html',
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'run_tests': {
        const result = await runJest({
          args: args.args || [],
          enableLineage: args.enableLineage !== false,
          enablePerformance: args.enablePerformance !== false,
          enableQuality: args.enableQuality !== false,
          quiet: false,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                exitCode: result.exitCode,
                message: result.success
                  ? 'Tests completed successfully. Lineage data saved to .jest-lineage-data.json'
                  : `Tests failed with exit code ${result.exitCode}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'run_mutation_testing': {
        const config = loadFullConfig({
          threshold: args.threshold,
          timeout: args.timeout,
          debug: args.debug,
        });

        const rawData = loadLineageData(args.dataPath || '.jest-lineage-data.json');
        const lineageData = processLineageDataForMutation(rawData);

        const mutationTester = new MutationTester(config);
        mutationTester.setLineageData(lineageData);

        const results = await mutationTester.runMutationTesting();

        await mutationTester.cleanup();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                mutationScore: results.mutationScore,
                totalMutations: results.totalMutations,
                killedMutations: results.killedMutations,
                survivedMutations: results.survivedMutations,
                timeoutMutations: results.timeoutMutations || 0,
                errorMutations: results.errorMutations || 0,
                meetsThreshold: results.mutationScore >= (args.threshold || 80),
                message: `Mutation testing complete. Score: ${results.mutationScore.toFixed(1)}%`,
              }, null, 2),
            },
          ],
        };
      }

      case 'generate_report': {
        const rawData = loadLineageData(args.dataPath || '.jest-lineage-data.json');
        const lineageData = processLineageDataForMutation(rawData);

        const reporter = new TestCoverageReporter(
          { rootDir: process.cwd() },
          { outputFile: args.outputPath || 'test-lineage-report.html' }
        );

        reporter.processLineageResults(lineageData, 'unknown');
        await reporter.generateHtmlReport();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                outputPath: args.outputPath || 'test-lineage-report.html',
                message: 'HTML report generated successfully',
              }, null, 2),
            },
          ],
        };
      }

      case 'query_coverage': {
        const rawData = loadLineageData(args.dataPath || '.jest-lineage-data.json');
        const lineageData = processLineageDataForMutation(rawData);

        const path = require('path');
        const normalizedFile = path.normalize(args.file);

        const matchingFiles = Object.keys(lineageData).filter(f =>
          f.includes(normalizedFile) || normalizedFile.includes(path.basename(f))
        );

        if (matchingFiles.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `No coverage data found for file: ${args.file}`,
                }, null, 2),
              },
            ],
          };
        }

        const targetFile = matchingFiles[0];
        const fileCoverage = lineageData[targetFile];

        if (args.line) {
          const lineNumber = args.line.toString();
          if (!fileCoverage[lineNumber]) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `No coverage data for line ${args.line} in ${args.file}`,
                  }, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  file: targetFile,
                  line: lineNumber,
                  tests: fileCoverage[lineNumber],
                }, null, 2),
              },
            ],
          };
        } else {
          const lines = Object.keys(fileCoverage);
          const totalTests = new Set(
            lines.flatMap(lineNum => fileCoverage[lineNum].map(t => t.testName))
          ).size;

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  file: targetFile,
                  linesCovered: lines.length,
                  totalTests,
                  coverageByLine: fileCoverage,
                }, null, 2),
              },
            ],
          };
        }
      }

      case 'analyze_full': {
        const results = {
          steps: [],
        };

        // Step 1: Run tests
        if (!args.skipTests) {
          const testResult = await runJest({
            args: [],
            enableLineage: true,
            enablePerformance: true,
            enableQuality: true,
            quiet: false,
          });

          results.steps.push({
            step: 'tests',
            success: testResult.success,
            exitCode: testResult.exitCode,
          });

          if (!testResult.success) {
            results.success = false;
            results.message = 'Tests failed';
            return {
              content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
            };
          }
        }

        // Step 2: Mutation testing
        if (!args.skipMutation) {
          try {
            const config = loadFullConfig({ threshold: args.threshold });
            const rawData = loadLineageData('.jest-lineage-data.json');
            const lineageData = processLineageDataForMutation(rawData);

            const mutationTester = new MutationTester(config);
            mutationTester.setLineageData(lineageData);

            const mutationResults = await mutationTester.runMutationTesting();
            await mutationTester.cleanup();

            results.steps.push({
              step: 'mutation',
              success: mutationResults.mutationScore >= (args.threshold || 80),
              mutationScore: mutationResults.mutationScore,
            });
          } catch (err) {
            results.steps.push({
              step: 'mutation',
              success: false,
              error: err.message,
            });
          }
        }

        // Step 3: Generate report
        try {
          const rawData = loadLineageData('.jest-lineage-data.json');
          const lineageData = processLineageDataForMutation(rawData);

          const reporter = new TestCoverageReporter(
            { rootDir: process.cwd() },
            { outputFile: args.outputPath || 'test-lineage-report.html' }
          );

          reporter.processLineageResults(lineageData, 'unknown');
          await reporter.generateHtmlReport();

          results.steps.push({
            step: 'report',
            success: true,
            outputPath: args.outputPath || 'test-lineage-report.html',
          });
        } catch (err) {
          results.steps.push({
            step: 'report',
            success: false,
            error: err.message,
          });
        }

        results.success = results.steps.every(s => s.success);
        results.message = results.success
          ? 'Full analysis completed successfully'
          : 'Some steps failed';

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Jest Test Lineage Reporter MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
