FROM node:22-bookworm-slim AS base
WORKDIR /app
FROM base AS builder
ENV PNPM_VERSION=10.19.0
RUN npm i -g pnpm@$PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends curl python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm rebuild
RUN pnpm --filter @nuxt-customer-portal/saas-portal build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app/apps/saas-portal
COPY apps/saas-portal/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=5 CMD curl --fail --silent http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
