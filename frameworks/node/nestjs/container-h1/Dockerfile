# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
FROM node:26-alpine@sha256:dbaa92e5758cbbcf85d65d5403fdb530fe3442cbe8c6dbfb7ef23365450d5070 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Nest's classes are written with decorators, which Node's type stripping does not run, so nest build
# compiles the application with tsc and copies the Handlebars view beside it, as Nest's CLI builds
# a project.
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY Implementation/ Implementation/
COPY container-h1/ container-h1/
RUN npx nest build

FROM node:26-alpine@sha256:dbaa92e5758cbbcf85d65d5403fdb530fe3442cbe8c6dbfb7ef23365450d5070
WORKDIR /app

# The manifests first, on their own layer: they change far less often than the code. npm ci
# installs exactly what package-lock.json records, which is what /__meta reports, and --omit=dev
# leaves out the Nest CLI and TypeScript, which only build it.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist/ dist/

# Express keeps each compiled view only when NODE_ENV is production.
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "dist/container-h1/main.js"]
