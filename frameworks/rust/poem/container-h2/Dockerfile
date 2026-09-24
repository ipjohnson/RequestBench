# Built from the framework's directory alone. cargo builds the server binary and nothing else, and only that
# binary reaches the final image, so the suite in UnitTests/ never does.
FROM rust:1.98.1-slim-trixie@sha256:f47a8de237dcbb0b0ce1099901e60a89728e3d51f24e664b40e947171538ade7 AS build
WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY Implementation/ Implementation/
COPY container-h2/ container-h2/

# --locked, so the binary is built from the versions Cargo.lock records and /__meta reports.
# Without it a rebuild months later can resolve something newer.
RUN cargo build --release --locked --bin server-h2

# The Debian release the compiler image is built on, so the binary finds the glibc it was linked
# against.
FROM debian:trixie-slim@sha256:a99cfc517144bc59b1978475ec53b46ecabec7e43635402ee5b77cc54cd1b20a
COPY --from=build /src/target/release/server-h2 /server
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
