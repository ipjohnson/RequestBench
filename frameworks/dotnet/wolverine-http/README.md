# Wolverine.HTTP

Wolverine.HTTP (WolverineFx.Http 6.39.1) on ASP.NET Core 10, answering the RequestBench corpus.
The contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Wolverine.HTTP routes a static method marked `[WolverineGet]` or one of its siblings, and
generates a handler class for it that binds the request, runs the middleware and writes the
answer. Where Wolverine has no feature of its own for a family, the application uses ASP.NET
Core's, as Wolverine's docs do.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. One endpoint class per corpus family under `Endpoints/`. |
| `Implementation/Internal/Generated/` | The handler Wolverine generated for each endpoint, committed. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `UnitTests/` | xunit tests of the wiring, booting the Implementation in process with Alba. |
| `Client/` | The OpenAPI document the build writes, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads Wolverine's error bodies. |
| `solution.slnx` | All three projects. |
| `.config/dotnet-tools.json` | Kiota, as a local tool, which the Client project runs. |
| `global.json` | SDK 10, rolling forward to the newest 10.0 feature band installed. |
| `nuget.config` | nuget.org and no other feed. |

## Building, running and testing

```sh
dotnet build solution.slnx -c Release
RB_PAYLOADS=../../../tests/payloads PORT=8080 dotnet Implementation/bin/Release/net10.0/Implementation.dll
dotnet test UnitTests
```

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080. Each project restores against its committed
`packages.lock.json`. A build with `RB_PAYLOADS` set also writes the OpenAPI document, as the
Client section says.

## Generated handlers

Wolverine turns each endpoint into C# source for a handler class and needs that class compiled.
It can compile the source with Roslyn when the endpoint is first called, or load a class that
was compiled with the application. Wolverine's docs recommend the second for production, which
is `TypeLoadMode.Static`, and `Program.cs` sets it.

- The handlers are written by Wolverine's `codegen write` command and committed under
  `Implementation/Internal/Generated`, so the image compiles them with the rest of the project.
- Compiled at runtime, a handler would be built at Roslyn's default debug optimization level,
  because JasperFx's `AssemblyGenerator` names no level. Wolverine 6 also moved Roslyn out to
  `WolverineFx.RuntimeCompilation`, which the Implementation does not reference.
- A route with no handler in the assembly stops the start with `MissingPreBuiltTypesException`.
- Wolverine does not notice a handler that is stale. `UnitTests/GeneratedCodeTests.cs` writes the
  handlers again into a temporary directory and fails when any file differs from the committed one.
- The generated files hold no route literal, so the snippet finder reads each route from its
  endpoint alone.

After changing an endpoint, write them again. Delete the old ones first, because `codegen write`
removes nothing, and a handler that no longer compiles stops the build that the command needs.

```sh
rm -rf Implementation/Internal/Generated
cd Implementation && RB_PAYLOADS=../../../../tests/payloads dotnet run -p:OpenApiGenerateDocuments=false -- codegen write
```

`-p:OpenApiGenerateDocuments=false` keeps the build from writing the OpenAPI document. Writing it
starts the application, and in `TypeLoadMode.Static` the application refuses to start while a
handler is missing.

Wolverine's docs end `Program.cs` with `return await app.RunJasperFxCommands(args);`, which is
what runs `codegen write`. `Program.cs` calls it only for `codegen` and starts the server with
`app.Run()`. Starting through JasperFx's command line took about 325 ms to the first answer on
this Mac, against about 280 ms through `app.Run()`, because it finds its commands first.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The endpoint returns the string, and Wolverine writes it as `text/plain`. | Wolverine |
| json | The endpoint returns the payload. Wolverine writes it with minimal APIs' JSON options, where the source-generated `JsonContext` comes first. | Wolverine |
| middleware | `[Middleware]` names a class with a `Before` method four or sixteen times, and the generated handler calls `Before` that many times. | Wolverine |
| parameters, query, headers | Method parameters: a route parameter by its name, a simple parameter from the query string value of the same name, and `[FromHeader]` naming a header. | Wolverine |
| body | Wolverine reads the order from the body. Its FluentValidation middleware runs the validator for the request type in the generated handler and answers 400 with the failed rules. | Wolverine |
| authorized | `[Authorize]` with a policy that compares a claim, which Wolverine copies onto the route. ASP.NET Core has no scheme for an opaque token, so `BearerToken` reads the header into that claim. | ASP.NET Core, and a scheme by hand |
| cache | Output caching, `[OutputCache]` naming a policy on each endpoint. The vary policies also vary by the headers the row sends. | ASP.NET Core |
| compressed | Response compression on the whole application, gzip at its fastest level. | ASP.NET Core |
| etag | A resource writer policy writes the answer of the two `[Tagged]` endpoints in place of Wolverine's JSON write. It hashes the serialised body with SHA-1 and hands both to `Results.Bytes`, which answers 304 when `If-None-Match` names the tag. | Wolverine's extension point, the hash by hand, the 304 ASP.NET Core's |
| template | A Razor component rendered with `RazorComponentResult`, which Wolverine executes as it executes any `IResult`. | ASP.NET Core |
| items | One endpoint per method. `[WolverineHead]` declares HEAD beside `[WolverineGet]`, because a GET route does not answer HEAD. A null answer is a 404, and the delete endpoint returns its status as an `int`. | Wolverine |
| errors | Routing's 404 and 405, Wolverine's 404 for a null answer, and Wolverine's 400 for a body it cannot read. | ASP.NET Core and Wolverine |
| cors | The CORS feature, `[EnableCors]` on the one endpoint. | ASP.NET Core |
| forms | `[FromForm]` parameters and an `IFormFile`, with Wolverine's `[DisableAntiforgery]`. | Wolverine |
| stream | `Results.Stream`, writing and flushing one row per line. | ASP.NET Core |
| sse | `TypedResults.ServerSentEvents`, new in ASP.NET Core 10, writing and flushing each row as the data of one event. | ASP.NET Core |
| static | The static-file feature over the payload directory at `/static`. | ASP.NET Core |

