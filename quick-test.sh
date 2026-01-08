#!/bin/bash
# Quick Test Script for Docker Fix
# Usage: ./quick-test.sh /path/to/test/project

set -e

if [ -z "$1" ]; then
    echo "Usage: ./quick-test.sh /path/to/test/project"
    echo ""
    echo "Example:"
    echo "  ./quick-test.sh /Users/kivancbilen/kivanc/FactoryGame"
    exit 1
fi

TEST_DIR="$1"
cd "$TEST_DIR"

echo "🧪 Testing Docker Fix in: $TEST_DIR"
echo "=========================================="
echo ""

# Check if project has tests
if [ ! -d "__tests__" ] && [ ! -d "tests" ] && [ ! -d "test" ]; then
    echo "❌ No test directory found (__tests__, tests, or test)"
    exit 1
fi

# Link jest-test-lineage-reporter
echo "📦 Linking jest-test-lineage-reporter..."
npm link jest-test-lineage-reporter 2>&1 | grep -v "npm WARN" || true

# Verify link
if [ -L "node_modules/jest-test-lineage-reporter" ]; then
    echo "✅ Package linked successfully"
    ls -la node_modules/jest-test-lineage-reporter
else
    echo "❌ Failed to link package"
    exit 1
fi

# Check for Jest config
if [ ! -f "jest.config.js" ] && [ ! -f "jest.config.ts" ]; then
    echo "⚠️  No jest.config.js found - you may need to configure it manually"
fi

echo ""
echo "📋 Next steps:"
echo "  1. Make sure jest.config.js includes:"
echo "     setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js']"
echo ""
echo "  2. Run tests to generate lineage data:"
echo "     npx jest --no-coverage"
echo ""
echo "  3. Test Workers mode:"
echo "     npx jest-lineage mutate --workers 2 --timeout 10000"
echo ""
echo "  4. Test Docker mode:"
echo "     npx jest-lineage mutate --docker --docker-workers 2 --timeout 10000"
echo ""
echo "  5. Compare results:"
echo "     diff <(jq .mutationScore .jest-lineage-mutation-results-workers.json) <(jq .mutationScore .jest-lineage-mutation-results.json)"
echo ""
echo "✅ Setup complete! Follow the steps above to test."
