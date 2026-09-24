# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
# The SDK the container hosts build with. packages.lock.json records the SDK's implicit packages at
# the versions this SDK writes, so a locked restore needs this SDK.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:35d40304542c8689331f8cab17c65926cdf48fe711e289321d71924b230a7d29 AS sdk

# AWS's Amazon Linux 2023 build image, so the executable links against the glibc 2.34 the function
# runs on. It carries clang and zlib-devel, which Native AOT compiles and links with. Its own SDK is
# 10.0.400, which writes the implicit packages at 10.0.11, so the SDK above takes its place.
FROM public.ecr.aws/sam/build-dotnet10@sha256:17ab49c617ca57baf50aa59c8e1bd5f7e084e502cb8630db8617a001f5269e7b AS build
COPY --from=sdk /usr/share/dotnet /usr/share/dotnet
ENV DOTNET_ROOT=/usr/share/dotnet PATH=/usr/share/dotnet:$PATH
WORKDIR /src

# The settings first, on their own layer: they pin the SDK, the framework and the feed, and
# change far less often than the code.
COPY global.json nuget.config Directory.Build.props ./
# The whole project before the restore, not only the project file: the SDK adds an implicit
# package for the Razor components only when it sees them, and packages.lock.json records it.
COPY Implementation/ Implementation/

# --locked-mode, so the image is built from the versions packages.lock.json records and
# /__meta reports. Without it a rebuild months later can resolve something newer. Every restore
# resolves the ILCompiler packages for linux-x64 and linux-arm64, as Implementation.csproj says.
# The project file by name: given the folder, .NET 10 counts each .cs file in it as a
# file-based app and refuses to choose.
RUN dotnet restore Implementation/Implementation.csproj --locked-mode
# A Native AOT executable for the architecture the image is built for, amd64 or arm64, which -a
# turns into linux-x64 or linux-arm64. ILC warns about the frameworks' own assemblies, such as
# ASP.NET Core's Razor components, so its warnings do not fail the build. The compiler's trimming
# and AOT warnings about the application's own code still do.
ARG TARGETARCH
RUN dotnet publish Implementation/Implementation.csproj -c Release --no-restore -a $TARGETARCH -p:PublishAot=true -p:IlcTreatWarningsAsErrors=false -o /out

# The base image's entrypoint execs /var/runtime/bootstrap. It refuses to start without one argument,
# the handler, which the executable does not read. The runtime client compiled into it sets the GC's
# heap limit from AWS_LAMBDA_FUNCTION_MEMORY_SIZE, as on Lambda, so the image sets no GC variables.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10
COPY --from=build /out/Implementation /var/runtime/bootstrap
CMD ["rb"]
