# Salvo

Salvo 0.96.0 on tokio 1.53 and hyper 1, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

Salvo is a web framework built on hyper and tokio. Its routes are a tree of routers, each matching
a path and a method, and its middleware is a handler hooped onto a router, which then runs for every
route under that router. Salvo ships most of what the families reach for behind features of its
own: compression, CORS, caching headers, a response cache, static files and server-sent events.
Validation comes from the validator crate, because Salvo has none, and the bearer-token check is
written by hand.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application: a library with one router per corpus family under `routes/`. |
| `container-h1/` | How container-h1 starts it. `main.rs` is the server binary, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.rs` is the server binary, on salvo's `http2-cleartext` feature, with which its TCP acceptor answers HTTP/2 with prior knowledge beside HTTP/1.1, and `Dockerfile` builds the image. |
| `UnitTests/` | The suite, which drives the service in process with Salvo's `TestClient`. |
| `client-exception/` | How the corpus reads Salvo's error bodies. |
| `Cargo.toml` | One package: the library, the binary and the suite, each at its own path. |
| `Cargo.lock` | Every crate as resolved. |
| `askama.toml` | Where askama finds the template. |

There is no `Client/`. Salvo writes an OpenAPI document only for handlers written with salvo-oapi's
`#[endpoint]` in place of `#[handler]`, and changing how the routes are written for the document is
ruled out.

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
| baseline | The handler returns a `&'static str`, which Salvo writes as text/plain. | Salvo |
| json | The handler returns `Json` of the payload, which serde_json writes from the `Serialize` the payload types derive. | Salvo and serde |
| middleware | No-op handlers hooped onto the route's router, four or sixteen of them. | Salvo |
| parameters, query | `parse_params` and `parse_queries`, which bind the captures and the query string into a struct, the numbers as integers. | Salvo |
| headers | `parse_headers`, which binds the three headers into a struct by their names. | Salvo |
| body | `parse_json` binds the order. On the validate routes the handler then runs the validator crate's rules and refuses with 422 and Salvo's RFC 9457 problem details, validator's errors as their `errors` member. | validator and Salvo |
| authorized | A hoop on the route that answers Salvo's 403 unless Authorization is settings.json's bearer token. | by hand |
| cache | salvo-cache's `Cache` hoop on each cache route, over a `MokaStore` with a time to live, keyed by Salvo's `RequestIssuer` and, on a vary route, the headers it varies on. | Salvo |
| compressed | The `Compression` hoop on the compressed routes, gzip at its fastest level and its default threshold. | Salvo |
| etag | The `CachingHeaders` hoop on the two routes, which hashes the answer with xxh3 and answers 304 when If-None-Match names it. | Salvo |
| template | An askama template, compiled into the binary. | askama |
| items | One router on `/items/{id}` with a goal per method. The read handler is registered for HEAD as well, and Salvo strips the body of its answer. | Salvo |
| errors | Salvo's 404 and 405, each as its default error page, `parse_json`'s 400, and the handler's 404. | Salvo |
| cors | salvo-cors's `Cors` hoop on the `/cors` route, with an OPTIONS goal so that the preflight matches it. | Salvo |
| forms | `parse_form` and `form_data`. | Salvo |
| stream | `Response::stream`, one row and its newline per chunk. | Salvo |
| sse | `sse::stream`, one event per row. | Salvo |
| static | `StaticDir` over the payload directory, under `/static`. | Salvo |

## Notes

- Salvo takes a handler as a function or as a struct, never as a closure. The handlers that answer
  a payload are structs holding a `&'static` reference to it, rather than reading it from the
  `Depot` through affix-state, which would insert it into the `Depot` of every request.
- Salvo tries a router's children in the order they were pushed and takes the first that matches.
  Each family is one child of the root, in alphabetical order, so a request pays for a path check
  on every family router pushed before its own, and `errors.unmatched` pays for all of them.
- Salvo answers an error the handler wrote no body for with its default error page, in the format
  the request's Accept header names. The corpus's requests name none, so a 404, a 405, a 403 and a
  body that is not JSON are each answered with an HTML page of about 900 bytes.
