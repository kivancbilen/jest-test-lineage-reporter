#!/bin/bash

# Script to prepare the package for NPM publishing

echo "📦 Preparing Jest Test Lineage Reporter for NPM publishing..."

# Check if we're in the right directory
if [ ! -f "src/TestCoverageReporter.js" ]; then
    echo "❌ Error: Please run this script from the jest-test-lineage-reporter directory"
    exit 1
fi

# Clean up development files that shouldn't be published
echo "🧹 Cleaning up development files..."

# Remove test files and development artifacts
rm -rf coverage/
rm -rf node_modules/
rm -f test-lineage-report.html

# Create a clean package structure
echo "📁 Creating clean package structure..."

# Ensure only necessary files are included
echo "📝 Updating package.json files array..."

# The files array in package.json already specifies what to include:
# - src/TestCoverageReporter.js
# - README.md

echo "✅ Package structure ready!"
echo ""
echo "📋 Files that will be published:"
echo "  ✓ src/TestCoverageReporter.js (main reporter)"
echo "  ✓ README.md (documentation)"
echo "  ✓ package.json (package metadata)"
echo ""
echo "🚀 To publish to NPM:"
echo "1. Make sure you're logged in: npm login"
echo "2. Test the package: npm pack"
echo "3. Publish: npm publish"
echo ""
echo "💡 Tips:"
echo "- Update version in package.json before publishing"
echo "- Consider publishing as scoped package: @yourusername/jest-test-lineage-reporter"
echo "- Test in a separate project before publishing"
echo ""
echo "📚 For usage instructions, users should refer to USAGE_GUIDE.md"
