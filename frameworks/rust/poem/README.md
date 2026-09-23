# poem

poem 3.1.12 on tokio 1.53 and hyper 1, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

poem is a web framework for tokio. A route is a method router of endpoints, a handler function
becomes an endpoint through the `#[handler]` macro and takes extractors as its arguments, and
everything around an endpoint is a middleware that turns it into another endpoint. Every feature a
family reaches for comes from poem where poem has it, and poem has most of them. Validation is the
validator crate, the template engine is Tera, and the cache and the etag family are wired by hand.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application: a library with one module per corpus family under `routes/`, each adding its paths to the one `Route`, and the server binary, `main.rs`. |
| `UnitTests/` | The suite, which drives the `Route` in process with poem's `TestClient`. |
| `client-exception/` | How the corpus reads poem's error bodies. |
| `Cargo.toml` | One package: the library, the binary and the suite, each at its own path. |
| `Cargo.lock` | Every crate as resolved. |

There is no client project. poem writes an OpenAPI document only through poem-openapi, whose routes
are written as `#[OpenApi]` impls rather than as the routes here, and changing the routes for the
document is ruled out.

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
| baseline | The endpoint returns a `&str`, which poem sends as text/plain. | poem |
| json | The endpoint returns `Json` of the payload, which serde_json writes from the `Serialize` the payload types derive. | poem and serde |
| middleware | A poem `Middleware` that calls the endpoint it wraps, four or sixteen layers of it on the route. | poem |
| parameters, query | The `Path` and `Query` extractors, which convert the numbers to integers. | poem |
| headers | The handler reads the three headers from the `HeaderMap` extractor, because poem's `TypedHeader` binds only the headers the headers crate defines. | poem |
| body | `Json` binds the order. On the validate routes the handler runs the validator crate's rules and refuses with 400 and validator's errors as JSON. | validator |
| authorized | A poem `Middleware` on the route, as poem's basic-auth example writes one, which answers 403 unless the bearer token is settings.json's. | poem |
| cache | A poem `Middleware` on each cache route over cached's `LruTtlCache`, keyed by the path and the headers the route varies on. | by hand, over cached |
| compressed | The `Compression` middleware on the compressed routes, gzip at its fastest level. | poem |
| etag | A function middleware around the two routes that hashes the answer with SHA-1 and answers 304 when If-None-Match names it. | by hand |
| template | A Tera template, compiled into the binary and parsed once. | Tera |
| items | One method router on `/items/:id`. poem answers HEAD with the GET endpoint and drops the body. | poem |
| errors | The router's 404 and 405, both with poem's message as text, `Json`'s 400, and the handler's 404. | poem |
| cors | The `Cors` middleware on the `/cors` route. | poem |
| forms | The `Form` and `Multipart` extractors. | poem |
| stream | `Body::from_bytes_stream`, one row and its newline per chunk. | poem |
| sse | The `SSE` response, one event per row. | poem |
| static | `StaticFilesEndpoint` over the payload directory, nested at `/static`. | poem |

## Notes

- A handler function captures nothing, because `#[handler]` makes it a type of its own. The routes
  whose handlers take extractors therefore put the payloads on the request with poem's `AddData`
  and read them back with the `Data` extractor, which costs those routes an insert into the
  request's extensions. The routes with no extractor are closures, made endpoints by `make_sync`,
  that capture the payloads.
- poem's `Route` holds each path once and records the matched path pattern on every request and
  answer. A nested `Route` builds that pattern with a `format!` on every request, so the families
  add their paths to one `Route` rather than nesting one each.
- poem writes an error as its message, as text/plain. The router answers a miss with `not found`
  and a method a path lacks with `method not allowed`, and the `Json` extractor refuses a body that
  is not JSON with `parse error:` and serde_json's message. A refusal is JSON only where an error
  type writes it in its own `as_response`, as poem's documentation shows for a custom error, which
  is how the validate routes refuse.
- poem validates only through poem-openapi, and no crate joins plain poem to a validator, so the
  validate handlers run the validator crate's rules themselves after `Json` binds the order.
  validator cannot stop at the first failing rule, so the first-error route checks the order's
  fields one at a time, in the order the order declares them, each against its rule in a struct of
  its own.
- The 405 carries no `Allow` header, which RFC 9110 requires a 405 to carry.
- The `Compression` middleware has no size threshold, so it gzips the 123-byte small payload too. It
  streams what it compresses, so a compressed answer has no Content-Length, and it sends no
  `Vary: Accept-Encoding`.
- poem's `Cors` writes `Vary: Origin` only for an origin it matched by a pattern or a function,
  never for one it lists. settings.json names one origin, so the answer does not say it varies by
  origin, and rb.json skips `cors.vary`.
- poem's `Cors` answers any request from an origin the policy does not name with 403 and
  `request-origin not allowed` as text, the request itself as well as its preflight, so the
  handler never runs for it. The CORS standard leaves that refusal to the browser. Every preflight
  it answers carries an empty `Access-Control-Expose-Headers`.
- `StaticFilesEndpoint` checks, opens and stats the file with blocking calls on the runtime's
  worker thread, then reads it through tokio's file, which hands each read to the blocking pool.
- The etag family is wired by hand. poem computes an ETag for a static file, from its inode, its
  modification time and its length, and for nothing a handler builds.
- Tera renders from a context, so each template request serialises the payload into Tera's own
  values before it renders them.
- Each registration keeps `.at("/path", get(` on one line, because the snippet finder reads the
  method from the path's own line. The one method router on `/items/:id` names GET on that line and
  the other three methods on the next. The code is not run through rustfmt.
- poem's TCP listener leaves TCP_NODELAY at the operating system's default, which is off, and has
  no setting for it, so the small writes of a streamed answer can wait on Nagle's algorithm.
  `main.rs` gives the server an acceptor of its own that turns it on for each connection.
- The server is PID 1 in its container, and the kernel gives PID 1 no default action for SIGTERM.
  poem's `Server` stops only when told to, so `main.rs` passes SIGTERM to it as the signal for a
  graceful shutdown, and `docker stop` does not wait out its timeout.
- The allocator is mimalloc, set as the global allocator in `main.rs`. A server of this shape
  allocates on every request, and the benchmark runs every Rust framework on the same allocator so
  that a difference between two of them is the framework.

## Refusals

Every refusal is what poem writes, or an error type of the port's own that writes validator's
errors as poem's documentation shows. Nothing reshapes an answer poem wrote. `order.invalid` binds
and breaks every rule, so the validate route refuses it with 400 and validator's
`ValidationErrors`: an object keyed by each field's Rust name, such as `customer_id`, holding the
rules it broke, with a list entry's errors under its index. The first-error route answers the same
way, naming the first field alone. A body that is not JSON never reaches the rules. `Json` refuses
it with a 400 whose body is its message as text, which is how `errors.malformed` is answered. A
path with no route and a method a path lacks are answered with poem's message as text. A missing
row and a wrong bearer token are answered with a status and no body.