- A 405 carries no Allow header, which RFC 9110 requires of it.
- Salvo matches HEAD only to a route registered for HEAD. `/items/{id}` registers its read handler
  for HEAD beside GET, and Salvo strips the body of the answer to HEAD.
- A refusal written as Salvo's `StatusError` goes out as the default error page, HTML to a request
  with no Accept and without its detail in a release build, so it cannot name the fields the corpus
  reads. The validate routes refuse with Salvo's RFC 9457 `Problem` instead, as
  application/problem+json with status 422, as Salvo's documentation of `Problem` shows a
  validation failure. `Problem` needs Salvo's `rfc9457` feature.
- validator cannot stop at the first failing rule, so the first-error route is wired by hand. It
  checks the order's fields one at a time, in the order the order declares them, each against its
  rule in a struct of its own.
- salvo-cache stores no answer that carries a Vary header, because its store does not compare the
  headers Vary names when it looks an answer up. The vary routes put those headers in the key
  through a `CacheIssuer`, and a hoop outside the cache writes Vary once the cache has stored the
  answer or replayed it.
- salvo-cors takes one origin given as a string as an exact origin, and writes it on every answer,
  whoever asks, as tower-http's CORS layer does. The CORS hoop is given a list of one, as Salvo's
  CORS example gives its origins.
- Salvo's CORS documentation hoops the handler on the whole service, because a router's hoops run
  only for a route that matches and a preflight matches none. The `/cors/small` router has an
  OPTIONS goal, Salvo's empty handler, so the preflight matches it and the policy stays on `/cors`.
  salvo-cors answers the preflight with 204 and writes `Vary: origin`,
  `access-control-request-method` and `access-control-request-headers` as three header lines on
  every answer from the route.
- `form_data` writes each uploaded file to a temporary directory of its own and removes it when
  the part is dropped, so every `forms.multipart` request creates and deletes a file and a
  directory.
- Salvo's gzip at its default level is already flate2's fastest level, and its default threshold
  leaves a body under 1024 bytes alone, so `compressed.gzip_small` is answered uncompressed.
- The ETag Salvo writes is the body's length and its xxh3 hash, and its 304 keeps the Content-Type
  of the answer it replaces.
- `StaticDir` also writes `content-disposition: inline`, `x-content-type-options: nosniff`, an
  ETag of its own and `accept-ranges: bytes`.
- Salvo's `TcpListener` leaves TCP_NODELAY at the operating system's default, which is off, and has
  no setting for it, so the small writes of a streamed answer can wait on Nagle's algorithm.
  `main.rs` builds the listening socket with tokio's `TcpSocket` with TCP_NODELAY set, which Linux
  copies to every connection it accepts, and hands it to Salvo as a `TcpAcceptor`.
- The server is PID 1 in its container, and the kernel gives PID 1 no default action for SIGTERM.
  Salvo installs no handler, so `main.rs` installs one, as Salvo's graceful-shutdown example does,
  and stops the server gracefully on it, so `docker stop` does not wait out its timeout.
- The allocator is mimalloc, set as the global allocator in `main.rs`. A server of this shape
  allocates on every request, and the benchmark runs every Rust framework on the same allocator so
  that a difference between two of them is the framework.
- Salvo implements no lambda-emulator. Salvo ships no Lambda adapter, and none is published for
  it. lambda_http runs a tower service, and Salvo's `tower-compat` feature converts only the other
  way, a tower service into a Salvo handler.

## Refusals

Every refusal but the validate routes' is what Salvo writes. `order.invalid` binds and breaks every
rule, so the validate route refuses it with 422 and Salvo's problem details:
`{"type":"about:blank","title":"Unprocessable Entity","status":422,"errors":{...}}`, where `errors`
is validator's `ValidationErrors`, an object keyed by each field's Rust name, such as `customer_id`,
holding the rules it broke, with a list entry's errors under its index. The first-error route
answers the same way, naming the first field alone. A body that is not JSON never reaches the
rules. `parse_json` refuses it with 400, which Salvo writes as its default error page. A missing
row, a path with no route, a method the path lacks and a wrong bearer token are each answered with
their status and the same page.
