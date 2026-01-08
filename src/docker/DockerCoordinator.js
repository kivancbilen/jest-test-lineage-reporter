/**
 * Docker Coordinator for Parallel Mutation Testing
 * Orchestrates multiple Docker containers to run mutations in parallel
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DockerCoordinator {
  constructor(config = {}) {
    this.config = config;
    this.imageName = config.dockerImage || 'jest-lineage-mutation-worker';
    this.imageTag = config.dockerImageTag || 'latest';
    this.workers = config.dockerWorkers || Math.max(1, os.cpus().length - 1);
    this.projectPath = config.projectPath || process.cwd();
    this.tempDir = path.join(os.tmpdir(), `jest-lineage-${Date.now()}`);
    this.containers = [];
  }

  /**
   * Run mutation testing using Docker containers
   */
  async runMutationTesting(lineageData, mutations) {
    console.log(`\n🐳 Docker Parallel Mutation Testing`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Workers: ${this.workers}`);
    console.log(`🧬 Total Mutations: ${mutations.length}`);
    console.log(`📂 Project: ${this.projectPath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      // Setup
      await this.setup();

      // Build Docker image
      await this.buildImage();

      // Split work among workers
      const workBatches = this.splitWork(mutations, this.workers);

      // Create work files for each worker
      await this.createWorkFiles(workBatches, lineageData);

      // Run containers in parallel
      const results = await this.runContainers(workBatches);

      // Aggregate results
      const aggregatedResults = this.aggregateResults(results);

      // Cleanup
      await this.cleanup();

      return aggregatedResults;
    } catch (error) {
      console.error('❌ Docker coordination failed:', error.message);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Setup temporary directories
   */
  async setup() {
    // Create temp directory for work files and results
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    const workDir = path.join(this.tempDir, 'work');
    const resultsDir = path.join(this.tempDir, 'results');

    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(resultsDir, { recursive: true });

    console.log(`📁 Temporary directory: ${this.tempDir}`);
  }

  /**
   * Build Docker image
   */
  async buildImage() {
    const imageFullName = `${this.imageName}:${this.imageTag}`;

    console.log(`🔨 Building Docker image: ${imageFullName}`);

    try {
      // Check if image already exists
      try {
        execSync(`docker image inspect ${imageFullName}`, { stdio: 'pipe' });
        console.log(`✅ Image already exists: ${imageFullName}`);
        return;
      } catch (e) {
        // Image doesn't exist, need to build
      }

      // Get the jest-lineage-reporter directory
      const packageRoot = path.resolve(__dirname, '../..');

      // Build the image
      execSync(
        `docker build -t ${imageFullName} ${packageRoot}`,
        { stdio: 'inherit', cwd: packageRoot }
      );

      console.log(`✅ Image built successfully: ${imageFullName}`);
    } catch (error) {
      console.error(`❌ Failed to build Docker image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Split mutations into batches for workers
   */
  splitWork(mutations, numWorkers) {
    const batchSize = Math.ceil(mutations.length / numWorkers);
    const batches = [];

    for (let i = 0; i < numWorkers; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, mutations.length);
      const batch = mutations.slice(start, end);

      if (batch.length > 0) {
        batches.push({
          workerId: i + 1,
          mutations: batch,
          startIndex: start,
          endIndex: end
        });
      }
    }

    console.log(`📊 Work distribution:`);
    batches.forEach(batch => {
      console.log(`  Worker ${batch.workerId}: ${batch.mutations.length} mutations (${batch.startIndex + 1}-${batch.endIndex})`);
    });
    console.log('');

    return batches;
  }

  /**
   * Create work files for each worker
   */
  async createWorkFiles(workBatches, lineageData) {
    const workDir = path.join(this.tempDir, 'work');

    for (const batch of workBatches) {
      const workFile = path.join(workDir, `worker-${batch.workerId}-work.json`);
      const workData = {
        workerId: batch.workerId,
        mutations: batch.mutations,
        totalMutations: batch.mutations.length,
        lineageData: lineageData,
        config: this.config
      };

      fs.writeFileSync(workFile, JSON.stringify(workData, null, 2));
    }
  }

  /**
   * Run Docker containers in parallel
   */
  async runContainers(workBatches) {
    const imageFullName = `${this.imageName}:${this.imageTag}`;
    const containerPromises = [];

    console.log(`🚀 Starting ${workBatches.length} Docker containers...\n`);

    for (const batch of workBatches) {
      const promise = this.runContainer(imageFullName, batch);
      containerPromises.push(promise);
    }

    // Wait for all containers to complete
    const results = await Promise.all(containerPromises);

    console.log(`\n✅ All containers completed`);

    return results;
  }

  /**
   * Run a single Docker container
   */
  async runContainer(imageName, batch) {
    const workerId = batch.workerId;
    const containerName = `jest-lineage-worker-${workerId}-${Date.now()}`;

    return new Promise((resolve, reject) => {
      const workDir = path.join(this.tempDir, 'work');
      const resultsDir = path.join(this.tempDir, 'results');
      const workFile = path.join(workDir, `worker-${workerId}-work.json`);

      console.log(`[Worker ${workerId}] 🐳 Starting container: ${containerName}`);

      // Get the jest-lineage-reporter path (from __dirname)
      const lineageReporterPath = path.resolve(__dirname, '../../..');

      const args = [
        'run',
        '--rm',
        '--name', containerName,
        '-v', `${this.projectPath}:/project`,  // Mount project directory
        '-v', `${lineageReporterPath}:/jest-lineage-reporter:ro`,  // Mount reporter separately
        '-v', `${workFile}:/app/work.json:ro`,
        '-v', `${resultsDir}:/app/results`,
        '-e', `WORKER_ID=${workerId}`,
        '-e', `PROJECT_PATH=/project`,
        '-e', `RESULTS_PATH=/app/results`,
        '-e', `WORK_FILE=/app/work.json`,
        imageName
      ];

      const container = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.containers.push({ id: containerName, process: container });

      let stdout = '';
      let stderr = '';

      container.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log worker output with prefix
        output.split('\n').forEach(line => {
          if (line.trim()) {
            console.log(line);
          }
        });
      });

      container.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`[Worker ${workerId}] ERROR: ${data.toString().trim()}`);
      });

      container.on('close', (code) => {
        if (code === 0) {
          console.log(`[Worker ${workerId}] ✅ Container completed successfully`);

          // Read results file
          const resultsFile = path.join(resultsDir, `worker-${workerId}-results.json`);

          try {
            if (fs.existsSync(resultsFile)) {
              const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
              resolve(results);
            } else {
              reject(new Error(`Results file not found: ${resultsFile}`));
            }
          } catch (error) {
            reject(new Error(`Failed to read results: ${error.message}`));
          }
        } else {
          console.error(`[Worker ${workerId}] ❌ Container failed with code ${code}`);
          reject(new Error(`Container exited with code ${code}\nStderr: ${stderr}`));
        }
      });

      container.on('error', (error) => {
        console.error(`[Worker ${workerId}] ❌ Container error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Aggregate results from all workers
   */
  aggregateResults(workerResults) {
    console.log(`\n📊 Aggregating results from ${workerResults.length} workers...\n`);

    const aggregated = {
      totalMutations: 0,
      killedMutations: 0,
      survivedMutations: 0,
      timeoutMutations: 0,
      errorMutations: 0,
      mutationScore: 0,
      mutations: [],
      fileResults: {},
      workerResults: workerResults,
      dockerEnabled: true,
      dockerWorkers: this.workers
    };

    for (const result of workerResults) {
      if (result.error) {
        console.error(`❌ Worker ${result.workerId} had errors: ${result.error}`);
        continue;
      }

      aggregated.totalMutations += result.totalMutations || 0;
      aggregated.killedMutations += result.killedMutations || 0;
      aggregated.survivedMutations += result.survivedMutations || 0;
      aggregated.timeoutMutations += result.timeoutMutations || 0;
      aggregated.errorMutations += result.errorMutations || 0;

      if (result.mutations) {
        aggregated.mutations.push(...result.mutations);
      }
    }

    // Calculate mutation score
    const validMutations = aggregated.totalMutations - aggregated.errorMutations;
    aggregated.mutationScore =
      validMutations > 0
        ? Math.round((aggregated.killedMutations / validMutations) * 100)
        : 0;

    // Group mutations by file for fileResults
    aggregated.mutations.forEach(mutation => {
      if (!aggregated.fileResults[mutation.filePath]) {
        aggregated.fileResults[mutation.filePath] = {
          totalMutations: 0,
          killedMutations: 0,
          survivedMutations: 0,
          timeoutMutations: 0,
          errorMutations: 0,
          mutations: []
        };
      }

      const fileResult = aggregated.fileResults[mutation.filePath];
      fileResult.totalMutations++;
      fileResult.mutations.push(mutation);

      switch (mutation.status) {
        case 'killed':
          fileResult.killedMutations++;
          break;
        case 'survived':
          fileResult.survivedMutations++;
          break;
        case 'timeout':
          fileResult.timeoutMutations++;
          break;
        case 'error':
          fileResult.errorMutations++;
          break;
      }
    });

    return aggregated;
  }

  /**
   * Cleanup temporary files and stop containers
   */
  async cleanup() {
    console.log(`\n🧹 Cleaning up...`);

    // Stop any running containers
    for (const container of this.containers) {
      try {
        execSync(`docker stop ${container.id} 2>/dev/null`, { stdio: 'ignore' });
      } catch (e) {
        // Container already stopped
      }
    }

    // Remove temp directory
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log(`✅ Temporary files cleaned up`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup temp directory: ${error.message}`);
    }
  }
}

module.exports = DockerCoordinator;
