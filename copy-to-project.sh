#!/bin/bash

# Script to copy Jest Test Lineage Reporter to another project
# Usage: ./copy-to-project.sh /path/to/your/project

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the path to your target project"
    echo "Usage: ./copy-to-project.sh /path/to/your/project"
    exit 1
fi

TARGET_PROJECT="$1"

if [ ! -d "$TARGET_PROJECT" ]; then
    echo "❌ Error: Target project directory does not exist: $TARGET_PROJECT"
    exit 1
fi

echo "📦 Copying Jest Test Lineage Reporter to: $TARGET_PROJECT"

# Create reporters directory if it doesn't exist
mkdir -p "$TARGET_PROJECT/reporters"

# Copy the main reporter file
cp "src/TestCoverageReporter.js" "$TARGET_PROJECT/reporters/"

echo "✅ Reporter copied to: $TARGET_PROJECT/reporters/TestCoverageReporter.js"

# Check if jest.config.js exists
if [ -f "$TARGET_PROJECT/jest.config.js" ]; then
    echo "⚠️  jest.config.js already exists in target project"
    echo "📝 You need to manually add the reporter to your Jest configuration:"
    echo ""
    echo "reporters: ["
    echo "  'default',"
    echo "  './reporters/TestCoverageReporter.js'"
    echo "],"
    echo "collectCoverage: true,"
    echo ""
else
    echo "📝 Creating example jest.config.js..."
    cp "example-usage/jest.config.js" "$TARGET_PROJECT/"
    # Update the reporter path to use local file
    sed -i.bak "s/'jest-test-lineage-reporter'/'\.\/reporters\/TestCoverageReporter\.js'/g" "$TARGET_PROJECT/jest.config.js"
    rm "$TARGET_PROJECT/jest.config.js.bak" 2>/dev/null || true
    echo "✅ Created jest.config.js with reporter configuration"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Navigate to your project: cd $TARGET_PROJECT"
echo "2. Run your tests: npm test"
echo "3. Open test-lineage-report.html in your browser"
echo ""
echo "📚 For more configuration options, see USAGE_GUIDE.md"
