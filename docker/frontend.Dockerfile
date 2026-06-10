# Frontend image (Next.js App Router, pnpm). Multi-stage: dev + prod.
# Build context is ./frontend (see compose.yml).
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
# pnpm via Corepack (bundled with Node).
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies first for caching. --config.minimumReleaseAge=0 disables
# pnpm 11's "package too recently published" gate (we track the latest Next).
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
# pnpm-workspace.yaml provides minimumReleaseAge + allowBuilds. Low network
# concurrency + retries avoid flaky DNS (EAI_AGAIN) in BuildKit.
RUN pnpm install --frozen-lockfile \
    --network-concurrency=2 --fetch-retries=5 --fetch-retry-mintimeout=2000

# ── Development: source bind-mounted by compose, run next dev ────────────────
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "dev"]

# ── Build stage for production ───────────────────────────────────────────────
FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm build

# ── Production runtime ───────────────────────────────────────────────────────
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["pnpm", "start"]