## Notes

- Wolverine puts its FluentValidation middleware on every endpoint whose request type has a
  validator. The bind endpoints read `OrderRequest`, which has none. The validate endpoints read
  `ValidatedOrder` and `FirstErrorOrder`, which have one each.
- On every method but GET, Wolverine reads the body into the first parameter of a type it has no
  other source for. The payloads are `[FromServices]` on those endpoints, HEAD included.
- A route parameter that is not an integer is answered 404 by the generated handler, not 400.
- Wolverine binds a form through `HttpRequest.Form`, which blocks on ASP.NET Core's asynchronous
  read of the body.
- Wolverine computes no ETag, and no middleware can skip the JSON write that follows the
  endpoint, which a 304 has to. So the etag family replaces the write. ASP.NET Core computes no
  ETag for a dynamic answer either.
- With one authentication scheme registered, ASP.NET Core would authenticate every request with
  it. `Program.cs` turns that off with the `SuppressAutoDefaultScheme` switch, so only
  `/authorized` pays for the scheme.
- A CORS policy that lists exactly one origin sends no `Vary: Origin`. The policy decides by
  predicate instead, which always sends it.
- Wolverine's docs set up neither `AddProblemDetails` nor `UseStatusCodePages`, so the
  Implementation adds neither. A 401, 403, 404 or 405 has no body.
- settings.json sizes the cache in entries, and output caching sizes it in bytes. Its default of
  100 MB holds every key the cache family stores.

## Refusals

Every refusal is what Wolverine or ASP.NET Core writes. Nothing reshapes it.

- `order.invalid` binds and breaks every rule. Wolverine's FluentValidation middleware refuses it
  with a 400 `ValidationProblemDetails`, whose `errors` keys each failed property's messages by its
  CLR path. The first-error validator sets `ClassLevelCascadeMode = CascadeMode.Stop`, so that
  route names `CustomerId` alone.
- A body Wolverine cannot read never reaches the validator. Wolverine answers it with a 400
  ProblemDetails titled `Invalid JSON format`, with the parser's message and position and no field.
- A path no route matches and a row that does not exist are answered 404. A method the path
  lacks is answered 405 with an `Allow` header. A missing token is answered 401 and a wrong one
  403. None of these has a body.

## Client

`Client/` holds the OpenAPI document ASP.NET Core writes about Wolverine's endpoints and a C#
client generated from it. Neither Wolverine nor ASP.NET Core recommends a generator. ASP.NET
Core's docs list NSwag, Kiota and OpenAPI Generator side by side, so the client is Kiota's.

- Implementation's build writes `Client/openapi.json` through
  `Microsoft.Extensions.ApiDescription.Server`. That step runs `Program.cs` on a server that never
  listens and asks `AddOpenApi` for the document, which reads the API descriptions Wolverine gives
  its endpoints. `Program.cs` loads the payloads, so the step runs only when `RB_PAYLOADS` is set,
  and the image's build leaves it unset.
- `Client.csproj` builds after Implementation. When `openapi.json` is newer than
  `Kiota/kiota-lock.json`, it runs Kiota 1.35.0 from `.config/dotnet-tools.json` and compiles what
  Kiota wrote.
- `RB_PAYLOADS=$PWD/../../../tests/payloads dotnet build Client` does both. `npm run rb -- client
  dotnet:wolverine-http` runs it and fails if anything under `Client/` changed.
- Wolverine also adds an `openapi` command that writes the same document without starting the
  host. Its docs offer it for an application whose start needs a database or a broker, and this
  one needs neither, so the build writes the document as the other ASP.NET Core frameworks' do.
- `UnitTests/ClientTests.cs` calls the Implementation through Alba's test server with the client.
- The validate endpoints declare the 400 `HttpValidationProblemDetails`, so Kiota throws it,
  failed properties included, for a rejected order.

Where the document and the routes differ:

- The CORS preflight and `/static` are answered by middleware, so no route describes them.
- Wolverine declares a 404 with an empty schema on every endpoint that writes JSON, because a null
  answer would be one. Most of them never return null.
- An endpoint that returns a plain `IResult` or a `RazorComponentResult` is described as answering
  JSON of that result type. The client's methods for the stream and template routes would fail to
  read the answer. `Created<Item>` and `ServerSentEventsResult<Item>` are described as answered.
- The delete endpoint returns its status as an `int`, which the document describes as a 200 with
  an integer body. The route answers 204.
- Every `int` is written as an integer or a string, because ASP.NET Core's web JSON settings read
  numbers from strings. Kiota still types them as `int?`.
