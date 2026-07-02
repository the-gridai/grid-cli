# =============================================================================
# Grid CLI - Production Dockerfile
# Multi-stage build for minimal image size
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/
COPY bin/ ./bin/
COPY strategies/ ./strategies/
COPY scripts/postbuild.cjs ./scripts/postbuild.cjs

# Build TypeScript
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="grid-cli"
LABEL org.opencontainers.image.description="GRID Exchange CLI - Trading Automation"
LABEL org.opencontainers.image.vendor="The Grid"

# Build-time arguments for versioning
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

# Create non-root user for security
RUN addgroup -g 1001 -S gridcli && \
    adduser -u 1001 -S gridcli -G gridcli

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Create logs and data directories
RUN mkdir -p /app/logs /app/data && chown -R gridcli:gridcli /app

# Switch to non-root user
USER gridcli

# Environment defaults (override at runtime)
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV HEALTH_PORT=8080

# Expose health check port
EXPOSE 8080

# Health check using the daemon's health endpoint
# Uses liveness endpoint - returns 200 even in standby mode (pod is alive)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Default command: run the daemon (handles standby mode gracefully)
# The daemon will:
# - Start health endpoints immediately (pod stays alive)
# - Wait for credentials if not configured (standby mode)
# - Start the strategy once credentials are available
ENTRYPOINT ["node", "dist/src/daemon/index.js"]

# Configuration via environment variables:
# - CONFIG_PATH: /app/config/strategy.json (mount via ConfigMap)
# - HEALTH_PORT: 8080
# - SIGNING_KEY, SIGNING_KEY_FINGERPRINT: Auth credentials (from Secret)
# - API_URL, WS_URL: Exchange endpoints
#
# Alternative commands:
# CLI mode: docker run grid-cli node dist/src/cli/index.js <command>
# Direct strategy: docker run grid-cli node dist/strategies/<name>/index.js
