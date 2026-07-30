# ---- deps: resolve & install workspace dependencies (cached layer) ----
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/ packages/
COPY apps/ apps/

RUN bun install --frozen-lockfile

# ---- runtime: serve metascan-server directly from source ----
FROM oven/bun:1
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY package.json bun.lock ./
COPY packages/ ./packages/
COPY apps/ ./apps/

EXPOSE 3000
CMD ["bun", "run", "metascan-server"]