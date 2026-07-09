# API — multi-stage production build
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace packages/shared --workspace apps/api
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w packages/shared \
 && npm run db:generate -w apps/api \
 && npm run build -w apps/api

FROM node:22-slim
ENV NODE_ENV=production
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/
WORKDIR /repo/apps/api
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD curl -sf http://localhost:3001/api/v1/health || exit 1
# apply migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
