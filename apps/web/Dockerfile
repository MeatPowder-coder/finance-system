FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WEB_APP_URL
ARG API_PROXY_TARGET

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WEB_APP_URL=$NEXT_PUBLIC_WEB_APP_URL
ENV API_PROXY_TARGET=$API_PROXY_TARGET

COPY . .
RUN pnpm --filter @finance-system/web build

EXPOSE 3005
CMD ["pnpm", "--filter", "@finance-system/web", "start"]
