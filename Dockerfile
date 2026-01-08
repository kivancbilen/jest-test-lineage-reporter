# Multi-stage build for optimized mutation testing worker
FROM node:18-alpine AS base

# Install dependencies for building native modules if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for mutation testing)
RUN npm ci && \
    npm cache clean --force

# Copy source files
COPY src/ ./src/
COPY babel.config.js ./

# Create a minimal worker image
FROM node:18-alpine AS worker

# Install minimal runtime dependencies
RUN apk add --no-cache tini

WORKDIR /app

# Copy from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/src ./src
COPY --from=base /app/babel.config.js ./babel.config.js
COPY --from=base /app/package.json ./package.json

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for test results
RUN mkdir -p /app/results

# Use custom entrypoint with tini
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Run mutation worker
CMD ["node", "src/docker/MutationWorker.js"]
