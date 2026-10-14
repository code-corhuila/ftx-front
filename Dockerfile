# Production image of the frontend (qa/prod). Proposal for open decision 2 of
# 10-devops/environments.md: Vite build served by nginx.
#
# VITE_* values are embedded at build time, so one image is built per environment:
#   docker build --build-arg VITE_API_BASE_URL=http://localhost:8180 -t ftx-front:qa .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8080
ARG VITE_API_MOCK=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_MOCK=$VITE_API_MOCK
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
