#   docker build -f targets/node/Dockerfile --build-arg TARGET=fastify -t rb/node-fastify .
FROM node:24-alpine
ARG TARGET=baseline
WORKDIR /app
COPY targets/node/package.json targets/node/package-lock.json ./targets/node/
RUN cd targets/node && npm ci --omit=dev --no-audit --no-fund
COPY targets/node/_shared ./targets/node/_shared
COPY targets/node/${TARGET} ./targets/node/app
COPY spec/fixture.json ./spec/fixture.json
ENV PORT=8080
EXPOSE 8080
CMD ["node", "targets/node/app/server.js"]
