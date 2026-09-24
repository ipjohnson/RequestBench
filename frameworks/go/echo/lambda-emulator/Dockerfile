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
COPY lambda-emulator/ lambda-emulator/
# CGO off, so the binary links no C library and runs on the base image whatever its glibc. The
# lambda.norpc tag leaves out the RPC mode of the retired go1.x runtime, as AWS builds a Go function
# for provided.al2023.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -tags lambda.norpc -o /out/bootstrap ./lambda-emulator

# The base image's entrypoint execs /var/runtime/bootstrap. It refuses to start without one argument,
# the handler, which aws-lambda-go does not read.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10
COPY --from=build /out/bootstrap /var/runtime/bootstrap
CMD ["rb"]
