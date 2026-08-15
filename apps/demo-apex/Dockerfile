# Build this image from the repository root:
# docker build -f apps/demo-apex/Dockerfile .

# ---- Base Node ----
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS builder

# Install pnpm and build tools for native modules
ENV PNPM_VERSION=10.19.0
RUN npm i -g pnpm@$PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install the complete workspace so workspace:* dependencies resolve locally.
COPY . .

# Install exactly the dependency graph committed in the lockfile.
RUN pnpm install --frozen-lockfile

# Rebuild native modules for the target platform
RUN pnpm rebuild

RUN pnpm --filter @nuxt-customer-portal/demo-apex build
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# The filtered Nuxt build and portal CLI both run from the demo package.
WORKDIR /app/apps/demo-apex

# Copy and set up entrypoint script
COPY apps/demo-apex/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

# Set the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command passed to the entrypoint
CMD ["node", ".output/server/index.mjs"]
