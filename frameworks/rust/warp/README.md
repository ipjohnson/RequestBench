# warp

warp 0.4.3 on hyper 1 and tokio 1.53, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

warp is Sean McArthur's web framework on hyper. There is no route table: an application is one
filter, built by combining filters that each take a part of the request, such as a path segment, a
method, a header or the body, or reject it. `and` chains filters, `or` tries another when one
rejects, and a rejection nothing takes reaches warp's own answer or a `recover` handler. Every
family is wired with warp's own filters where warp has one. Validation is the validator crate, and
the cache and the etag family are wired by hand, because warp ships neither.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application: a library with one filter per corpus family under `routes/`, and the recover handler in `refusals.rs`. |
| `container-h1/` | How container-h1 starts it. `main.rs` is the server binary, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.rs` is the server binary, on warp's own server, which answers HTTP/2 with prior knowledge beside HTTP/1.1 through hyper-util's auto builder, and `Dockerfile` builds the image. |
| `UnitTests/` | The suite, which drives the application in process with warp's own `warp::test`. |
| `client-exception/` | How the corpus reads warp's error bodies. |
| `Cargo.toml` | One package: the library, the binary and the suite, each at its own path. |
| `Cargo.lock` | Every crate as resolved. |
| `askama.toml` | Where askama finds the template. |

There is no Client/, because warp writes no OpenAPI document without a third-party library, such as
utoipa.

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
| baseline | The handler returns a `&str`, which warp sends as text/plain. | warp |
| json | `warp::reply::json` of the payload, which serde_json writes from the `Serialize` the payload types derive. | warp and serde |
| middleware | `wrap_fn` no-op filters around the handler, four or sixteen of them, after the route's path. | warp |
| parameters, query | The `path!` and `query` filters, which convert the numbers to integers. | warp |
| headers | The `header` filter, once per header, which converts the account to an integer. | warp |
| body | The `body::json` filter binds the order. On the validate routes, the validator crate's rules run next and reject the body, and the recover handler answers 400 with validator's report. | validator |
| authorized | A filter on the route that compares the Authorization header with settings.json's bearer token and rejects any other, which the recover handler answers with 403. | by hand |
| cache | A store in front of each cache route's handler, over cached's `LruTtlCache` with a time to live, keyed by the headers the route varies on. | by hand, over cached |
| compressed | `compression::gzip` around the compressed routes when the request lists gzip, at zlib's default level. | warp |
| etag | A filter after the two routes' handlers that hashes the answer with SHA-1 and answers 304 when If-None-Match names it. | by hand |
| template | An askama template, compiled into the binary. | askama |
| items | One route per method on `/items/{id}`. The read route takes GET or HEAD, and hyper writes no body for HEAD. | warp |
| errors | warp's 404 and 405, the `body::json` filter's 400, and the handler's 404. | warp |
| cors | The `cors` filter on the `/cors` route, after its path. | warp |
| forms | The `body::form` and `multipart::form` filters. | warp |
| stream | `warp::reply::stream`, one row and its newline per chunk. | warp |
| sse | `warp::sse::reply`, one event per row. | warp |
| static | `fs::dir` over the payload directory, under `/static`. | warp |

## Notes

- warp tries the families one after another, in the order `lib.rs` combines them, until one
  takes the request. A route late in that order pays for every family before it rejecting the
  request, and a path no route matches pays for all of them. Each family's filter is boxed, as
  warp's routing example suggests for many routes, so each family tried also costs an allocation
  for its future.
- A filter that rejects for a reason other than the path is chosen over a route that did not
  match, so each route checks its path before anything else. With a method or a header first, a
  request for another path would be answered 405 or 400 instead of 404.
- warp answers a rejection nothing recovers with text, or with no body for a path no route
  matches. A rejected row reads the refusal as JSON, so the validation refusal follows warp's
  rejections example: a rejection of the application's own, answered by a recover handler with
  the example's ErrorMessage, `{code, message}`. The handler passes every other rejection along.
  The example also answers warp's own 404, 405 and body errors as JSON, which this port leaves as
  warp writes them.
- warp's `header::exact`, which warp's todos example guards a route with, answers a token that
  differs with 400. The 403 is the port's own filter and rejection.
- validator cannot stop at the first failing rule, so the first-error route is wired by hand. It
  checks the order's fields one at a time, in the order the order declares them, each against its
  rule in a struct of its own.
- validator's report names a field by its Rust name, such as `customer_id`. It puts each
  top-level field on a line of its own and runs the fields of a list entry together with no
  separator, as in `lines[0].product_id: ...]lines[0].qty: ...`.
- `compression::gzip` takes no level, so the compressed rows are at async-compression's default,
  zlib level 6, where the other frameworks here compress at their fastest. Read the gzip rows
  against the identity rows of this framework, not against another framework's.
- `compression::gzip` compresses everything it wraps, however small, and never reads
  Accept-Encoding. The route goes through it only when the request lists gzip with a weight above
  zero, and around it otherwise. It writes no `Vary: Accept-Encoding` either.
- warp's `get` filter matches GET alone. The read route on `/items/{id}` takes GET or HEAD, as
  warp's own `fs::dir` does, and hyper leaves the body of a HEAD answer unwritten.
- warp answers a path whose routes all refuse the method with 405 and no `Allow` header.
- A capture that does not convert to an integer is a route that does not match, so
  `/parameters/many/segment/literal` is a 404 rather than a 400.
- warp's `cors` filter writes no `Vary: Origin`, so `cors.vary` is skipped. It refuses a request
  from an origin the policy does not name with 403 and text, before the handler.
- warp's `sse::reply` writes `data:` with no space after the colon, which the event-stream format
  allows.
- warp sets no socket option on a connection it accepts, and the acceptor its server takes is
  sealed. `main.rs` sets TCP_NODELAY on the listening socket instead, which Linux copies onto
  every connection accepted from it, so the small writes of a streamed answer do not wait on
  Nagle's algorithm.
- The server is PID 1 in its container, and the kernel gives PID 1 no default action for SIGTERM.
  `main.rs` shuts the server down gracefully on it, so `docker stop` does not wait out its timeout.
- The no-op middleware is not boxed, so each of its filters is composed into the route's type as
  warp composes its own, rather than called through a pointer.
- The allocator is mimalloc, set as the global allocator in `main.rs`. A server of this shape
  allocates on every request, and the benchmark runs every Rust framework on the same allocator so
  that a difference between two of them is the framework.

## Refusals

A refusal the application raises itself is answered by its recover handler, in the form warp's
rejections example gives: `{"code": <status>, "message": <text>}`. `order.invalid` binds and breaks
every rule, so the validate routes reject it, and the recover handler answers 400 with validator's
report as the message, one line per field by its Rust name, such as
`customer_id: Validation error: range [...]`. The first-error route answers the same way, naming
the first field alone. A wrong bearer token is answered 403 with `FORBIDDEN` as the message.

Everything else is warp's own. A body that is not JSON never reaches the rules: the `body::json`
filter rejects it, and warp answers 400 with text, which is how `errors.malformed` is answered. A
path no route matches is 404 with no body, a method the path lacks is 405 with text, and a missing
row is the handler's 404 with no body.
