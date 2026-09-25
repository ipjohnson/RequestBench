# Loco

Loco 1.2.0 on axum 0.8.9 and tokio's multi-thread runtime, answering the RequestBench corpus. The
contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Loco is a Rails-style framework for Rust, built on axum. An application implements Loco's `Hooks`,
which boot it from a config file per environment, add its initializers and its routes, and
complete the context its handlers share. A controller is a `Routes` of axum handlers, which answer
with Loco's `format` helpers and refuse with Loco's `Error`. Loco puts a stack of middleware in
front of every route, which the config file turns on and off. Every family uses Loco's facility
where Loco has one, and axum's, which Loco's prelude hands a controller, where Loco has none.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the package's library. `app.rs` holds the `App`, whose `Hooks` boot it, and `controllers/` holds one controller per corpus family. `initializers/view_engine.rs` adds Loco's Tera view engine, as the initializer Loco's starter generates does. |
| `config/` | `production.yaml`, which every host runs, and `test.yaml`, which the suite runs. Each turns on the middleware two families use and names the payload directory. |
| `assets/views/` | `items.html`, the Tera template the template family renders. |
| `container-h1/` | `main.rs`, Loco's command line as Loco's starter writes it, and the `Dockerfile` that builds the image, which runs `server start`. |
| `container-h2/` | The same `main.rs`, built with axum's `http2` feature, and its `Dockerfile`. |
| `lambda-emulator/` | `main.rs`, which boots the application and hands its router to lambda_http, and the `Dockerfile` that builds the function on the `provided:al2023` base image. |
| `UnitTests/` | The suite. Loco's request helper boots the application in its test environment and serves it to axum-test's `TestServer` in process. |
| `client-exception/` | How the corpus reads Loco's error bodies. |
| `Cargo.toml`, `Cargo.lock` | The one package: the library, the three binaries and the suite. |

`config/` and `assets/` sit at the package root, where a Loco project keeps them. Loco reads both
from the directory it starts in. The suite starts in the package, and each image copies them
beside the binary.

## Building, running and testing

```sh
cargo build --release --bin server
RB_PAYLOADS=../../../tests/payloads PORT=8080 LOCO_ENV=production target/release/server start
cargo test
cargo test the_first_error_route
```

The build needs Rust 1.94 or later, Loco's minimum, and the images build with 1.98.1. `LOCO_ENV`
picks the config file. `RB_PAYLOADS` names the payload directory, which `production.yaml` requires
and `test.yaml` defaults to `tests/payloads` above the package. `PORT` defaults to 8080. Each test
names its corpus ids in its doc comment, and `cargo test <function>` runs one.

## Hosts

container-h1 runs `server start`, Loco's command line. `start` boots the application and serves
it through Loco's own `Hooks::serve`, which is `axum::serve` on the binding and the port the config
file names, and stops at SIGTERM.

container-h2 runs the same `main.rs`, built with axum's `http2` feature. Loco serves the same axum,
so the `axum::serve` in Loco's own `serve` answers a connection that opens with the HTTP/2 preface
in HTTP/2, and one that does not in HTTP/1.1. No `serve` override is needed.

Loco has no Lambda adapter. `lambda-emulator/main.rs` loads the production config and boots the
application with the `App`'s `Hooks::boot`, as `start` does, and hands the router it builds to
lambda_http rather than serving it on a port.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `format::text` writes the string as `text/plain`. | Loco |
| json | `format::json` writes the payload with serde_json. | Loco, serde |
| middleware | axum's `from_fn` middleware, four or sixteen no-op layers added to the route with `Routes::layer`. | Loco, axum |
| parameters, query | axum's `Path` and `Query` extractors, from Loco's prelude, bind each value, the numbers as integers. | axum |
| headers | The handler reads the three headers from axum's `HeaderMap`, the account parsed as an integer, and refuses a header that is missing or no integer with Loco's `bad_request`. | Loco, axum |
| body | The validator crate's rules, derived on the order and run by Loco's `JsonValidateWithMessage` extractor before the handler. The first-error route checks one field at a time by hand. The bind routes take the order through Loco's `Json` and never run the rules. | Loco, validator |
| authorized | An extractor of the application's own checks settings.json's bearer token before the handler runs, and refuses any other token with Loco's error JSON and 403. | by hand, on Loco's `Error` |
| cache | Loco's in-memory cache, `ctx.cache`, sized by settings.json when the context is made. Each handler keeps its answer there, with the serial it wrote, keyed by the path and the route's vary headers, for settings.json's time to live. | by hand, on Loco's cache |
| compressed | Loco's compression middleware, turned on in the config file. | Loco, tower-http |
| etag | Loco's etag middleware, on by default, answers 304 for the tag a handler set. The handlers hash their JSON with SHA-1 and set the tag with `RenderBuilder::etag`. | Loco, sha1 |
| template | Loco's Tera view engine over `assets/views`, rendered per request with `format::render().view`. | Loco, Tera |
| items | One handler per method on `/items/{id}`, the id bound by `Path` and each body by Loco's `Json`. A missing row is Loco's `not_found`. axum answers HEAD with the GET handler. | Loco |
| errors | axum's router answers a path or a method with no route. Loco's `Json` refuses a body that is not JSON, and the items handlers' `not_found` a missing row. | Loco, axum |
| cors | Loco's `Cors`, its cors middleware's settings, made into the middleware's layer with settings.json's policy and added to the cors routes alone with `Routes::layer`. | Loco |
| forms | axum's `Form` and `Multipart` extractors, from Loco's prelude. | axum |
| stream | `Body::from_stream`, one row and its newline per chunk, as the body of the response Loco's `RenderBuilder` hands over. | axum |
| sse | axum's `Sse` response, each row the data of one event. Loco has no SSE response of its own. | axum |
| static | Loco's static middleware, turned on in the config file, over the payload directory at `/static`. | Loco, tower-http |

