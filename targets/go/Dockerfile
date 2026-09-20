# Build context is the repo root so spec/fixture.json can be baked in.
#   docker build -f targets/go/Dockerfile --build-arg TARGET=gin -t rb/go-gin .
ARG GO_VERSION=1.27
FROM golang:${GO_VERSION}-alpine AS build
ARG TARGET
WORKDIR /src
COPY targets/go/go.mod targets/go/go.sum ./
COPY targets/go/_shared ./_shared
COPY targets/go/_hosts ./_hosts
COPY targets/go/${TARGET} ./target
RUN go mod download
# gin selects its JSON codec with a build tag (gin docs/doc.md, "Build with json
# replacement"). No other target reads one.
RUN case "$TARGET" in gin) tags=sonic ;; *) tags= ;; esac && \
    CGO_ENABLED=0 go build -tags="$tags" -trimpath -ldflags="-s -w" -o /out/server ./target

FROM alpine:3.24
COPY --from=build /out/server /server
COPY spec/fixture.json /app/spec/fixture.json
ENV RB_FIXTURE=/app/spec/fixture.json PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
