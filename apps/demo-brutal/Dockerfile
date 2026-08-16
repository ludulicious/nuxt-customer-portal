# Build this image from the repository root:
# docker build -f apps/demo-brutal/Dockerfile .

FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV PNPM_VERSION=10.19.0
RUN npm i -g pnpm@$PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends curl wget python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install the complete workspace so workspace:* dependencies resolve locally.
COPY . .
RUN pnpm install --frozen-lockfile

RUN pnpm rebuild
RUN pnpm --filter @nuxt-customer-portal/demo-brutal build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# The filtered Nuxt build and portal CLI both run from the demo package.
WORKDIR /app/apps/demo-brutal

COPY apps/demo-brutal/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
