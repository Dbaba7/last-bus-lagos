FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
ARG VITE_SERVER_URL=
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=2567
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
