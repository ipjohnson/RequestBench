# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ and the client in Client/ are never copied in.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:35d40304542c8689331f8cab17c65926cdf48fe711e289321d71924b230a7d29 AS build
WORKDIR /src

# The settings first, on their own layer: they pin the SDK, the framework and the feed, and
# change far less often than the code.
COPY global.json nuget.config Directory.Build.props ./
# The whole project before the restore, not only the project file: the SDK adds an implicit
# package for the Razor components only when it sees them, and packages.lock.json records it.
# Internal/Generated comes with it, so the image compiles the committed Wolverine handlers.
COPY Implementation/ Implementation/

# --locked-mode, so the image is built from the versions packages.lock.json records and
# /__meta reports. Without it a rebuild months later can resolve something newer.
# The project file by name: given the folder, .NET 10 counts each .cs file in it as a
# file-based app and refuses to choose.
RUN dotnet restore Implementation/Implementation.csproj --locked-mode
RUN dotnet publish Implementation/Implementation.csproj -c Release --no-restore -o /out

# The base image's entrypoint execs /var/runtime/bootstrap. It refuses to start without one argument,
# the handler, which for an executable assembly is the assembly's name in LAMBDA_TASK_ROOT. The
# runtime client sets the GC's heap limit from AWS_LAMBDA_FUNCTION_MEMORY_SIZE, as on Lambda, so the
# image sets no GC variables.
FROM public.ecr.aws/lambda/dotnet:10@sha256:55ac117f188c23c17f0002d87fe697c3c1081200bb84231155805ab48fa0ea0f
COPY --from=build /out ${LAMBDA_TASK_ROOT}
CMD ["Implementation"]
