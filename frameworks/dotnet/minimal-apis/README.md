# ASP.NET Core minimal APIs

ASP.NET Core 10 minimal APIs, answering the RequestBench corpus. The image runs ASP.NET Core
10.0.12, from the runtime image the Dockerfile pins by digest. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

This is [`dotnet:carter`](../carter)'s application without Carter. Everything Carter does with
ASP.NET Core is done here the same way. What Carter adds is replaced with what minimal APIs ship:
a static class per family calling `Map` methods in place of Carter's modules, and minimal APIs'
own validation, new in .NET 10, in place of Carter's FluentValidation filter. Read against this
framework, Carter's rows price Carter alone.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. One static class per corpus family under `Routes/`, whose `Map` method `Program.cs` calls. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, with Kestrel's endpoints on HTTP/2 alone, which is how Kestrel answers HTTP/2 with prior knowledge. |
| `lambda-emulator/` | The `Dockerfile` that builds the function lambda-emulator runs, on the `dotnet:10` Lambda base image. The function starts from `Program.cs`, where `AddAWSLambdaHosting` puts Amazon.Lambda.AspNetCoreServer in Kestrel's place. |
| `UnitTests/` | xunit tests of the wiring, booting the Implementation in process with `WebApplicationFactory`. |
| `Client/` | The OpenAPI document the Implementation's build writes, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads minimal APIs' error bodies. |
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
| body | Minimal APIs bind the order. `AddValidation` puts an endpoint filter on the validate routes, which checks the order's DataAnnotations and answers 400 with every failure. The first-error route checks one property at a time with Microsoft.Extensions.Validation. | minimal APIs, and one route by hand |
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

- The builder is `WebApplication.CreateBuilder`, as Carter's is. Upstream used `CreateSlimBuilder`,
  which would make the two applications differ in more than Carter.
- Minimal APIs' validation checks every property and has no setting to stop at the first failure.
  So `/body/validate/first-error` opts out with `DisableValidation()`, and an endpoint filter
  checks the order one property at a time, in the order they are declared, and stops at the first
  property that fails. Each check is Microsoft.Extensions.Validation's own
  `ValidatablePropertyInfo`, the class the validation source generator derives from. It names the
  field, writes the message and checks each line as `AddValidation`'s filter does. The filter
  answers with `TypedResults.ValidationProblem`, which writes the same ProblemDetails. The answer
  is the entry the full check would have listed first.
- Microsoft.Extensions.Validation marks the types that filter builds on as experimental in .NET 10,
  under diagnostic ASP0029. `BodyRoutes.cs` suppresses it.
- `AddValidation` puts its filter on every route whose handler binds a class, `HttpRequest` and
  `HttpResponse` included, and the filter checks that argument on every request. Carter validates
  only the routes its `MapPost<T>` names. So every route that binds a class and has nothing to
  validate opts out with `DisableValidation()`: the bind, cache, compressed, cors, etag and items
  write routes. Without that, those rows would price minimal APIs' validation, which Carter's same
  routes never run. The bind routes bind the same `OrderRequest` as the validate routes, so they
  measure the bind alone.
- ASP.NET Core computes no ETag for a dynamic answer, so that family is the one wired by hand.
- With one authentication scheme registered, ASP.NET Core would authenticate every request with
  it. `Program.cs` turns that off with the `SuppressAutoDefaultScheme` switch, so only
  `/authorized` pays for the scheme.
- A CORS policy that lists exactly one origin sends no `Vary: Origin`. The policy decides by
  predicate instead, which always sends it.
- Form binding requires an antiforgery token by default. The two form routes turn that off,
  because the corpus is not a browser session.
- settings.json sizes the cache in entries, and output caching sizes it in bytes. Its default of
  100 MB holds every key the cache family stores.
- Minimal APIs have no package of their own. They ship in the ASP.NET Core shared framework, which
  the image takes from the aspnet runtime image. `/__meta` reports the version of that shared
  framework, and rb.json's `package` is that image's registry page. On lambda-emulator the function
  takes the shared framework from the Lambda base image instead.
