# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in. Lambda's Node 26 runtime, the Node container-h1 runs, is still a
# preview, so the base image is its 26-preview tag.
FROM public.ecr.aws/lambda/nodejs:26-preview@sha256:6f5fc6d107010847c189d5ffe0777c0462bd1df69a3c48a018c4fc689006bf53
WORKDIR ${LAMBDA_TASK_ROOT}

# The manifests first, on their own layer: they change far less often than the code. npm ci
# installs exactly what package-lock.json records, which is what /__meta reports, and --omit=dev
# leaves out TypeScript, which only checks the source.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Node strips the types as it loads the source, so there is no build step. The view @koa/ejs
# renders is under Implementation/views.
COPY Implementation/ Implementation/
COPY lambda-emulator/ lambda-emulator/

ENV NODE_ENV=production

# The base image's entrypoint execs /var/runtime/bootstrap with its one argument as the handler:
# the export handler of lambda-emulator/handler.mjs, which the runtime finds under LAMBDA_TASK_ROOT.
CMD ["lambda-emulator/handler.handler"]
