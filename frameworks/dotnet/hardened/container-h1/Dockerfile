# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ and the client in Client/ are never copied in, and neither is another host's project.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:35d40304542c8689331f8cab17c65926cdf48fe711e289321d71924b230a7d29 AS build
WORKDIR /src

# The settings first, on their own layer: they pin the SDK, the package versions and the feed, and
# change far less often than the code.
COPY global.json nuget.config Directory.Build.props Directory.Packages.props ./
COPY Implementation/ Implementation/
COPY container-h1/ container-h1/

# --locked-mode, so the image is built from the versions the packages.lock.json files record and
# /__meta reports. Without it a rebuild months later can resolve something newer.
RUN dotnet restore container-h1/ContainerH1.csproj --locked-mode
RUN dotnet publish container-h1/ContainerH1.csproj -c Release --no-restore -o /out

# Hardened's Kestrel host runs on the ASP.NET Core shared framework, which this image carries.
FROM mcr.microsoft.com/dotnet/aspnet:10.0@sha256:2d584d8147faddb0d678c5748d47953e5b8e18621ed4fb7049a91381d9d7746f
COPY --from=build /out /app
# Server GC with DATAS off, as upstream measured every .NET framework. DATAS starts with one
# heap and adds heaps only after a few collections under a heavier load, and every rung of the
# ladder is heavier than the one before. HARDENED_ENVIRONMENT names Hardened's environment, which is
# development when unset, and in development the static content mount reads every file afresh.
ENV PORT=8080 DOTNET_gcServer=1 DOTNET_GCDynamicAdaptationMode=0 HARDENED_ENVIRONMENT=production
EXPOSE 8080
WORKDIR /app
ENTRYPOINT ["dotnet", "ContainerH1.dll"]
