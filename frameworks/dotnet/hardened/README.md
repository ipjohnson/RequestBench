# Hardened

Hardened 0.39.0-rc1000 on .NET 10, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

Hardened's source generators write the routing table, the parameter binding, the validation and the
service registration during the build. The application is laid out as Hardened's `hardened-web`
template lays one out: a library that holds the routes, and a host project that imports it under
the host's attribute and starts it. Each host's directory here holds one such project.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The library. `ImplementationLibrary` is its module, and `Routes/` holds one controller per corpus family. |
| `container-h1/` | The project that starts the library on Hardened's Kestrel host, which runs no ASP.NET Core pipeline, over HTTP/1.1, and the `Dockerfile` that builds its image. |
| `container-h2/` | The same over HTTP/2 alone, which is how Kestrel answers HTTP/2 with prior knowledge. |
| `lambda-emulator/` | The project that starts the library on Hardened's Lambda host, and the `Dockerfile` that compiles it with Native AOT on AWS's `sam/build-dotnet10` image, as the `bootstrap` of the `provided:al2023` Lambda base image. |
| `UnitTests/` | xUnit v3 tests under Hardened's `[HardenedTest]`, which builds the library module for each test and sends its requests through the pipeline, or through Kestrel on a loopback port. |
| `Client/` | The OpenAPI document Hardened's build writes, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads Hardened's error bodies. |
| `solution.slnx` | All six projects. |
| `Directory.Packages.props` | Each package's version, for every project. |
| `.config/dotnet-tools.json` | Kiota, as a local tool, which the Client project runs. |
| `global.json` | SDK 10, rolling forward to the newest 10.0 feature band installed. |
| `nuget.config` | nuget.org and no other feed. |

## Building, running and testing

```sh
dotnet build solution.slnx -c Release
RB_PAYLOADS=../../../tests/payloads PORT=8080 dotnet container-h1/bin/Release/net10.0/ContainerH1.dll
dotnet test UnitTests
```

`RB_PAYLOADS` names the payload directory. The library module reads it from Hardened's environment
and loads the payloads while the modules are applied, before the server starts. `PORT` defaults to
8080. Each project restores against its committed `packages.lock.json`, at the versions
`Directory.Packages.props` sets.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and `[Produces("text/plain")]` writes it unchanged. | Hardened |
| json | The handler returns the payload, and Hardened's serializers write it from a source-generated `JsonSerializerContext` registered as an `IJsonTypeInfoResolver`. | Hardened |
| middleware | `[Layers]`, a filter attribute of the application's own, puts no-op filters on the route. | Hardened |
| parameters, query, headers | Handler parameters: path tokens by name, `[FromQueryString]` and `[FromHeader]`. query.many binds one model from its eight values. | Hardened |
| body | Constraint attributes on `ValidatedOrder`, which Hardened's validation generator compiles into a check that runs before the handler and answers 400 with every failure. `[ValidationMode]` stops the first-error route at the first. | Hardened |
| authorized | `[AuthorizeGrants]` on the route. `BearerTokenSource`, the application's principal source, gives the grant to a caller that presents settings.json's token. | Hardened, and a source by hand |
| cache | Hardened's response cache over the in-memory store `[HardenedMemoryResponseCache]` registers. The module puts its filter on the cache routes with the lifetime and the vary headers settings.json gives. | Hardened |
| compressed | `[Compress]` on the two routes, gzip at its fastest level. | Hardened |
| etag | `[ConditionalGet]` on the two routes hashes the answer with SHA-256 into `ETag` and answers a matching `If-None-Match` with 304. | Hardened |
| template | A RazorBlade view that `[Output<T>]` names. | Hardened |
| items | One route per method. The GET route answers HEAD. | Hardened |
| errors | The routing table's 404 and 405, the binder's 400 and the handler's `NotFound`. | Hardened |
| cors | `[Cors<Shop>]` on the route, with the policy the module registers from settings.json. | Hardened |
| forms | `[FromForm]`: query.many's model from the urlencoded fields, and two fields and an `IFormFile` from the multipart body. | Hardened |
| stream | The handler returns `IAsyncEnumerable<Item>`, which Hardened writes as NDJSON, flushing each line. | Hardened |
| sse | The same handler with `[ServerSentEvents]`, which frames each item as one event. | Hardened |
| static | `Hardened.Web.StaticContent` over the payload directory, answered under `/static` by `UnderStatic`. | Hardened, and a source by hand |

## Notes

- A principal source runs on every request, before routing, so every request pays a read of the
  `Authorization` header. Only `/authorized/small` requires a caller.
