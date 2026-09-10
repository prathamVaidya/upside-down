# One image, one process: builds both clients and serves them alongside the
# socket. No database, no sidecar, no orchestration — a party game should be one
# `docker run` away from working.
FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/content/package.json packages/content/
COPY packages/engine/package.json packages/engine/
COPY packages/clay/package.json packages/clay/
COPY packages/net/package.json packages/net/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY tools/botgame/package.json tools/botgame/
RUN bun install --frozen-lockfile

COPY . .
# Public browser project token only. AXIOM_TOKEN must remain a runtime secret.
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
RUN bun run content:check && bun run build

FROM oven/bun:1.3-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/content ./content
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/package.json ./

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD bun -e "await fetch('http://localhost:3000/health')"

CMD ["bun", "apps/server/src/index.ts"]
