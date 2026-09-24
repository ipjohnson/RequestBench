# FastEndpoints

FastEndpoints 8.3.0 on ASP.NET Core 10, answering the RequestBench corpus. The contract every
route follows is [`frameworks/openapi.json`](../../openapi.json).

FastEndpoints puts each route in an endpoint class that declares its route, request type and
response type, and binds, validates and sends through its own pipeline. Where FastEndpoints
defers to ASP.NET Core, such as output caching, compression, CORS and authorization, the
application uses ASP.NET Core's feature through the endpoint's configuration.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. One endpoint class per route, the classes of a family together in one file under `Endpoints/`. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, with Kestrel's endpoints on HTTP/2 alone, which is how Kestrel answers HTTP/2 with prior knowledge. |
| `UnitTests/` | xunit.v3 tests of the wiring, booting the Implementation in process with FastEndpoints.Testing's `AppFixture<Program>`. |
| `Client/` | The OpenAPI document FastEndpoints.OpenApi writes, and the Kiota client FastEndpoints.OpenApi.Kiota generates from it. |
| `client-exception/` | How the corpus reads FastEndpoints' error bodies. |
| `solution.slnx` | All three projects. |
| `global.json` | SDK 10, rolling forward to the newest 10.0 feature band installed, and Microsoft.Testing.Platform as the test runner. |
| `nuget.config` | nuget.org and no other feed. |

## Building, running and testing

```sh
dotnet build solution.slnx -c Release
RB_PAYLOADS=../../../tests/payloads PORT=8080 dotnet Implementation/bin/Release/net10.0/Implementation.dll
dotnet test --project UnitTests
dotnet test --project UnitTests --filter-trait "corpus=json.small"
```

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080. Each project restores against its committed
`packages.lock.json`. A build with `RB_PAYLOADS` set also writes `Client/`, as the Client section
says.

`dotnet test` needs `--project`, because `global.json` selects Microsoft.Testing.Platform, as
FastEndpoints' own repository does. The .NET 10 SDK refuses an xunit.v3 4 project under VSTest.
Each test the corpus measures carries `[Trait("corpus", "<id>")]`, so `--filter-trait
"corpus=<id>"`, xunit.v3's own filter, runs the tests of one row.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `Send.StringAsync` | FastEndpoints |
| json | The handler sends the payload with `Send.OkAsync`, and System.Text.Json writes it from the source-generated `JsonContext`, first in FastEndpoints' serializer resolver chain. | FastEndpoints |
| middleware | No-op pre-processors on the endpoint, one type per layer. | FastEndpoints |
| parameters, query, headers | Request types FastEndpoints binds from the route, the query string and the headers, with `[FromHeader]` naming a header. | FastEndpoints |
| body | A `Validator<TRequest>` for each validate route's request type, which FastEndpoints runs before the handler, with FluentValidation's rules underneath. It answers 400 with FastEndpoints' `ErrorResponse`. | FastEndpoints |
| authorized | `Policies(...)` in the endpoint's `Configure()` names a policy that compares a claim. ASP.NET Core has no scheme for an opaque token, so `BearerToken` reads the header into that claim. | ASP.NET Core through FastEndpoints, and a scheme by hand |
| cache | Output caching, `CacheOutput` on the endpoint's route builder through `Options(...)`, with `SetVaryByHeader` on the vary routes. | ASP.NET Core |
| compressed | Response compression on the whole application, gzip at its fastest level. | ASP.NET Core |
| etag | A response interceptor hashes the serialised answer with SHA-1 and answers 304 when `If-None-Match` names it. | by hand, on FastEndpoints' response interceptor |
| template | A Razor component rendered by `RazorComponentResult` and sent with `Send.ResultAsync`. | ASP.NET Core |
| items | One endpoint per method. The read endpoint names HEAD beside GET, because a GET route does not answer HEAD. | FastEndpoints |
| errors | Routing's 404 and 405 and the handler's `Send.NotFoundAsync`, all with no body, and FastEndpoints' 400 for a body its serializer cannot read. | ASP.NET Core and FastEndpoints |
| cors | The CORS feature, required on the `/cors` endpoint through its route builder. | ASP.NET Core |
| forms | Form binding onto a request type, on endpoints that call `AllowFormData` and `AllowFileUploads`. | FastEndpoints |
| stream | The handler writes and flushes one row per line, because FastEndpoints has no send method for JSON lines. | by hand |
| sse | `Send.EventStreamAsync`, writing and flushing each row as the data of one event. | FastEndpoints |
| static | The static-file feature over the payload directory at `/static`. | ASP.NET Core |

