#!/bin/bash
# Compare Workers vs Docker Mode
# Run this after generating lineage data

set -e

echo "🔬 Comparing Workers Mode vs Docker Mode"
echo "=========================================="
echo ""

# Check if lineage data exists
if [ ! -f ".jest-lineage-data.json" ]; then
    echo "❌ No lineage data found. Run tests first:"
    echo "   npx jest --no-coverage"
    exit 1
fi

WORKERS=${1:-2}
TIMEOUT=${2:-10000}

echo "⚙️  Configuration:"
echo "  Workers: $WORKERS"
echo "  Timeout: ${TIMEOUT}ms"
echo ""

# Create results directory
mkdir -p .test-results

# Run Workers Mode
echo "📊 Running Workers Mode..."
echo "------------------------"
npx jest-lineage mutate \
    --data .jest-lineage-data.json \
    --workers $WORKERS \
    --timeout $TIMEOUT \
    2>&1 | tee .test-results/workers-output.log

# Save workers results
if [ -f ".jest-lineage-mutation-results.json" ]; then
    mv .jest-lineage-mutation-results.json .test-results/workers-results.json
    echo "✅ Workers mode completed"
else
    echo "❌ Workers mode failed - no results file"
    exit 1
fi

echo ""
echo "🐳 Running Docker Mode..."
echo "------------------------"

# Check Docker is running
if ! docker ps &>/dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Run Docker Mode
npx jest-lineage mutate \
    --data .jest-lineage-data.json \
    --docker \
    --docker-workers $WORKERS \
    --timeout $TIMEOUT \
    2>&1 | tee .test-results/docker-output.log

# Save docker results
if [ -f ".jest-lineage-mutation-results.json" ]; then
    mv .jest-lineage-mutation-results.json .test-results/docker-results.json
    echo "✅ Docker mode completed"
else
    echo "❌ Docker mode failed - no results file"
    exit 1
fi

echo ""
echo "📊 Results Comparison"
echo "===================="
echo ""

# Extract key metrics
WORKERS_TOTAL=$(jq -r '.totalMutations' .test-results/workers-results.json)
WORKERS_KILLED=$(jq -r '.killedMutations' .test-results/workers-results.json)
WORKERS_SURVIVED=$(jq -r '.survivedMutations' .test-results/workers-results.json)
WORKERS_SCORE=$(jq -r '.mutationScore' .test-results/workers-results.json)

DOCKER_TOTAL=$(jq -r '.totalMutations' .test-results/docker-results.json)
DOCKER_KILLED=$(jq -r '.killedMutations' .test-results/docker-results.json)
DOCKER_SURVIVED=$(jq -r '.survivedMutations' .test-results/docker-results.json)
DOCKER_SCORE=$(jq -r '.mutationScore' .test-results/docker-results.json)

echo "| Metric           | Workers Mode | Docker Mode |"
echo "|------------------|-------------|-------------|"
echo "| Total Mutations  | $WORKERS_TOTAL          | $DOCKER_TOTAL         |"
echo "| Killed           | $WORKERS_KILLED          | $DOCKER_KILLED         |"
echo "| Survived         | $WORKERS_SURVIVED          | $DOCKER_SURVIVED         |"
echo "| Mutation Score   | ${WORKERS_SCORE}%        | ${DOCKER_SCORE}%       |"
echo ""

# Check for module errors in Docker
if grep -q "Module.*not found" .test-results/docker-output.log; then
    echo "❌ FAIL: Docker mode has module resolution errors"
    echo "   Check: .test-results/docker-output.log"
    exit 1
else
    echo "✅ PASS: No module resolution errors in Docker mode"
fi

# Compare scores
if [ "$WORKERS_SCORE" = "$DOCKER_SCORE" ]; then
    echo "✅ PASS: Mutation scores match exactly ($WORKERS_SCORE%)"
elif [ "$DOCKER_SCORE" -eq 100 ] && [ "$WORKERS_SURVIVED" -gt 0 ]; then
    echo "❌ FAIL: Docker showing 100% (false positives)"
    echo "   Workers found $WORKERS_SURVIVED survived mutations, Docker found 0"
    exit 1
else
    DIFF=$((DOCKER_SCORE - WORKERS_SCORE))
    DIFF=${DIFF#-}  # absolute value
    if [ "$DIFF" -le 5 ]; then
        echo "✅ PASS: Mutation scores within 5% (${DIFF}% difference)"
    else
        echo "⚠️  WARN: Mutation scores differ by ${DIFF}%"
    fi
fi

# Check total mutations
if [ "$WORKERS_TOTAL" = "$DOCKER_TOTAL" ]; then
    echo "✅ PASS: Same number of mutations tested ($WORKERS_TOTAL)"
else
    echo "⚠️  WARN: Different mutation counts (Workers: $WORKERS_TOTAL, Docker: $DOCKER_TOTAL)"
fi

echo ""
echo "📁 Detailed results saved in .test-results/"
echo "  - workers-results.json"
echo "  - docker-results.json"
echo "  - workers-output.log"
echo "  - docker-output.log"
echo ""
echo "✅ Comparison complete!"
