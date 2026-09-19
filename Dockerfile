FROM node:20-slim AS build
WORKDIR /app
# playwright is a dev dependency and its postinstall pulls a browser. Nothing in
# the image runs a browser, and 150MB per deploy is a real cost.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:web

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
EXPOSE 2567
CMD ["node", "src/server/index.js"]