- Hardened's static content mount answers at the application's root, and its directory source takes
  no route prefix. The build-time manifest takes one, but it reads its directory at build time. So
  `UnderStatic`, an `IStaticContentSource`, hands the directory source the path below `/static` and
  declines every other path.
  [Hardened.Framework issue 398](https://github.com/ipjohnson/Hardened.Framework/issues/398) asks
  for a run-time prefix.
- The static content source compresses a text file over 1,000 bytes once, with gzip at
  `CompressionLevel.SmallestSize`, keeps it, and sends it to each request that accepts gzip.
- `[CacheResponse<T>]` takes its lifetime and its header names as attribute constants. So the module
  puts the same filter on the cache routes with `AddGlobalFilter`, with the lifetime and the vary
  headers settings.json gives, and the routes carry no attribute.
  [Hardened.Framework issue 399](https://github.com/ipjohnson/Hardened.Framework/issues/399) asks
  for a way to state them on the route.
- settings.json sizes the cache in entries, and Hardened's in-memory store is sized in bytes. Its
  default of 100 MB holds every key the cache family stores.
- The bind routes take `OrderRequest`, which declares no constraint, and the validate routes take
  `ValidatedOrder`. Hardened checks a body against every constraint its type declares, and has no
  setting that turns the check off on one route.
  [Hardened.Framework issue 401](https://github.com/ipjohnson/Hardened.Framework/issues/401) asks
  for one.
- The bind and validate handlers bind `Content-Length` with `[FromHeader]` to answer the bytes they
  received. A request that sends none is refused with 400.
- Hardened sends every answer whose length it does not know chunked, JSON answers included.
- Every answer carries `X-Correlation-Id`, which Hardened adds.
- Hardened's environment is `development` unless `HARDENED_ENVIRONMENT` names another, and in
  `development` the static content source reads the file again for every request. The images set
  `production`.
- Hardened's assemblies carry the version 1.0.0. So `/__meta` reports the `HardenedVersion` that
  `Directory.Packages.props` pins, which `Implementation.csproj` stamps into the assembly as
  metadata. Every restore is locked to that version.
  [Hardened.Framework issue 397](https://github.com/ipjohnson/Hardened.Framework/issues/397)
  reports it.
- Hardened's source generator packages name `Microsoft.CodeAnalysis.CSharp` as a dependency, so
  Roslyn's assemblies are copied into the container hosts' output. Nothing loads them.
  [Hardened.Framework issue 396](https://github.com/ipjohnson/Hardened.Framework/issues/396)
  reports it.
- On lambda-emulator the application answers behind Hardened's own adapter for API Gateway payload
  format 2.0, `Hardened.Aws.Lambda.Http`, whose invocation loop runs on
  `Amazon.Lambda.RuntimeSupport`. The application module there names `[LambdaHttpModule]` in place
  of `[KestrelRuntime]`, and no Kestrel runs.
- The Lambda host answers buffered unless `HARDENED_LAMBDA_RESPONSE_MODE` is `stream`, so the sse
  and stream tests are listed as unsupported there.
- lambda-emulator runs a Native AOT build, as the function's `bootstrap` on the `provided:al2023`
  base image. The container hosts keep the JIT runtime. `[AotSerializerModule]` makes the
  serializers read only the registered resolvers, and `/__meta` adds `Native AOT` to the runtime.
- The native build is compiled on AWS's `sam/build-dotnet10` image, which is Amazon Linux 2023 like
  the base image, so the executable links against the glibc 2.34 the function runs on. Its own SDK
  asks for the ILCompiler packages at 10.0.11, where the lock file records 10.0.12, so the
  Dockerfile copies in the SDK the container hosts build with.
- On lambda-emulator `/__meta` reports no `bootMs`. Hardened's Lambda bootstrap runs the startup
  services and then the invocation loop in one call, and no server listens.
- container-h2 answers HEAD with no body, as container-h1 does. Hardened drops the body a GET
  handler writes for HEAD before Kestrel sees it.

## Refusals

Every refusal is Hardened's own. Nothing reshapes it. `order.invalid` binds and breaks every rule,
so the validation check refuses it with 400 and a `ValidationError` listing each failed rule under
`errors`. Each field is the body parameter's name, a dot and the member, such as
`order.customerId`. The first-error route lists one. A body that does not parse gets the same 400,
with one entry naming the body parameter, `order`, with the code `invalid`. The routing table's 404
and 405 have no body. A handler's `NotFound` is Hardened's problem body, and a refused token is an
`AuthorizationException` with 403.

## Client

`Client/` holds the OpenAPI document Hardened's build writes about the library's routes and a C#
client generated from it.

- Hardened's web generator writes the document into Implementation's assembly, because the module
  carries `[Enable<OpenApiDocumentPublishing>]`. `HardenedOpenApiOutput` in `Implementation.csproj`
  reads it out to `Client/openapi.json` after each compile, where `Client/` is there. An image's
  build copies no `Client/`, so it writes none. The document is OpenAPI 3.2.
- `Client.csproj` builds after Implementation. When `openapi.json` is newer than
  `Kiota/kiota-lock.json`, it runs Kiota 1.35.0 from `.config/dotnet-tools.json` and compiles what
  Kiota wrote. Kiota is the generator the `hardened-web` template's client project runs.
- `dotnet build Client` does both. `npm run rb -- client dotnet:hardened` runs it and fails if
  anything under `Client/` changed.
- `UnitTests/ClientTests.cs` takes the client as a test parameter, which `[assembly: KiotaTesting]`
  builds over the pipeline.

What the document leaves out:

- The CORS preflight and `/static` are answered before routing, so no route describes them.
