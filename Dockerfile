# Multi-stage Next.js runtime. Only traced server files, static assets and
# public files enter the runtime image (not npm cache, source, tests or tooling).
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

# Railway already runs "npm run start" as the service start command. Keep
# that contract while using the traced standalone server, not "next start".
RUN node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.scripts={...p.scripts,start:"node server.js"};fs.writeFileSync("package.json",JSON.stringify(p))'
USER node
EXPOSE 3000
CMD ["npm","run","start"]
