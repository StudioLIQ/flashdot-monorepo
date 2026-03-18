FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install dependencies (monorepo-aware)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY coordinator/package.json coordinator/
COPY contracts/package.json contracts/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter @flashdot/coordinator...

# Build coordinator
COPY coordinator/ coordinator/
COPY tsconfig.base.json ./
RUN pnpm -C coordinator build

# Production image
FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/coordinator/node_modules ./coordinator/node_modules
COPY --from=base /app/coordinator/dist ./coordinator/dist
COPY --from=base /app/coordinator/src/db/migrations ./coordinator/src/db/migrations
COPY --from=base /app/coordinator/package.json ./coordinator/package.json

RUN mkdir -p /data

WORKDIR /app/coordinator
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "dist/index.js"]
