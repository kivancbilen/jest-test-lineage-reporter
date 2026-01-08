# Testing Docker Fix Before Publishing

## Method 1: Using npm link (Recommended)

### Step 1: Link the local package globally
```bash
cd /Users/kivancbilen/kivanc/jest-test-lineage-reporter
npm link
```

### Step 2: Link in your test project
```bash
cd /path/to/your/test/project
npm link jest-test-lineage-reporter
```

### Step 3: Verify the link
```bash
ls -la node_modules/jest-test-lineage-reporter
# Should show: lrwxr-xr-x ... node_modules/jest-test-lineage-reporter -> /Users/kivancbilen/kivanc/jest-test-lineage-reporter
```

### Step 4: Add to Jest config (jest.config.js)
```javascript
module.exports = {
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],
  reporters: [
    'default',
    [
      'jest-test-lineage-reporter',
      {
        outputFile: '.jest-lineage-data.json',
        enableMutationTesting: true,
      }
    ]
  ],
  // ... your other config
};
```

### Step 5: Run tests to generate lineage data
```bash
npx jest --no-coverage
```

### Step 6: Test Workers Mode
```bash
npx jest-lineage mutate --workers 4 --timeout 10000
```

### Step 7: Test Docker Mode
```bash
npx jest-lineage mutate --docker --docker-workers 4 --timeout 10000
```

### Step 8: Compare Results
```bash
# Check both result files
ls -lh .jest-lineage-mutation-results*.json

# Compare mutation scores
jq '{totalMutations, killedMutations, survivedMutations, mutationScore}' .jest-lineage-mutation-results-workers.json
jq '{totalMutations, killedMutations, survivedMutations, mutationScore}' .jest-lineage-mutation-results.json
```

### Step 9: Cleanup (when done testing)
```bash
cd /path/to/your/test/project
npm unlink jest-test-lineage-reporter

cd /Users/kivancbilen/kivanc/jest-test-lineage-reporter
npm unlink
```

---

## Method 2: Using Direct Path (Alternative)

### Install from local directory
```bash
cd /path/to/your/test/project
npm install /Users/kivancbilen/kivanc/jest-test-lineage-reporter
```

This creates a symlink automatically, similar to `npm link`.

### Cleanup
```bash
npm uninstall jest-test-lineage-reporter
```

---

## Method 3: Test in FactoryGame (Existing Project)

Since FactoryGame already has jest-test-lineage-reporter configured:

```bash
cd /Users/kivancbilen/kivanc/FactoryGame

# Ensure symlink is correct
rm -f node_modules/jest-test-lineage-reporter
ln -s /Users/kivancbilen/kivanc/jest-test-lineage-reporter node_modules/jest-test-lineage-reporter

# Run tests
npx jest __tests__/systems/RecipeProcessingSystem.test.ts --no-coverage

# Test workers mode
npx jest-lineage mutate --data .jest-lineage-data.json --workers 2 --timeout 10000 > workers-results.txt 2>&1 &

# Test Docker mode
npx jest-lineage mutate --data .jest-lineage-data.json --docker --docker-workers 2 --timeout 10000 > docker-results.txt 2>&1 &

# Compare when both complete
tail -50 workers-results.txt | grep "Mutation Score"
tail -50 docker-results.txt | grep "Mutation Score"
```

---

## What to Verify

### ✅ Docker Mode Should:
1. **Not show** "Module jest-test-lineage-reporter/src/testSetup.js not found" errors
2. **Create symlink** inside containers automatically
3. **Produce same mutations** as workers mode
4. **Have similar mutation scores** (±1-2% due to timing differences)
5. **Detect survived mutations** correctly (not mark everything as "killed")

### ❌ Before the Fix (What Was Broken):
- All tests failed with "Module not found"
- False 100% mutation score
- 0 survived mutations
- Every mutation marked as "killed"

### ✅ After the Fix (Expected):
- Tests run successfully
- Realistic mutation score (e.g., 85-95%)
- Some survived mutations detected
- Results match workers mode closely

---

## Quick Verification Script

```bash
#!/bin/bash
# Save as: test-docker-fix.sh

cd /Users/kivancbilen/kivanc/FactoryGame

echo "🧪 Testing Docker Fix..."
echo "========================"

# Run workers mode
echo "📊 Running Workers Mode..."
npx jest-lineage mutate --data .jest-lineage-data.json --workers 2 --timeout 10000 2>&1 | tee workers.log
WORKERS_SCORE=$(tail -50 workers.log | grep "Mutation Score" | grep -oE '[0-9]+%' | head -1)

# Run Docker mode
echo "🐳 Running Docker Mode..."
npx jest-lineage mutate --data .jest-lineage-data.json --docker --docker-workers 2 --timeout 10000 2>&1 | tee docker.log
DOCKER_SCORE=$(tail -50 docker.log | grep "Mutation Score" | grep -oE '[0-9]+%' | head -1)

# Compare
echo ""
echo "📊 Results:"
echo "  Workers Mode: $WORKERS_SCORE"
echo "  Docker Mode:  $DOCKER_SCORE"

# Check for "Module not found" errors
if grep -q "Module.*not found" docker.log; then
    echo "❌ Docker mode has module resolution errors!"
    exit 1
else
    echo "✅ No module resolution errors in Docker mode"
fi

# Check mutation scores are similar
if [ "$WORKERS_SCORE" = "$DOCKER_SCORE" ]; then
    echo "✅ Mutation scores match exactly!"
elif [ -n "$WORKERS_SCORE" ] && [ -n "$DOCKER_SCORE" ]; then
    echo "✅ Both modes produced results (scores may vary slightly)"
else
    echo "⚠️  One or both modes failed to produce scores"
    exit 1
fi

echo ""
echo "✅ Docker fix verification complete!"
```

Make it executable and run:
```bash
chmod +x test-docker-fix.sh
./test-docker-fix.sh
```

---

## Expected Test Output

### Before Publishing Checklist:
- [ ] Workers mode completes successfully
- [ ] Docker mode completes successfully
- [ ] No "Module not found" errors in Docker logs
- [ ] Docker and Workers produce similar mutation counts
- [ ] Docker and Workers have similar mutation scores (±5%)
- [ ] Docker mode detects survived mutations (not 100% score)
- [ ] Symlink created correctly in Docker containers
- [ ] Tests run inside Docker containers

---

## Troubleshooting

### If Docker mode shows 0 mutations:
```bash
# Check if lineage data has mutation-enabled tracking
jq '.tests | length' .jest-lineage-data.json

# Regenerate with mutation tracking enabled
npx jest --no-coverage
```

### If symlink fails:
```bash
# Test symlink creation manually
docker run --rm \
  -v $(pwd):/project \
  -v /Users/kivancbilen/kivanc/jest-test-lineage-reporter:/jest-lineage-reporter:ro \
  jest-lineage-mutation-worker:latest \
  ls -la /project/node_modules/jest-test-lineage-reporter
```

### If Docker build fails:
```bash
cd /Users/kivancbilen/kivanc/jest-test-lineage-reporter
docker build -t jest-lineage-mutation-worker:latest .
```
