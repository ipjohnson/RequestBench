# Build context is the repo root so spec/fixture.json can be baked in.
#   docker build -f targets/go/Dockerfile --build-arg TARGET=baseline -t rb/go-baseline .
ARG GO_VERSION=1.25
FROM golang:${GO_VERSION}-alpine AS build
ARG TARGET=baseline
WORKDIR /src
COPY targets/go/go.mod targets/go/go.sum ./
COPY targets/go/_shared ./_shared
COPY targets/go/${TARGET} ./target
RUN go mod download
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./target

FROM alpine:3.21
COPY --from=build /out/server /server
COPY spec/fixture.json /app/spec/fixture.json
ENV RB_FIXTURE=/app/spec/fixture.json PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
