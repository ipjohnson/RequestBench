# Built from the framework's directory alone. The function is built on the Lambda base image it runs
# on, so it links against the glibc that image ships, which is older than the rust images' glibc.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10 AS build
RUN dnf install -y gcc && dnf clean all
# The toolchain the rust images in container-h1/ and container-h2/ carry.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.98.1
ENV PATH=/root/.cargo/bin:$PATH
WORKDIR /src

COPY Cargo.toml Cargo.lock askama.toml ./
COPY Implementation/ Implementation/
COPY lambda-emulator/ lambda-emulator/

# --locked, so the binary is built from the versions Cargo.lock records and /__meta reports.
# Without it a rebuild months later can resolve something newer.
RUN cargo build --release --locked --bin lambda --features lambda-emulator

# The base image's entrypoint execs /var/runtime/bootstrap. It refuses to start without one argument,
# the handler, which lambda-web does not read.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10
COPY --from=build /src/target/release/lambda /var/runtime/bootstrap
CMD ["rb"]
