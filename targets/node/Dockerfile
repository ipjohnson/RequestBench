#   docker build -f targets/node/Dockerfile --build-arg TARGET=fastify -t rb/node-fastify .
FROM node:26-alpine
ARG TARGET
WORKDIR /app
COPY targets/node/package.json targets/node/package-lock.json ./targets/node/
RUN cd targets/node && npm ci --omit=dev --no-audit --no-fund
COPY targets/node/_shared ./targets/node/_shared
COPY targets/node/_hosts ./targets/node/_hosts
COPY targets/node/${TARGET} ./targets/node/app
COPY spec/fixture.json ./spec/fixture.json
# Whatever the target is called, it is copied to app/, so one entrypoint covers them all.
ENV PORT=8080 RB_TARGET=app RB_FIXTURE=/app/spec/fixture.json
# Express caches views, pug compiles without its debug instrumentation and @fastify/view
# caches templates only when NODE_ENV is production.
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "targets/node/_hosts/container.mjs"]
