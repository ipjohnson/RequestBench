# ASP.NET Core MVC

ASP.NET Core MVC on ASP.NET Core 10.0.12, answering the RequestBench corpus. The contract every
route follows is [`frameworks/openapi.json`](../../openapi.json).

MVC is ASP.NET Core's controller framework: controllers and actions, model binding and
validation, filters, output formatters and Razor views. It ships in ASP.NET Core's shared
framework, so no package reference names it, and the version that runs is the one in the aspnet
runtime image the Dockerfile pins by digest. Every feature a family reaches for that MVC does not
have is ASP.NET Core's, which an MVC application uses as a minimal API does.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. One controller per corpus family under `Controllers/`, and the template family's view under `Views/`. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, with Kestrel's endpoints on HTTP/2 alone, which is how Kestrel answers HTTP/2 with prior knowledge. |
| `lambda-emulator/` | The `Dockerfile` that builds the function lambda-emulator runs, on the `dotnet:10` Lambda base image. The function starts from `Program.cs`, where `AddAWSLambdaHosting` puts Amazon.Lambda.AspNetCoreServer in Kestrel's place. |
| `UnitTests/` | xunit tests of the wiring, booting the Implementation in process with `WebApplicationFactory`. |
| `Client/` | The OpenAPI document MVC's build writes, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads MVC's error bodies. |
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
| baseline | The action returns a `ContentResult`. | MVC |
| json | The action returns the payload, and MVC's System.Text.Json output formatter writes it with source-generated metadata. | MVC |
| middleware | No-op action filters on the action, four or sixteen of them. | MVC |
| parameters, query, headers | Model binding: action parameters, `[FromHeader]` naming a header, and a record for query.many's eight values. | MVC |
| body | MVC binds the order from JSON. `[ApiController]` runs its DataAnnotations and answers a failure with 400. The first-error route checks one property at a time in a filter. | MVC, and the first-error route by hand |
| authorized | `[Authorize]` with a policy that compares a claim. ASP.NET Core has no scheme for an opaque token, so `BearerToken` reads the header into that claim. | ASP.NET Core, and a scheme by hand |
| cache | `[OutputCache]` on each action, with a named policy for each vary row that calls `SetVaryByHeader`. | ASP.NET Core |
| compressed | Response compression on the whole application, gzip at its fastest level. | ASP.NET Core |
| etag | A result filter hashes the serialised answer with SHA-1. `FileContentResult` sets `ETag` and answers 304 when `If-None-Match` names it. | by hand, and MVC |
| template | A Razor view rendered with `View()`. | MVC |
| items | One action per method. The read action names HEAD beside GET, because a GET route does not answer HEAD, and `CreatedAtAction` writes the created item's `Location`. | MVC |
| errors | Routing's 404 and 405, written as ProblemDetails. `[ApiController]`'s 400 for a body it cannot read, and its ProblemDetails for the action's `NotFound`. | ASP.NET Core and MVC |
| cors | `[EnableCors]` on the CORS controller. | ASP.NET Core |
| forms | Form binding: a record for the urlencoded form, and `[FromForm]` fields and an `IFormFile` for the upload. | MVC |
| stream | The action writes each row and a newline to the response, and flushes. | by hand |
| sse | The action returns `TypedResults.ServerSentEvents`, new in ASP.NET Core 10, which MVC runs as an `IResult`. | ASP.NET Core |
| static | The static-file feature over the payload directory at `/static`. | ASP.NET Core |

## Notes

- The first-error route is wired by hand. DataAnnotations has no mode that stops at the first
  failure. MVC's `MaxModelValidationErrors` holds for every action, and once it is reached MVC
  adds an entry under an empty key, which the corpus would read as a field. So that action binds
  `UnvalidatedOrder`, and `FirstErrorAttribute` walks MVC's metadata for it one property at a time,
  in declaration order, running each property's DataAnnotations. It puts the first failure into
  `ModelState` under the key MVC's validation gives it and answers through `[ApiController]`'s
  `InvalidModelStateResponseFactory`. The body is the automatic 400 with one entry.
- The bind actions bind `UnvalidatedOrder`, a subtype of the order marked `[ValidateNever]`, so they
  parse and bind and validate nothing. MVC reads `[ValidateNever]` from a type or a property and not
  from an action's own parameter, although the compiler accepts it there.
- `AddControllersWithViews` is what the view needs, and it adds `SaveTempDataAttribute` to MVC's
  global filters, so every action runs that filter, the JSON ones included.
- MVC's output formatter writes JSON with the relaxed `JavaScriptEncoder` unless the options name
  an encoder. System.Text.Json runs a context's generated serialization code only under the default
  encoder, so MVC takes each type's metadata from `JsonContext` and never runs that code.
- The server-sent events result is an `IResult`, which serialises with the minimal API JSON options
  and not MVC's, so `Program.cs` puts `JsonContext` first in both.
