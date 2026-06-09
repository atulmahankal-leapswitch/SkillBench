# Frontend image (Next.js App Router). Multi-stage: dev (next dev) and prod.
# Build context is ./frontend (see compose.yml).
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies first for caching.
COPY package.json package-lock.json* ./
RUN npm install

# ── Development: source bind-mounted by compose, run next dev ────────────────
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Build stage for production ───────────────────────────────────────────────
FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

# ── Production runtime ───────────────────────────────────────────────────────
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
