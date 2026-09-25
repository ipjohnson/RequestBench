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
COPY lambda-emulator/ lambda-emulator/
RUN npx nest build

# Lambda's Node 26 runtime, the Node container-h1 runs, is still a preview, so the base image is its
# 26-preview tag.
FROM public.ecr.aws/lambda/nodejs:26-preview@sha256:6f5fc6d107010847c189d5ffe0777c0462bd1df69a3c48a018c4fc689006bf53
WORKDIR ${LAMBDA_TASK_ROOT}

# The manifests first, on their own layer: they change far less often than the code. npm ci
# installs exactly what package-lock.json records, which is what /__meta reports, and --omit=dev
# leaves out the Nest CLI and TypeScript, which only build it. package.json's "type" makes the
# runtime import the handler as an ES module.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist/ dist/

# Express keeps each compiled view only when NODE_ENV is production.
ENV NODE_ENV=production

# The base image's entrypoint execs /var/runtime/bootstrap with its one argument as the handler:
# the export handler of dist/lambda-emulator/handler.js, which the runtime finds under
# LAMBDA_TASK_ROOT.
CMD ["dist/lambda-emulator/handler.handler"]
