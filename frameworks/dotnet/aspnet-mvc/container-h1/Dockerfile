# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:35d40304542c8689331f8cab17c65926cdf48fe711e289321d71924b230a7d29 AS build
WORKDIR /src

# The settings first, on their own layer: they pin the SDK, the framework and the feed, and
# change far less often than the code.
COPY global.json nuget.config Directory.Build.props ./
# The project file and its lock file before the code, so a change to the code restores nothing.
COPY Implementation/Implementation.csproj Implementation/packages.lock.json Implementation/

# --locked-mode, so the image is built from the versions packages.lock.json records. Without it
# a rebuild months later can resolve something newer.
# The project file by name: given the folder, .NET 10 counts each .cs file in it as a
# file-based app and refuses to choose.
RUN dotnet restore Implementation/Implementation.csproj --locked-mode
COPY Implementation/ Implementation/
RUN dotnet publish Implementation/Implementation.csproj -c Release --no-restore -o /out

# MVC is part of the shared framework this image carries, so its digest pins the version
# /__meta reports.
FROM mcr.microsoft.com/dotnet/aspnet:10.0@sha256:2d584d8147faddb0d678c5748d47953e5b8e18621ed4fb7049a91381d9d7746f
COPY --from=build /out /app
# Server GC with DATAS off, as upstream measured every .NET framework. DATAS starts with one
# heap and adds heaps only after a few collections under a heavier load, and every rung of the
# ladder is heavier than the one before.
ENV PORT=8080 DOTNET_gcServer=1 DOTNET_GCDynamicAdaptationMode=0 ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
WORKDIR /app
ENTRYPOINT ["dotnet", "Implementation.dll"]
