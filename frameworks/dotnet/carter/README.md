# Carter

Carter 10.0.0 on ASP.NET Core 10, answering the RequestBench corpus. The contract every
route follows is [`frameworks/openapi.json`](../../openapi.json).

Carter adds modules and FluentValidation-backed validation to ASP.NET Core minimal APIs. Every
other feature a family reaches for is ASP.NET Core's, which is what a Carter application
uses.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. One Carter module per corpus family under `Routes/`. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, with Kestrel's endpoints on HTTP/2 alone, which is how Kestrel answers HTTP/2 with prior knowledge. |
| `lambda-emulator/` | The `Dockerfile` that builds the function lambda-emulator runs, on the `dotnet:10` Lambda base image. The function starts from `Program.cs`, where `AddAWSLambdaHosting` puts Amazon.Lambda.AspNetCoreServer in Kestrel's place. |
| `UnitTests/` | xunit tests of the wiring, booting the Implementation in process with `WebApplicationFactory`. |
| `Client/` | The OpenAPI document Carter's build writes, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads Carter's error bodies. |
| `solution.slnx` | All three projects. |
| `.config/dotnet-tools.json` | Kiota, as a local tool, which the Client project runs. |
| `global.json` | SDK 10, rolling forward to the newest 10.0 feature band installed. |
| `nuget.config` | nuget.org and no other feed. |

## Building, running and testing

```sh
dotnet build solution.slnx -c Release
RB_PAYLOADS=../../../tests/payloads PORT=8080 dotnet Implementation/bin/Release/net10.0/Implementation.dll
dotnet test solution.slnx
```

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080. Each project restores against its committed
`packages.lock.json`. A build with `RB_PAYLOADS` set also writes the OpenAPI document, as the
Client section says.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `Results.Text` | minimal APIs |
| json | The handler returns the payload object, and System.Text.Json writes it with source-generated metadata. | minimal APIs |
| middleware | No-op endpoint filters on the route. | minimal APIs |
| parameters, query, headers | Handler parameters, with `[FromHeader]` naming a header. | minimal APIs |
| body | Minimal APIs bind the order. `MapPost<T>` runs the FluentValidation validator for `T` and answers 422 with the failed rules. | Carter |
| authorized | `RequireAuthorization` with a policy that compares a claim. ASP.NET Core has no scheme for an opaque token, so `BearerToken` reads the header into that claim. | ASP.NET Core, and a scheme by hand |
| cache | Output caching, with `SetVaryByHeader` on the vary routes. | ASP.NET Core |
| compressed | Response compression on the whole application, gzip at its fastest level. | ASP.NET Core |
| etag | An endpoint filter hashes the serialised body with SHA-1 and answers 304 when `If-None-Match` names it. | by hand |
| template | A Razor component rendered with `RazorComponentResult`. | ASP.NET Core |
| items | One route per method. `MapMethods` names HEAD beside GET, because a GET route does not answer HEAD. | minimal APIs |
| errors | Routing's 404 and 405, the binder's 400 and the handler's `NotFound`, written as ProblemDetails. | ASP.NET Core |
| cors | The CORS feature on the `/cors` route group. | ASP.NET Core |
| forms | Form binding with `[FromForm]` and `IFormFile`. | minimal APIs |
| stream | `Results.Stream`, writing and flushing one row per line. | minimal APIs |
| sse | `TypedResults.ServerSentEvents`, new in ASP.NET Core 10, writing and flushing each row as the data of one event. | minimal APIs |
| static | The static-file feature over the payload directory at `/static`. | ASP.NET Core |

## Notes

- ASP.NET Core computes no ETag for a dynamic answer, and Carter adds none, so that family is
  the one wired by hand.
- With one authentication scheme registered, ASP.NET Core would authenticate every request with
  it. `Program.cs` turns that off with the `SuppressAutoDefaultScheme` switch, so only
  `/authorized` pays for the scheme.
- A CORS policy that lists exactly one origin sends no `Vary: Origin`. The policy decides by
  predicate instead, which always sends it.