## Notes

- FastEndpoints secures every endpoint by default. `Endpoints.Configurator` in `Program.cs` makes
  every endpoint that names no policy anonymous, so `AllowAnonymous()` is said once.
- FastEndpoints runs the validator declared for a request type on every endpoint that takes that
  type. The bind routes take `OrderRequest`, which has none. The validate routes take
  `CheckedOrder`, the same shape with a validator, and the first-error route takes
  `FirstErrorOrder`, whose validator sets `ClassLevelCascadeMode = CascadeMode.Stop`.
- FastEndpoints keeps one pre-processor of each type on an endpoint and drops a repeat, so the
  sixteen middleware layers are sixteen types. A suite test counts them on each endpoint.
- ASP.NET Core computes no ETag for a dynamic answer, and FastEndpoints adds none. The etag
  endpoints send through `Send.InterceptedAsync`, which hands the answer to the interceptor before
  anything is written. An endpoint filter cannot do this, because FastEndpoints writes its answer
  inside the delegate a filter wraps.
- FastEndpoints' own `ResponseCache()` only writes Cache-Control, so the cache endpoints add
  ASP.NET Core's output cache through their route builder.
- FastEndpoints writes an `id:` line and a `retry:` line with every event. A `StreamItem` with no id
  leaves both empty, and an empty id leaves a client's last event id empty. The overload that
  takes an event name numbers the ids from 1, so the endpoint builds the items itself.
- `Program.cs` uses two things FastEndpoints.Generator writes at build, as FastEndpoints' own
  project templates do: `DiscoveredTypes.All`, the endpoint, validator and processor types, which
  replaces scanning the assembly at startup, and `AddFromImplementation`, the binders' object
  factories, property setters and value parsers, which replace expressions compiled at runtime.
  Its serializer-context generator is a dotnet tool the build installs and runs, writing files to
  commit, so `JsonContext` is written by hand and registered the way that tool's output registers
  itself.
- The request types are classes with setters, because the generator writes binding code for
  those and leaves records to runtime compilation. Each is also the echo its route answers with.
- FastEndpoints maps `GET /_test_url_cache_` in every application, which its route-less test
  helpers read.
- With one authentication scheme registered, ASP.NET Core would authenticate every request with
  it. `Program.cs` turns that off with the `SuppressAutoDefaultScheme` switch, so only
  `/authorized` pays for the scheme.
- A CORS policy that lists exactly one origin sends no `Vary: Origin`. The policy decides by
  predicate instead, which always sends it.
- FastEndpoints checks an antiforgery token only on an endpoint that calls `EnableAntiforgery()`,
  so the form endpoints need nothing turned off.
- settings.json sizes the cache in entries, and output caching sizes it in bytes. Its default of
  100 MB holds every key the cache family stores.
- container-h2 lists `items.head` as unsupported. Over HTTP/2, Kestrel sends the row the handler
  writes for HEAD as a DATA frame. HTTP/2 allows no content in an answer to HEAD, so the client
  resets the stream. Over HTTP/1.1 Kestrel leaves the row unwritten.

## Refusals

