# Build context is the repo root so spec/fixture.json can be baked in.
#   docker build -f targets/dotnet/Dockerfile --build-arg TARGET=minimal-apis -t rb/dotnet-minimal-apis .
ARG DOTNET_VERSION=10.0
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
ARG TARGET
WORKDIR /src

# The shared settings first, on their own layer: they pin the framework, the package
# versions and the feed, and they change far less often than the code does.
COPY targets/dotnet/Directory.Build.props targets/dotnet/Directory.Packages.props ./
COPY targets/dotnet/nuget.config targets/dotnet/global.json ./
COPY targets/dotnet/_shared ./_shared
COPY targets/dotnet/_hosts ./_hosts
COPY targets/dotnet/${TARGET} ./target

# --locked-mode, so the image is built from the versions packages.lock.json records and
# /__meta reports. Without it a rebuild months later can resolve something newer and the
# recorded version stops describing the binary.
RUN dotnet restore target --locked-mode
RUN dotnet publish target -c Release --no-restore -o /out

FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION}
COPY --from=build /out /app
COPY spec/fixture.json /app/spec/fixture.json
ENV PORT=8080 RB_FIXTURE=/app/spec/fixture.json \
    DOTNET_gcServer=1 ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
WORKDIR /app
# The entry assembly is named after its framework rather than after the directory, so it is
# found the same way harness/run.py finds it: the one RequestBench assembly that is neither
# the shared domain nor the host module.
ENTRYPOINT ["/bin/sh", "-c", "exec dotnet $(ls RequestBench.*.dll | grep -v -e Domain -e Hosts | head -1)"]
