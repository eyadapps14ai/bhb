FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    VINEXT_TRUST_PROXY=1
COPY --from=build --chown=node:node /app/dist/standalone ./
USER node
EXPOSE 8080
CMD ["node", "server.js"]