Every refusal is what FastEndpoints or ASP.NET Core writes. Nothing reshapes it.
`order.invalid` binds and breaks every rule, so the validator refuses it with 400 and
FastEndpoints' `ErrorResponse`: `statusCode`, `message`, and `errors`, which keys each failed
rule's messages by its camel-case property path. The first-error route lists one. A body the
serializer cannot read never reaches the validator. FastEndpoints answers it with the same 400
and envelope, keyed by the JSON path where reading stopped, which is `lines[0]` for
`errors.malformed`. Both go out as `application/problem+json`, FastEndpoints' content type for
its `ErrorResponse`.

A missing row is `Send.NotFoundAsync`, a 404 with no body. A path no route matches is routing's
404, a method the path has no route for is routing's 405, and a token the policy refuses is
authorization's 403, each with no body, because neither FastEndpoints nor ASP.NET Core writes one
unless an application adds status-code pages.

## Client

`Client/` holds the OpenAPI document FastEndpoints.OpenApi writes about the endpoints and a C#
client generated from it. FastEndpoints recommends Kiota, and runs it inside the application
through its own FastEndpoints.OpenApi.Kiota, which pins Kiota.Builder 1.29.1.

- With `RB_PAYLOADS` set, Implementation's build runs the built application with
  `--generateclients true`, the MSBuild task FastEndpoints documents for writing clients at build
  time. The application starts, listening on a free port because the target sets `PORT=0`, writes
  the document to `Client/Kiota/v1.json`, has Kiota write the client beside it, and exits. The
  target empties `Client/Kiota` first, because Kiota's own clean-output mode reads the document
  from a temporary directory and records that path in `kiota-lock.json`.
- `Program.cs` asks `IsApiClientGenerationMode()` before it calls the generator, which sits in a
  local function, so a normal start never loads Kiota. The image's build sets no `RB_PAYLOADS`,
  so it writes nothing. The image still carries FastEndpoints.OpenApi.Kiota, Kiota.Builder and
  their dependencies, about 4 MB, and maps no route to the document or the client.
- Kiota.Builder asks for Microsoft.Kiota.Bundle 1.20.1 or later, which NuGet's audit refuses for
  GHSA-7j59-v9qr-6fq9, so Implementation names 1.22.2. Its dependencies also bring
  Microsoft.VisualStudio.Threading's analyzers to every project that references Implementation,
  which is why the suite's helpers end in `Async`.
- `Microsoft.Extensions.ApiDescription.Server` writes the same document at build without
  listening, as Carter's does, because FastEndpoints.OpenApi registers it through `AddOpenApi`.
  FastEndpoints documents only its own export, and its Kiota wrapper reads the document from the
  running application, so the client step starts the application either way.
- `Client.csproj` builds after Implementation and compiles what Kiota wrote.
  `RB_PAYLOADS=../../../tests/payloads dotnet build Client` does both. `npm run rb -- client
  dotnet:fastendpoints` runs it and fails if anything under `Client/` changed.
- `UnitTests/ClientTests.cs` calls the Implementation in the test host through the client.

What the document says, and leaves out:

- FastEndpoints types each answer from the endpoint's response type, so the client reads a typed
  `Item` from the item read where Carter's returns a `Stream`.
- An endpoint with no response type is documented as 204 No Content, FastEndpoints' default. The
  client reads nothing from `/plaintext`, `/health`, `/stream/items`, `/sse/medium` and the
  template routes, and `POST /items` is documented as 200.
- The validate routes declare FastEndpoints' 400 `ErrorResponse`, so the client throws it as a
  typed exception.
- The validators' rules reach the `CheckedOrder` and `FirstErrorOrder` schemas as `exclusiveMinimum`,
  `minLength` and `minItems`, each beside a `"const": null` that FastEndpoints.OpenApi 8.3.0
  writes.
- Kiota 1.29.1 writes a composed type for `echo`, which the document declares as null or an
  object, and fills neither member without a discriminator, so every echo reaches the client
  empty. Carter's Kiota 1.35.0 reads the same schema as a nullable object.
- `/authorized/small` declares a plain bearer scheme in place of FastEndpoints' default JWT one,
  because the token is opaque.
- The CORS preflight and `/static` are answered by middleware, so no route describes them.
