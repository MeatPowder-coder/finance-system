FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @finance-system/api build

EXPOSE 4100
CMD ["pnpm", "--filter", "@finance-system/api", "start"]