- container-h2 lists `items.head` as unsupported. Over HTTP/2, Kestrel sends the row the handler
  writes for HEAD as a DATA frame. HTTP/2 allows no content in an answer to HEAD, so the client
  resets the stream. Over HTTP/1.1 Kestrel leaves the row unwritten.
- On lambda-emulator the application answers behind Amazon.Lambda.AspNetCoreServer.Hosting 2.2,
  which reads API Gateway payload format 2.0. `AddAWSLambdaHosting` in `Program.cs` puts it in
  Kestrel's place only where `AWS_LAMBDA_FUNCTION_NAME` is set, so it does nothing on the other
  hosts. It buffers the whole answer into one proxy response, so the sse and stream tests are
  listed as unsupported there. `EnableResponseStreaming` would stream every answer.
- Amazon.Lambda.AspNetCoreServer marks every request https, as a Function URL's requests are.
  ASP.NET Core's response compression leaves an HTTPS answer uncompressed unless `EnableForHttps`
  is set, so lambda-emulator lists `compressed.gzip_large` as unsupported.
- Amazon.Lambda.AspNetCoreServer posts the row the handler writes for HEAD. A Function URL's caller
  reads no body in an answer to HEAD, so nothing reads it.
- On lambda-emulator `/__meta` reports no `bootMs`. The hosting package runs the runtime client's
  loop inside the server's `StartAsync`, so ASP.NET Core never raises `ApplicationStarted`.

## Refusals

Every refusal is what ASP.NET Core writes, as ProblemDetails. Nothing reshapes it. `order.invalid`
binds and breaks every rule, so minimal APIs' validation refuses it with 400 and an
`HttpValidationProblemDetails`. Its `errors` maps each failed field's CLR property path, such as
`Lines[0].Qty`, to that field's messages. The first-error route lists one. A body the binder
cannot read never reaches validation. The binder refuses it with a 400 that names no field, which
is how `errors.malformed` is answered.

## Client

`Client/` holds the OpenAPI document the Implementation's routes produce and a C# client generated
from it. ASP.NET Core recommends no generator of its own. Its docs list NSwag, Kiota and OpenAPI
Generator side by side, so the client is Kiota's.

- Implementation's build writes `Client/openapi.json` through
  `Microsoft.Extensions.ApiDescription.Server`. That step runs `Program.cs` on a server that never
  listens and asks `AddOpenApi` for the document. `Program.cs` loads the payloads, so the step runs
  only when `RB_PAYLOADS` is set, and the image's build leaves it unset. The step runs in
  `Implementation/`, so `RB_PAYLOADS` has to be an absolute path.
- `Client.csproj` builds after Implementation. When `openapi.json` is newer than
  `Kiota/kiota-lock.json`, it runs Kiota 1.35.0 from `.config/dotnet-tools.json` and compiles what
  Kiota wrote.
- `RB_PAYLOADS=$PWD/../../../tests/payloads dotnet build Client` does both. `npm run rb -- client
  dotnet:minimal-apis` runs it and fails if anything under `Client/` changed.
- `UnitTests/ClientTests.cs` calls the Implementation in the test host through the client.

The document is Carter's with two differences. The first-error route takes `OrderRequest`, and the
order's schema carries its rules, because ASP.NET Core's document generation reads DataAnnotations:
`minimum` 1 on each id and quantity, `minItems` 1 on `lines`, and `status` and `lines` required.

What the document leaves out:

- The CORS preflight and `/static` are answered by middleware, so no route describes them.
- A handler that returns `IResult`, such as `Results.Ok(row)`, states no type. The client returns a
  `Stream` for `GET`, `POST` and `PATCH` on `/items`, and for the text, stream and template routes.
- No route declares a refusal, so the validation's 400 reaches the client as Kiota's `ApiException`.
- Every `int` is written as an integer or a string, because ASP.NET Core's web JSON settings read
  numbers from strings. Kiota still types them as `int?`.
