# Docker-Based Parallel Mutation Testing

## Overview

The Docker-based mutation testing feature enables **true parallelization** by running mutations in isolated Docker containers. This provides:

- **10-16x faster execution** compared to serial mode
- **Linear scaling** with CPU cores
- **Isolated environments** preventing file conflicts
- **True concurrent execution** across multiple cores

## Performance Comparison

| Mode | Workers | Estimated Time (662 mutations) | Speedup |
|------|---------|-------------------------------|---------|
| Serial | 1 | ~55 minutes | 1x |
| Parallel (in-process) | 4 | ~32 minutes | 1.7x |
| **Docker** | **16** | **~2-3 minutes** | **~16x** |

## Prerequisites

- Docker installed and running
- Docker daemon accessible from command line
- Sufficient CPU cores and memory

## Quick Start

### 1. Basic Docker Mode

```bash
# Use Docker with auto-detected worker count
jest-lineage mutate --docker

# Specify number of Docker containers
jest-lineage mutate --docker --docker-workers 16
```

### 2. First Run

On first run, Docker will build the mutation testing image:

```bash
$ jest-lineage mutate --docker

🐳 Docker Parallel Mutation Testing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Workers: 16
🧬 Total Mutations: 662
📂 Project: /path/to/project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Building Docker image: jest-lineage-mutation-worker:latest
...
✅ Image built successfully
```

### 3. Subsequent Runs

After the first build, the image is reused:

```bash
$ jest-lineage mutate --docker --docker-workers 16

✅ Image already exists: jest-lineage-mutation-worker:latest
🚀 Starting 16 Docker containers...

[Worker 1] 🐳 Starting container: jest-lineage-worker-1
[Worker 2] 🐳 Starting container: jest-lineage-worker-2
...
[Worker 16] 🐳 Starting container: jest-lineage-worker-16
```

## CLI Options

### Docker-Specific Options

```bash
--docker                    # Enable Docker mode
--docker-workers <number>   # Number of containers (default: CPU cores - 1)
--docker-image <name>       # Custom image name (default: jest-lineage-mutation-worker)
--docker-tag <tag>          # Image tag (default: latest)
```

### Complete Example

```bash
# Run with 16 Docker workers and custom timeout
jest-lineage mutate \
  --docker \
  --docker-workers 16 \
  --timeout 10000 \
  --threshold 80
```

## Architecture

### How It Works

```
┌─────────────────────────────────────────────┐
│ DockerCoordinator (Host Process)             │
│ - Splits mutations into 16 batches          │
│ - Creates work files                         │
│ - Spawns Docker containers                   │
│ - Collects & aggregates results             │
└─────────────────────────────────────────────┘
           │
           ├──> Container 1: mutations 1-41
           ├──> Container 2: mutations 42-82
           ├──> Container 3: mutations 83-123
           │    ...
           └──> Container 16: mutations 621-662
                  │
                  ├─ Isolated filesystem
                  ├─ Dedicated CPU core
                  └─ Independent Jest process
```

### Key Components

1. **Dockerfile**: Alpine-based Node.js image (~200MB)
2. **MutationWorker.js**: Worker script running inside containers
3. **DockerCoordinator.js**: Orchestration layer on host
4. **Volume Mounts**:
   - `/project` (read-only): Source code
   - `/app/work.json` (read-only): Work assignment
   - `/app/results`: Output directory

## Configuration

### Via package.json

```json
{
  "jest-lineage": {
    "enableDocker": true,
    "dockerWorkers": 16,
    "dockerImage": "jest-lineage-mutation-worker",
    "dockerImageTag": "latest",
    "mutationTimeout": 10000
  }
}
```

### Via Environment Variables

```bash
export JEST_LINEAGE_DOCKER=true
export JEST_LINEAGE_DOCKER_WORKERS=16
jest-lineage mutate
```

## Optimization Tips

### 1. Worker Count

```bash
# Auto-detect optimal worker count (recommended)
jest-lineage mutate --docker --docker-workers 0

# Use specific count based on your CPU
jest-lineage mutate --docker --docker-workers 16

# For small mutation counts, use fewer workers
jest-lineage mutate --docker --docker-workers 4
```

### 2. Image Caching

The Docker image is built once and reused. To rebuild:

```bash
# Remove the image
docker rmi jest-lineage-mutation-worker:latest

# Next run will rebuild
jest-lineage mutate --docker
```

### 3. Memory Management

Each container uses ~100-200MB of memory. For 16 workers:

```bash
# Ensure sufficient memory is available
# 16 workers × 200MB = ~3.2GB minimum
```

## Troubleshooting

### Docker Not Found

```
Error: docker: command not found
```

**Solution**: Install Docker Desktop or Docker Engine

### Permission Denied

```
Error: permission denied while trying to connect to Docker daemon
```

**Solution**: Add user to docker group or run with sudo
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Image Build Fails

```
Error: Failed to build Docker image
```

**Solution**: Check Docker daemon is running and disk space is available
```bash
docker info
df -h
```

### Container Fails to Start

```
[Worker 1] ❌ Container failed with code 1
```

**Solution**: Check logs and ensure source files are accessible
```bash
docker logs jest-lineage-worker-1
```

### Slow Performance

If Docker mode is slower than expected:

1. Check CPU usage: `docker stats`
2. Reduce worker count if CPU is saturated
3. Increase mutation timeout if tests are timing out
4. Check disk I/O (especially on networked file systems)

## Advanced Usage

### Custom Docker Image

Build your own image with additional dependencies:

```dockerfile
FROM jest-lineage-mutation-worker:latest

# Install additional tools
RUN npm install -g some-package

# Copy custom configuration
COPY custom-config.js /app/
```

```bash
# Build custom image
docker build -t my-mutation-worker:latest .

# Use custom image
jest-lineage mutate \
  --docker \
  --docker-image my-mutation-worker \
  --docker-tag latest
```

### Debugging Containers

```bash
# Keep container running for debugging
docker run -it --rm \
  -v $(pwd):/project:ro \
  jest-lineage-mutation-worker:latest \
  /bin/sh
```

### CI/CD Integration

```yaml
# GitHub Actions example
name: Mutation Testing

on: [push]

jobs:
  mutate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with lineage tracking
        run: npx jest-lineage test

      - name: Run Docker mutation testing
        run: npx jest-lineage mutate --docker --docker-workers 4
```

## Limitations

1. **Docker Required**: Docker must be installed and running
2. **Disk Space**: Requires ~200MB for Docker image
3. **Volume Mounts**: Source files must be accessible to Docker
4. **Linux/macOS**: Tested primarily on Linux/macOS (Windows WSL2 should work)

## Future Enhancements

- [ ] Docker Compose support for complex setups
- [ ] Remote Docker daemon support
- [ ] Kubernetes/cloud container orchestration
- [ ] Pre-built Docker images on Docker Hub
- [ ] ARM architecture support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on improving Docker support.

## License

MIT
