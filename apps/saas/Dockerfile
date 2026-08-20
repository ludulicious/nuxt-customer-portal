FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV PNPM_VERSION=10.19.0
RUN npm i -g pnpm@$PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nuxt-customer-portal/saas build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app/apps/saas

COPY apps/saas/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
