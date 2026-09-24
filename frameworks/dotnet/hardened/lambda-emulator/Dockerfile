# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ and the client in Client/ are never copied in.
# The SDK the container hosts build with. The lock file records the ILCompiler packages at the
# version this SDK asks for, so a locked restore needs this SDK.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:35d40304542c8689331f8cab17c65926cdf48fe711e289321d71924b230a7d29 AS sdk

# AWS's Amazon Linux 2023 build image, so the executable links against the glibc 2.34 the function
# runs on. It carries clang and zlib-devel, which Native AOT compiles and links with. Its own SDK is
# 10.0.400, which asks for the ILCompiler packages at 10.0.11, so the SDK above takes its place.
FROM public.ecr.aws/sam/build-dotnet10@sha256:17ab49c617ca57baf50aa59c8e1bd5f7e084e502cb8630db8617a001f5269e7b AS build
COPY --from=sdk /usr/share/dotnet /usr/share/dotnet
ENV DOTNET_ROOT=/usr/share/dotnet PATH=/usr/share/dotnet:$PATH
WORKDIR /src

# The settings first, on their own layer: they pin the SDK, the package versions and the feed, and
# change far less often than the code.
COPY global.json nuget.config Directory.Build.props Directory.Packages.props ./
COPY Implementation/ Implementation/
COPY lambda-emulator/ lambda-emulator/

# --locked-mode, so the image is built from the versions the lock files record and /__meta reports.
# Every restore resolves the ILCompiler packages for linux-x64 and linux-arm64, as
# LambdaEmulator.csproj says.
RUN dotnet restore lambda-emulator/LambdaEmulator.csproj --locked-mode
# A Native AOT executable for the architecture the image is built for, amd64 or arm64, which -a
# turns into linux-x64 or linux-arm64. LambdaEmulator.csproj sets PublishAot.
ARG TARGETARCH
RUN dotnet publish lambda-emulator/LambdaEmulator.csproj -c Release --no-restore -a $TARGETARCH -o /out

# The base image's entrypoint execs /var/runtime/bootstrap. It refuses to start without one argument,
# the handler, which the executable does not read. The runtime client compiled into it sets the GC's
# heap limit from AWS_LAMBDA_FUNCTION_MEMORY_SIZE, as on Lambda, so the image sets no GC variables.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10
COPY --from=build /out/LambdaEmulator /var/runtime/bootstrap
ENV HARDENED_ENVIRONMENT=production
CMD ["rb"]
