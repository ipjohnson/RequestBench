# Hardened

Hardened 0.41.0-rc1000 on .NET 10, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

Hardened is a .NET framework for HTTP APIs and serverless functions. Its source generators write
the routing table, the parameter binders and the service registrations during the build, so nothing
is discovered by reflection at startup. Every family uses a feature of Hardened's own. The one piece
written by hand is the principal source that reads the bearer token, because Hardened ships none.

## Layout

The layout is the one Hardened's `hardened-web` template writes: a library that holds the
application, and a host project for each host.

| Path | What it is |
| --- | --- |
| `Implementation/` | The library. One controller per corpus family under `Controllers/`, and the module `ImplementationLibrary`, which each host imports. |
| `container-h1/` | The host project container-h1 runs, `[KestrelRuntime]` over the library, and its `Dockerfile`. |
| `container-h2/` | The same host with Kestrel's endpoint on HTTP/2 alone, which is how Kestrel answers HTTP/2 with prior knowledge, and its `Dockerfile`. |
| `lambda-emulator/` | The host project the function runs, `[LambdaHttpModule]` over the library, published as a Native AOT executable, and its `Dockerfile`. |
| `UnitTests/` | xunit.v3 tests under Hardened's `[ModuleTest]`, sent through the pipeline in process or over a Kestrel socket. |
| `Client/` | The OpenAPI document Hardened's build writes, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads Hardened's error bodies. |
| `solution.slnx` | Every project. |
| `Directory.Packages.props` | Every package version, in one list, as Hardened's templates keep them. |
| `.config/dotnet-tools.json` | Kiota, as a local tool, which the Client project runs. |
| `global.json` | SDK 10, rolling forward to the newest 10.0 feature band installed. |
| `nuget.config` | nuget.org and no other feed. |

## Building, running and testing

```sh
dotnet build solution.slnx -c Release
RB_PAYLOADS=$PWD/../../../tests/payloads PORT=8080 HARDENED_ENVIRONMENT=production dotnet container-h1/bin/Release/net10.0/ContainerH1.dll
dotnet test UnitTests
```

`RB_PAYLOADS` names the payload directory. `ImplementationLibrary` loads the payloads while the
application's services are registered, before the host starts. It reads the variable through
Hardened's environment, which reads the process's variables in a host and the values a test declares
in a test. `PORT` defaults to 8080. `HARDENED_ENVIRONMENT` names Hardened's environment, which is
`development` when it is unset. Each project restores against its committed `packages.lock.json`.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns a `string` under `[Produces("text/plain")]`, which Hardened writes unchanged. | Hardened |
| json | The handler returns the payload, and System.Text.Json writes it from the source-generated `JsonContext` the module registers as an `IJsonTypeInfoResolver`. | Hardened |
| middleware | `[Layers(n)]`, a filter attribute of the application's own, puts n no-op filters on the route. | Hardened's filter pipeline |
| parameters, query, headers | Path tokens bound by name, `[FromQueryString]` and `[FromHeader]`. query.many binds its eight values into one model. | Hardened |
| body | ValidationModules constraint attributes on the order, which ValidationModules.SourceGenerator compiles into a check that Hardened runs before the handler. The bind routes mark the order `[ValidateNever]`, and the first-error route declares `[ValidationMode(ValidationStopMode.StopOnFirstError)]`. | Hardened |
| authorized | `[Authorize<BearerAuth>]` and `[AuthorizeGrants]` on the route. `BearerTokenSource` reads the token and gives the grant to settings.json's token alone. | Hardened, and a principal source by hand |
| cache | `[CacheResponse<T>]`, put on the routes by `AddGlobalFilter` with settings.json's lifetime, over the store `[HardenedMemoryResponseCache]` registers. `VaryByHeader` keys the vary routes on their headers. | Hardened |
| compressed | `[Compress]` on the two routes, gzip at its fastest level. | Hardened |
| etag | `[ConditionalGet]` hashes the body with SHA-256 and answers 304 when `If-None-Match` names the hash. | Hardened |
| template | A RazorBlade view, `Views/ItemsPage.cshtml`, named by `[Output<T>]`. | Hardened, RazorBlade |
| items | One route per method. The GET route answers HEAD too. | Hardened |
| errors | The routing table's 404 and 405, the binder's 400 and the handler's `NotFound`. | Hardened |
| cors | `[Cors<Shop>]` on the route, with the policy `AddCorsPolicy<Shop>` registers from settings.json. | Hardened |
| forms | `[FromForm]` binds the urlencoded fields into the `Search` model, and the multipart fields and the `IFormFile` by name. | Hardened |
| stream | The handler returns an `IAsyncEnumerable`, which Hardened writes as NDJSON, flushing each row. | Hardened |
| sse | `[ServerSentEvents]` frames the same stream as server-sent events. | Hardened |
| static | `[HardenedStaticContent]` under `/static`, over the directory `ConfigureStaticContent` sets. | Hardened.Web.StaticContent |

