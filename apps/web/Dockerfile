FROM node:22-slim AS build
WORKDIR /workspace
COPY . .
RUN npm ci
RUN npm run build --workspace @market-desk/web

FROM nginx:1.27-alpine AS runtime
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
