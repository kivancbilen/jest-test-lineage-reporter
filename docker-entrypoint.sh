#!/bin/sh
set -e

# Create node_modules directory in project if it doesn't exist
mkdir -p /project/node_modules

# Remove existing jest-test-lineage-reporter if present (ignore errors if it doesn't exist)
rm -rf /project/node_modules/jest-test-lineage-reporter 2>/dev/null || true

# Create symlink to the mounted reporter (force overwrite if exists)
ln -sf /jest-lineage-reporter /project/node_modules/jest-test-lineage-reporter

# Execute the command passed to docker run
exec "$@"
