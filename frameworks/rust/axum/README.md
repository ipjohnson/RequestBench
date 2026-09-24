# axum

axum 0.8.9 on tokio 1.53 and hyper 1, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

axum is the tokio project's web framework. A route is a method router of handlers whose arguments
are extractors, and everything around a handler is a tower layer. Every feature a family reaches
for comes from axum, from tower-http, or from a crate written for axum where neither has one. The
etag family is the one wired by hand.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application: a library with one router per corpus family under `routes/`. |
| `container-h1/` | How container-h1 starts it. `main.rs` is the server binary, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.rs` is the server binary, on axum's `http2` feature, with which `axum::serve` answers HTTP/2 with prior knowledge beside HTTP/1.1, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `main.rs` is the function, which hands the router to lambda_http's `run`, and `Dockerfile` builds it on the `provided.al2023` base image, where it runs as `/var/runtime/bootstrap`. |
| `UnitTests/` | The suite, which drives the router in process with tower's `oneshot`. |
| `client-exception/` | How the corpus reads axum's error bodies. |
| `Cargo.toml` | One package: the library, each host's binary and the suite, each at its own path. |
| `Cargo.lock` | Every crate as resolved. |
| `askama.toml` | Where askama finds the template. |

There is no client project, because axum emits no client.

## Building, running and testing

```sh
cargo build --release
RB_PAYLOADS=../../../tests/payloads PORT=8080 target/release/server
cargo test
```

`RB_PAYLOADS` names the payload directory, which the server loads before it starts listening.
`PORT` defaults to 8080. `cargo test` reads `RB_PAYLOADS` too, and finds `tests/payloads` by
walking up from this directory when it is not set.

The release profile is fat LTO with one codegen unit, as upstream measured every Rust framework.
The image build pays for it once.

tokio's multi-thread runtime starts one worker per core that `std::thread::available_parallelism`
reports. That reads the cgroup's CPU quota and the cores the container is placed on, so the
container runs two workers under its two-CPU budget, whichever way the budget is set.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns a `&str`, which axum sends as text/plain. | axum |
| json | The handler returns `Json` of the payload, which serde_json writes from the `Serialize` the payload types derive. | axum and serde |
| middleware | `from_fn` no-op layers on the route, four or sixteen of them. | axum |
| parameters, query | The `Path` and `Query` extractors, which convert the numbers to integers. | axum |
| headers | The handler reads the three headers from the `HeaderMap` extractor, because axum has no header binder. | axum |
| body | `Json` binds the order. On the validate routes, `ValidatedJson`, an extractor of the port's own, runs the validator crate's rules first and refuses with 400 and validator's errors as JSON. | validator, and an extractor by hand |
| authorized | `ValidateRequestHeaderLayer::has_header_value` on the route, which answers 403 unless Authorization is settings.json's bearer token. | tower-http |
| cache | A `from_fn` layer on each cache route, over cached's `LruTtlCache`, an LRU with a time to live, keyed by the path and the headers the route varies on. | cached, and a layer by hand |
| compressed | `CompressionLayer` on the compressed routes, gzip at its fastest level and the default threshold. | tower-http |
| etag | A `from_fn` layer on the two routes that hashes the answer with SHA-1 and answers 304 when If-None-Match names it. | by hand |
| template | An askama template, compiled into the binary. | askama |
| items | One route per method on `/items/{id}`. axum answers HEAD with the GET route and leaves the body unwritten. | axum |
| errors | The router's 404 and 405, both with no body, `Json`'s 400, and the handler's 404. | axum |
| cors | `CorsLayer` on the `/cors` routes. | tower-http |
| forms | The `Form` and `Multipart` extractors. | axum |
| stream | `Body::from_stream`, one row and its newline per chunk. | axum |
| sse | The `Sse` response, one event per row. | axum |
| static | `ServeDir` over the payload directory, nested at `/static`. | tower-http |

## Notes

- The routes capture the payloads in their closures rather than reading them from axum's `State`.
  The payloads are loaded once and kept for the life of the process, so each handler holds a
  `&'static` reference to them.
- Each registration keeps `.route("/path", get(` on one line, even where rustfmt would break it,
  because the snippet finder reads the method from the path's own line. The code is not run
  through rustfmt.
- validator cannot stop at the first failing rule, so the first-error route is wired by hand. It
  checks the order's fields one at a time, in the order the order declares them, each against its
  rule in a struct of its own, and refuses as the validate routes do.
- axum-valid 0.25, the newest release, implements its extractor for validator 0.20 alone. The
  validate routes run validator 0.21 through `ValidatedJson`, an extractor like the one axum's
  validator example writes for a form, which refuses exactly as axum-valid does.
- axum ships no response cache, and axum-response-cache 0.5, the newest release, needs cached 1.
  Each cache route has a `from_fn` layer of its own over cached 4's `LruTtlCache`, which answers
  from the store before the handler runs and stores a 2xx the handler answers.
- `AllowOrigin::exact` writes its origin on every answer, to any origin, and makes the layer send
  no `Vary: Origin`. The CORS layer lists its one origin instead.
- The Location header of a created item is built from the request's path. A `"/items/{}"` format
  string reads as a route to the snippet finder.
- axum leaves TCP_NODELAY at the operating system's default, which is off, so the small writes of
  a streamed answer can wait on Nagle's algorithm. `main.rs` turns it on through `tap_io`, as
  axum's documentation shows.
- The server is PID 1 in its container, and the kernel gives PID 1 no default action for SIGTERM.
  `main.rs` shuts the server down gracefully on it, so `docker stop` does not wait out its timeout.
- The allocator is mimalloc, set as the global allocator in `main.rs`. A server of this shape
  allocates on every request, and the benchmark runs every Rust framework on the same allocator so
  that a difference between two of them is the framework.
- On lambda-emulator the router answers behind lambda_http 1.3, built with API Gateway payload
  format 2.0 as the only event it reads. lambda_http's `run` buffers the whole answer, so the sse
  and stream tests are listed as unsupported there. `run_with_streaming_response` would stream
  every answer.
- The function is built on the Lambda base image it runs on. Amazon Linux 2023's glibc is older
  than the one in the rust images, and a binary linked against a newer glibc may not start on it.

## Refusals

Every refusal is what axum, the layer on the route or validator writes. Nothing reshapes it.
`order.invalid` binds and breaks every rule, so `ValidatedJson` refuses it with 400 and validator's
`ValidationErrors`: an object keyed by each field's Rust name, such as `customer_id`, holding the
rules it broke, with a list entry's errors under its index. The first-error route answers the same
way, naming the first field alone. A body that is not JSON never reaches the rules. `Json` refuses
it with a 400 whose body is text, which is how `errors.malformed` is answered. A missing row, a path
with no route and a wrong bearer token are answered with a status and no body.
