# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
FROM golang:1.27.1-alpine3.24@sha256:8a5910f31396cd4d89662f56c68b3ae31d374308270a1c3bd96672ee5ed43414 AS build
WORKDIR /src

# The module files first, on their own layer, so a change to the code does not download again.
# go mod download checks every module against go.sum, and go build refuses a go.mod it would have
# to change, so the image is built from the versions they record and /__meta reports.
COPY go.mod go.sum ./
RUN go mod download
COPY Implementation/ Implementation/
COPY container-h1/ container-h1/
# CGO off, so the binary links no C library and runs on a bare Alpine.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./container-h1

FROM alpine:3.24@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
COPY --from=build /out/server /server
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
