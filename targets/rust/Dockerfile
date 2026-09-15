# Build context is the repo root so spec/fixture.json can be baked in.
#   docker build -f targets/rust/Dockerfile --build-arg TARGET=axum -t rb/rust-axum .
#
# One workspace build per target rather than one for all of them: the image is what gets
# measured, and a shared build would put every framework's dependencies in every image.
ARG RUST_VERSION=1.98
FROM rust:${RUST_VERSION}-slim AS build
ARG TARGET
WORKDIR /src
COPY targets/rust/Cargo.toml targets/rust/Cargo.lock ./
COPY targets/rust/_shared ./_shared
COPY targets/rust/_hosts ./_hosts
COPY targets/rust/${TARGET} ./${TARGET}
# --locked so the image is built from the versions the lockfile records and /__meta
# reports. Without it a rebuild months later can resolve something newer and the recorded
# version stops describing the binary.
RUN cargo build --release --locked --bin rb-${TARGET} -p rb-${TARGET} \
 && cp target/release/rb-${TARGET} /server

FROM debian:trixie-slim
COPY --from=build /server /server
COPY spec/fixture.json /app/spec/fixture.json
ENV RB_FIXTURE=/app/spec/fixture.json PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
