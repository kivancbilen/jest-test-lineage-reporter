/**
 * Mutation Testing Worker for Docker Container
 * Runs a batch of mutations in an isolated container
 */

const fs = require('fs');
const path = require('path');
const MutationTester = require('../MutationTester');

class MutationWorker {
  constructor() {
    this.workerId = process.env.WORKER_ID || '1';
    this.projectPath = process.env.PROJECT_PATH || '/project';
    this.resultsPath = process.env.RESULTS_PATH || '/app/results';
    this.workFile = process.env.WORK_FILE || '/app/work.json';
  }

  /**
   * Main entry point for the worker
   */
  async run() {
    console.log(`[Worker ${this.workerId}] Starting mutation testing worker`);
    console.log(`[Worker ${this.workerId}] Project path: ${this.projectPath}`);
    console.log(`[Worker ${this.workerId}] Results path: ${this.resultsPath}`);

    try {
      // Read work assignment
      const workAssignment = await this.readWorkAssignment();

      if (!workAssignment || !workAssignment.mutations || workAssignment.mutations.length === 0) {
        console.log(`[Worker ${this.workerId}] No mutations assigned`);
        await this.writeResults({ mutations: [], error: 'No work assigned' });
        return;
      }

      console.log(`[Worker ${this.workerId}] Processing ${workAssignment.mutations.length} mutations`);

      // Load configuration
      const config = workAssignment.config || {};

      // Create mutation tester instance
      const tester = new MutationTester(config);
      tester.lineageData = workAssignment.lineageData || {};

      // Process assigned mutations
      const results = {
        workerId: this.workerId,
        totalMutations: 0,
        killedMutations: 0,
        survivedMutations: 0,
        timeoutMutations: 0,
        errorMutations: 0,
        mutations: [],
        startTime: Date.now(),
        endTime: null
      };

      // Process each mutation
      for (const mutation of workAssignment.mutations) {
        console.log(
          `[Worker ${this.workerId}] Testing ${mutation.filePath}:${mutation.lineNumber}:${mutation.mutationType}`
        );

        try {
          const mutationResult = await tester.testSingleMutation(
            path.join(this.projectPath, mutation.filePath),
            mutation.lineNumber,
            mutation.mutationType,
            mutation.tests || [],
            mutation.index || 1,
            workAssignment.totalMutations || workAssignment.mutations.length,
            this.workerId
          );

          if (mutationResult) {
            results.mutations.push(mutationResult);
            results.totalMutations++;

            switch (mutationResult.status) {
              case 'killed':
                results.killedMutations++;
                break;
              case 'survived':
                results.survivedMutations++;
                break;
              case 'timeout':
                results.timeoutMutations++;
                break;
              case 'error':
                results.errorMutations++;
                break;
            }
          }
        } catch (error) {
          console.error(`[Worker ${this.workerId}] Error testing mutation:`, error.message);
          results.errorMutations++;
          results.mutations.push({
            filePath: mutation.filePath,
            lineNumber: mutation.lineNumber,
            mutationType: mutation.mutationType,
            status: 'error',
            error: error.message
          });
        }
      }

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;

      // Write results
      await this.writeResults(results);

      console.log(`[Worker ${this.workerId}] Completed: ${results.totalMutations} mutations tested`);
      console.log(`[Worker ${this.workerId}] - Killed: ${results.killedMutations}`);
      console.log(`[Worker ${this.workerId}] - Survived: ${results.survivedMutations}`);
      console.log(`[Worker ${this.workerId}] - Timeout: ${results.timeoutMutations}`);
      console.log(`[Worker ${this.workerId}] - Error: ${results.errorMutations}`);
      console.log(`[Worker ${this.workerId}] Duration: ${(results.duration / 1000).toFixed(2)}s`);

      process.exit(0);
    } catch (error) {
      console.error(`[Worker ${this.workerId}] Fatal error:`, error);
      await this.writeResults({
        error: error.message,
        stack: error.stack,
        workerId: this.workerId
      });
      process.exit(1);
    }
  }

  /**
   * Read work assignment from file
   */
  async readWorkAssignment() {
    try {
      if (!fs.existsSync(this.workFile)) {
        console.error(`[Worker ${this.workerId}] Work file not found: ${this.workFile}`);
        return null;
      }

      const content = fs.readFileSync(this.workFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[Worker ${this.workerId}] Error reading work file:`, error.message);
      throw error;
    }
  }

  /**
   * Write results to file
   */
  async writeResults(results) {
    try {
      // Ensure results directory exists
      if (!fs.existsSync(this.resultsPath)) {
        fs.mkdirSync(this.resultsPath, { recursive: true });
      }

      const resultsFile = path.join(this.resultsPath, `worker-${this.workerId}-results.json`);
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
      console.log(`[Worker ${this.workerId}] Results written to: ${resultsFile}`);
    } catch (error) {
      console.error(`[Worker ${this.workerId}] Error writing results:`, error.message);
      throw error;
    }
  }
}

// Run worker if executed directly
if (require.main === module) {
  const worker = new MutationWorker();
  worker.run().catch(error => {
    console.error('Worker failed:', error);
    process.exit(1);
  });
}

module.exports = MutationWorker;
