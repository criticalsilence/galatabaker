# --- builder ---
FROM node:22-alpine AS builder
WORKDIR /app
# workspace deps (root + workspaces)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/indexer/package.json ./apps/indexer/
COPY packages/sdk/package.json ./packages/sdk/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/api ./apps/api
COPY apps/indexer ./apps/indexer
COPY packages ./packages
RUN pnpm --filter @galatabaker/indexer build

# --- runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/indexer/dist ./dist
COPY --from=builder /app/apps/indexer/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
USER node
CMD ["node", "dist/index.js"]