## Notes

- Loco's default middleware runs on every route: a catch-panic layer, a 2 MB payload limit, the
  etag middleware, request tracing, which opens a span for every request, an `X-Request-Id`
  header, which is a new UUID for a request that brings none, and `X-Powered-By: loco.rs`.
- Loco logs every error it answers with, at ERROR, as `controller_error`. The production logger
  writes JSON lines at INFO, so every refused body, missing row and wrong token writes a line.
- Loco keeps only the fields of the struct itself when it turns validator's errors into its own.
  A body whose only broken rule is in a line is refused with 400 and `{"errors":{}}`, naming no
  field.
- Loco's prelude brings both validator's `Validate` and Loco's `ValidatorTrait`, whose `validate`
  every `Validate` type has too. With both in scope, the call validator's derive writes for a
  nested field is ambiguous and does not compile, so the body controller imports Loco's prelude by
  name.
- Loco's default worker mode, BackgroundQueue, refuses to start without a queue configured, even
  with no worker registered. Both config files name BackgroundAsync, which needs none.
- Loco's etag middleware computes no tag, and answers 304 only when If-None-Match is the tag the
  handler set, byte for byte. Its 304 keeps `ETag`, `Cache-Control`, `Vary`, `Expires`, `Date` and
  `Content-Location` and drops every other header the handler wrote, `x-rb-serial` among them.
- Loco's compression middleware covers every route. It compresses a body over 32 bytes,
  tower-http's default threshold, at tower-http's default level, 6 for gzip. Loco has no setting
  for either, so the compressed rows run at level 6 rather than the fastest level most frameworks
  here use.
- Loco's cors middleware covers every route when the config file turns it on. The cors routes get
  the layer Loco's `Cors` makes instead, which is how `cors.scoped` passes. It varies on `Origin`
  and the two `Access-Control-Request` headers, Loco's default, and answers a preflight with 200.
- Loco's cache holds each value as JSON text, so a replay reads the stored answer back out of that
  text, the body a string inside it.
- A handler extracts the payloads with Loco's `SharedStore` extractor, which looks them up by type
  in the shared store for every request.
- Loco's `Hooks::serve` is `axum::serve`, which leaves `TCP_NODELAY` at the operating system's
  default, off. Loco has no setting for it.
- A debug build's Tera engine watches `assets/views` and reloads a template that changes. The
  images are release builds, which compile the templates once, when the application starts.
- The server is one process, as Loco's `start` runs it, on the container's two cores. The function
  on lambda-emulator runs on one core.

## Refusals

Every refusal is Loco's own or axum's, and nothing reshapes it.

- A body that breaks a rule is refused by `JsonValidateWithMessage` with 400 and `{"errors":{...}}`:
  the rules each field broke, keyed by the Rust field name, such as `customer_id`, each with its
  code, its parameters and a `message` of null.
- The validate routes run every rule, so `/body/validate/small` names all three of
  `order.invalid`'s fields. `/body/validate/first-error` names `customer_id` alone.
- A body that is not JSON is Loco's `Json` rejection, 400 with `{"error":"Bad Request"}`. A body
  that is JSON but not an order gets the same body with axum's status for it, 422.
- A path no route matches is axum's 404, and a method `/items/{id}` has no route for is axum's 405
  with `Allow`, both with no body.
- A missing row is Loco's `not_found`, 404 with
  `{"error":"not_found","description":"Resource was not found"}`.
- A wrong or missing bearer token is 403 with Loco's error JSON, `{"error":"forbidden",...}`.

## Client

There is no `Client/`. Loco's OpenAPI support, loco-openapi, documents only a handler annotated
with utoipa's `#[utoipa::path]` and registered through its own `openapi(...)` wrapper, which would
rewrite every route. Its release, 0.1.2, depends on Loco 0.16.