- ASP.NET Core computes no ETag for a dynamic answer, and MVC adds none. The filter hands the
  bytes it hashed to `FileContentResult`, so MVC's own precondition check answers the 304 and the
  body is serialised once.
- With one authentication scheme registered, ASP.NET Core would authenticate every request with
  it. `Program.cs` turns that off with the `SuppressAutoDefaultScheme` switch, so only
  `/authorized` pays for the scheme.
- A CORS policy that lists exactly one origin sends no `Vary: Origin`. The policy decides by
  predicate instead, which always sends it.
- MVC checks no antiforgery token on the form actions. Only `[ValidateAntiForgeryToken]` or
  `[AutoValidateAntiforgeryToken]` asks for one, and neither is applied.
- The view is `ItemsPage.cshtml`, because a view named `Items` reads as the `/items` route to the
  snippet finder.
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
- Amazon.Lambda.AspNetCoreServer marks every request https, as a Function URL's requests are.
  ASP.NET Core's response compression leaves an HTTPS answer uncompressed unless `EnableForHttps`
  is set, so lambda-emulator lists `compressed.gzip_large` as unsupported.
- Amazon.Lambda.AspNetCoreServer posts the row the handler writes for HEAD. A Function URL's caller
  reads no body in an answer to HEAD, so nothing reads it.
- On lambda-emulator `/__meta` reports no `bootMs`. The hosting package runs the runtime client's
  loop inside the server's `StartAsync`, so ASP.NET Core never raises `ApplicationStarted`.

## Refusals

Every refusal is what ASP.NET Core or MVC writes, as ProblemDetails. Nothing reshapes it.
`order.invalid` binds and breaks every rule, so `[ApiController]` refuses it with 400 and a
ValidationProblemDetails whose `errors` map each failed property, `CustomerId`, `Status` and
`Lines`, to its messages. The first-error route answers the same body naming `CustomerId` alone.
A body the input formatter cannot read never reaches validation. The same automatic 400 keys its
errors by the JSON path where reading stopped, `$.lines[0]`, and by the parameter the body could
not fill, `order`, and that is how `errors.malformed` is answered. Routing's 404 and 405 carry
ProblemDetails from `AddProblemDetails`, and the read action's `NotFound` carries
`[ApiController]`'s.

## Client

`Client/` holds the OpenAPI document MVC's actions produce and a C# client generated from it.
ASP.NET Core recommends no generator of its own. Its docs list NSwag, Kiota and OpenAPI Generator
side by side, so the client is Kiota's.

- Implementation's build writes `Client/openapi.json` through
  `Microsoft.Extensions.ApiDescription.Server`. That step runs `Program.cs` on a server that never
  listens and asks `AddOpenApi` for the document, which reads MVC's ApiExplorer. `Program.cs` loads
  the payloads, so the step runs only when `RB_PAYLOADS` is set, and the image's build leaves it
  unset. The step runs in `Implementation/`, so `RB_PAYLOADS` has to be an absolute path.
- `Client.csproj` builds after Implementation. When `openapi.json` is newer than
  `Kiota/kiota-lock.json`, it runs Kiota 1.35.0 from `.config/dotnet-tools.json` and compiles what
  Kiota wrote.
- `RB_PAYLOADS=$PWD/../../../tests/payloads dotnet build Client` does both. `npm run rb -- client
  dotnet:aspnet-mvc` runs it and fails if anything under `Client/` changed.
- `UnitTests/ClientTests.cs` calls the Implementation in the test host through the client.

What the document leaves out or says differently:

- The CORS preflight and `/static` are answered by middleware, so no action describes them.
- ApiExplorer describes an action only when told to, and `[ApiController]` tells it for its
  controllers. The template controller answers HTML and is no `[ApiController]`, so the template
  routes are missing.
- An action that returns `ContentResult`, `IActionResult` or `Task` states no type. The client
  returns a `Stream` for `/plaintext`, `/health`, `/stream/items` and `DELETE /items/{id}`.
- `/sse/medium` is described as `text/event-stream`, which Kiota does not read, so the client
  returns a `Stream` for it too.
- `ActionResult<Item>` types the read, create and update actions. ApiExplorer lists any
  `ActionResult<T>` as a 200, so the create action's 201 is described as 200, and the client reads
  the 201 by that schema.
- query.many's eight values and the urlencoded form's fields are named after the record's
  properties, `Page` to `MaxPrice`, because ApiExplorer names a bound model's properties by their
  CLR names. MVC binds them whatever their case.
- Each JSON answer is listed as `text/plain`, `application/json` and `text/json`, the types MVC's
  output formatters say they write.
- No action declares a refusal, so MVC's 400 reaches the client as Kiota's `ApiException`.
- Every `int` is written as an integer or a string, because ASP.NET Core's web JSON settings read
  numbers from strings. Kiota still types them as `int?`.
