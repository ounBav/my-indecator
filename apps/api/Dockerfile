FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace @market-desk/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