- Form binding requires an antiforgery token by default. The two form routes turn that off,
  because the corpus is not a browser session.
- settings.json sizes the cache in entries, and output caching sizes it in bytes. Its default of
  100 MB holds every key the cache family stores.
- container-h2 lists `items.head` as unsupported. Over HTTP/2, Kestrel sends the row the handler
  writes for HEAD as a DATA frame. HTTP/2 allows no content in an answer to HEAD, so the client
  resets the stream. Over HTTP/1.1 Kestrel leaves the row unwritten.
- On lambda-emulator the application answers behind Amazon.Lambda.AspNetCoreServer.Hosting 2.2,
  which reads API Gateway payload format 2.0. `AddAWSLambdaHosting` in `Program.cs` puts it in
  Kestrel's place only where `AWS_LAMBDA_FUNCTION_NAME` is set, so it does nothing on the other
  hosts. It buffers the whole answer into one proxy response, so the sse and stream tests are
  listed as unsupported there. `EnableResponseStreaming` would stream every answer.
- lambda-emulator runs Carter on the JIT runtime, not as a Native AOT build, because Carter discovers
  its modules by reflection.
- Amazon.Lambda.AspNetCoreServer marks every request https, as a Function URL's requests are.
  ASP.NET Core's response compression leaves an HTTPS answer uncompressed unless `EnableForHttps`
  is set, so `Program.cs` sets it. The container hosts are plain HTTP, where it changes nothing.
- Amazon.Lambda.AspNetCoreServer posts the row the handler writes for HEAD. A Function URL's caller
  reads no body in an answer to HEAD, so nothing reads it.
- On lambda-emulator `/__meta` reports no `bootMs`. The hosting package runs the runtime client's
  loop inside the server's `StartAsync`, so ASP.NET Core never raises `ApplicationStarted`.

## Refusals

Every refusal is what ASP.NET Core or Carter writes, as ProblemDetails. Nothing reshapes it.
`order.invalid` binds and breaks every rule, so Carter's validation filter refuses it with 422
and lists each failed rule under `errors`. The route that stops at the first bad field lists one.
A body the binder cannot read never reaches the filter. The binder refuses it with a 400 that
names no field, which is how `errors.malformed` is answered.

## Client

`Client/` holds the OpenAPI document Carter's routes produce and a C# client generated from it.
ASP.NET Core recommends no generator of its own. Its docs list NSwag, Kiota and OpenAPI Generator
side by side, so the client is Kiota's.

- Implementation's build writes `Client/openapi.json` through
  `Microsoft.Extensions.ApiDescription.Server`. That step runs `Program.cs` on a server that never
  listens and asks `AddOpenApi` for the document. `Program.cs` loads the payloads, so the step runs
  only when `RB_PAYLOADS` is set, and the image's build leaves it unset. The step runs in
  `Implementation/`, so `RB_PAYLOADS` has to be an absolute path.
- `Client.csproj` builds after Implementation. When `openapi.json` is newer than
  `Kiota/kiota-lock.json`, it runs Kiota 1.35.0 from `.config/dotnet-tools.json` and compiles what
  Kiota wrote.
- `RB_PAYLOADS=$PWD/../../../tests/payloads dotnet build Client` does both. `npm run rb -- client
  dotnet:carter` runs it and fails if anything under `Client/` changed.
- `UnitTests/ClientTests.cs` calls the Implementation in the test host through the client.

What the document leaves out:

- The CORS preflight and `/static` are answered by middleware, so no route describes them.
- A handler that returns `IResult`, such as `Results.Ok(row)`, states no type. The client returns a
  `Stream` for `GET`, `POST` and `PATCH` on `/items`, and for the text, stream and template routes.
- No route declares a refusal, so Carter's 422 reaches the client as Kiota's `ApiException`.
- Every `int` is written as an integer or a string, because ASP.NET Core's web JSON settings read
  numbers from strings. Kiota still types them as `int?`.
