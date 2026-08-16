FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install pnpm and build tools for native modules
ENV PNPM_VERSION=10.26.1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm i -g pnpm@$PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++

# Install exactly the dependency graph committed in the lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Rebuild native modules for the target platform
RUN pnpm rebuild

RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl wget \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.output ./.output

# Copy and set up entrypoint script
COPY entrypoint.sh .
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:3000/api/health || exit 1

# Set the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command passed to the entrypoint
CMD ["node", ".output/server/index.mjs"]
