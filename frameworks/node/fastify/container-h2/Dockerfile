# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
FROM node:26-alpine@sha256:dbaa92e5758cbbcf85d65d5403fdb530fe3442cbe8c6dbfb7ef23365450d5070
WORKDIR /app

# The manifests first, on their own layer: they change far less often than the code. npm ci
# installs exactly what package-lock.json records, which is what /__meta reports, and --omit=dev
# leaves out TypeScript, which only checks the source.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Node strips the types as it loads the source, so there is no build step.
COPY Implementation/ Implementation/
COPY container-h2/ container-h2/

# @fastify/view keeps each compiled template only when NODE_ENV is production.
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "container-h2/server.ts"]
