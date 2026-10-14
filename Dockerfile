FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package*.json ./
COPY vendor/*.tgz ./vendor/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS production-deps
COPY package*.json ./
COPY vendor/*.tgz ./vendor/
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/docs/documento-mestre.md ./docs/documento-mestre.md
USER node
EXPOSE 3000
CMD ["node", "server.js"]