## Notes

- Hardened ships no principal source for a credential, so `BearerTokenSource` is the application's
  own. It authenticates every bearer token and gives the grant `/authorized` requires to
  settings.json's token alone, so a wrong token is refused with 403 rather than 401. Hardened runs
  every principal source on every request, before routing, so every request pays for a look at
  `Authorization`.
- Hardened's CORS filter runs on every request, before routing, to answer preflights.
  `[Cors<Shop>]` limits the CORS headers to `/cors`.
- Every answer carries an `X-Correlation-Id` header, which Hardened's middleware writes.
- On the Kestrel hosts Hardened writes a serialised body with no `Content-Length`, so those answers
  go out chunked over HTTP/1.1. A static file carries its length.
- `[CacheResponse<T>]` takes its lifetime and vary headers as attribute constants.
  `ImplementationLibrary` puts it on the cache routes with `AddGlobalFilter`, which is how Hardened's
  documentation applies values from configuration.
- settings.json sizes the cache in entries, and Hardened's in-memory store is sized in bytes. Its
  default of 100 MB holds every key the cache family stores.
- The response cache puts an `ETag` on every answer it stores, so the cache rows carry one.
- Hardened answers HEAD by running the GET handler and sending its headers without the body.
  container-h2 therefore lists nothing as unsupported, where the ASP.NET Core frameworks list
  `items.head`.
- The static content mount reads a file once, compresses it with gzip at its smallest size, and
  sends the stored bytes to every request that accepts gzip. In Hardened's `development`
  environment it reads the file again for each request and compresses nothing, so each
  Dockerfile sets `HARDENED_ENVIRONMENT=production`.
- The application serves its OpenAPI document at `/openapi.json`, because
  `<HardenedOpenApiOutput>` writes `Client/openapi.json` from the copy the module serves.
- Hardened's own `/health/live` and `/health/ready` answer with no body, and the contract asks
  `/health` for one, so `ContractController` declares `/health`.
- The hosts register no logging provider, as the other .NET frameworks clear theirs. Hardened logs
  every refusal, such as each 404 the errors rows ask for.
- The bind rows count the `Content-Length` the request declared. Hardened's in-process test host
  sends a body without one, so `BodyTests` runs on a Kestrel socket.
- On lambda-emulator the function is Hardened's own `[LambdaHttpModule]` adapter over the same
  library, published with Native AOT on `provided:al2023`. `[AotSerializerModule]` makes its JSON
  serializers read only `JsonContext`, which also declares the bodies Hardened writes itself.
- On lambda-emulator the adapter answers in its buffered mode, the default, so the sse and stream
  tests are listed as unsupported there. `HARDENED_LAMBDA_RESPONSE_MODE=stream` would stream every
  answer.
- On lambda-emulator `/__meta` reports no `bootMs`. `HardenedLambdaBootstrap.Run` starts taking
  events with no moment of listening to time.

## Refusals

Every refusal is Hardened's own. `order.invalid` binds and breaks every rule, so the validation
check refuses it with 400 and a `ValidationError` body that lists each failed rule under `errors`,
named by the body parameter and the member's path, such as `order.customerId`. The first-error route
lists one. A body the binder cannot read never reaches the check. The binder refuses it with the same
400, naming the body parameter `order` with the code `invalid`, which is how `errors.malformed` is
answered. A path with no route answers 404, and a method the path lacks 405 with `Allow`, both with
no body.

## Client

`Client/` holds the OpenAPI document Hardened's build writes and a C# client generated from it with
Kiota, which is the generator Hardened's `hardened-web` template uses.

- Implementation's build writes `Client/openapi.json` through `<HardenedOpenApiOutput>`, which reads
  the document out of the compiled assembly. The property is set only where `Client/` is present,
  so the images' builds write nothing.
- `Client.csproj` builds after Implementation. When `openapi.json` is newer than
  `Kiota/kiota-lock.json`, it runs Kiota 1.34.1 from `.config/dotnet-tools.json` and compiles what
  Kiota wrote. The template pins that version beside `Microsoft.Kiota.Bundle` 2.0.0.
- `dotnet build Client` does both. `npm run rb -- client dotnet:hardened` runs it and fails if
  anything under `Client/` changed.
- `UnitTests/ClientTests.cs` calls the pipeline through the client, which `[assembly: KiotaTesting]`
  builds for a test parameter.

What the document leaves out:

- The CORS preflight and `/static` are answered before routing, so no route describes them.
- The bind routes list no 400, because the document lists the validation 400 only for an operation
  that validates. The binder still refuses a body it cannot read with it.
