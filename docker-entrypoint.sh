#!/bin/sh
set -e

REPORTER_SRC="/jest-lineage-reporter"
SYMLINK_TARGET="/project/node_modules/jest-test-lineage-reporter"

# Validate that the reporter source is mounted
if [ ! -d "$REPORTER_SRC" ]; then
  echo "ERROR: Reporter not mounted at $REPORTER_SRC" >&2
  exit 1
fi

# Validate that the project directory exists
if [ ! -d "/project" ]; then
  echo "ERROR: Project not mounted at /project" >&2
  exit 1
fi

# Create node_modules directory in project if it doesn't exist
mkdir -p /project/node_modules

# Remove only the specific symlink/directory for the reporter (not all of node_modules)
if [ -e "$SYMLINK_TARGET" ] || [ -L "$SYMLINK_TARGET" ]; then
  rm -rf "$SYMLINK_TARGET"
fi

# Create symlink to the mounted reporter
ln -sf "$REPORTER_SRC" "$SYMLINK_TARGET"

# Execute the command passed to docker run
exec "$@"
