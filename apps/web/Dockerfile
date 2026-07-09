# Web — Next.js standalone production build
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace packages/shared --workspace apps/web
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w apps/web

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
EXPOSE 3000
ENV HOSTNAME=0.0.0.0 PORT=3000
CMD ["node", "apps/web/server.js"]
