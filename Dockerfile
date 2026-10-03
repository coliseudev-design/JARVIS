FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/policy/package.json packages/policy/package.json
# Optional enterprise/cloud CA is ephemeral and never copied into the image.
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node infra/migrations ./infra/migrations
COPY --chown=node:node scripts/serve-web.mjs ./scripts/serve-web.mjs
COPY --chown=node:node scripts/container-smoke.mjs ./scripts/container-smoke.mjs
COPY --chown=node:node scripts/bootstrap-operator.mjs ./scripts/bootstrap-operator.mjs
RUN mkdir -p /app/.private/mailbox && chown -R node:node /app/.private
USER node
CMD ["node", "apps/api/dist/server.js"]
