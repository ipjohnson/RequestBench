# actix-web

actix-web 4.15.0 on actix-rt and tokio 1.53, answering the RequestBench corpus. The contract every
route follows is [`frameworks/openapi.json`](../../openapi.json).

actix-web is the actix project's web framework. An App is a tree of scopes and resources, each
resource a set of routes whose handlers take extractors, and everything around a handler is
middleware wrapped around a resource, a scope or the App. HttpServer runs one App per worker
thread, each worker on a single-threaded runtime of its own. Every feature a family reaches for
comes from actix-web, from a crate of the actix project, or from a crate written for actix-web
where neither has one. The cache family is wired by hand.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application: a library with one module per corpus family under `routes/`, each adding its routes to the App's ServiceConfig. |
| `container-h1/` | How container-h1 starts it. `main.rs` is the server binary, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.rs` is the server binary, on `HttpServer::bind_auto_h2c`, which answers HTTP/2 with prior knowledge beside HTTP/1.1, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `main.rs` is the function, which hands the App to lambda-web's `run_actix_on_lambda`, and `Dockerfile` builds it on the `provided.al2023` base image, where it runs as `/var/runtime/bootstrap`. |
| `UnitTests/` | The suite, which drives the App in process with actix-web's test utilities. |
| `client-exception/` | How the corpus reads actix-web's error bodies. |
| `Cargo.toml` | One package: the library, each host's binary and the suite, each at its own path. |
| `Cargo.lock` | Every crate as resolved. |
| `askama.toml` | Where askama finds the template. |

There is no client project. actix-web writes no OpenAPI document about its own routes without a
third-party library, such as utoipa or apistos.

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

HttpServer starts one worker thread per core that `std::thread::available_parallelism` reports.
That reads the cgroup's CPU quota and the cores the container is placed on, so the container runs
two workers under its two-CPU budget, whichever way the budget is set. Each worker builds its own
App from the function `routes` returns.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns a `&str`, which actix-web sends as text/plain. | actix-web |
| json | The handler returns `Json` of the payload, which serde_json writes from the `Serialize` the payload types derive. | actix-web and serde |
| middleware | `from_fn` no-op middleware wrapped around the route's resource, four or sixteen times. | actix-web |
| parameters, query | The `Path` and `Query` extractors, which bind into a struct and convert the numbers to integers. | actix-web |
| headers | The `Header` extractor, over an implementation of actix-web's `Header` trait for each of the three headers. | actix-web |
| body | `Json` binds the order. On the validate routes, an extractor written here parses it with actix-web's `JsonBody` and runs the validator crate's rules first, refusing with 400 and validator's errors as JSON. | validator, and an extractor by hand |
| authorized | actix-web-httpauth's bearer middleware on the resource, whose validator answers 403 unless the token is settings.json's. | actix-web-httpauth |
| cache | A `from_fn` middleware written here, around each cache route's resource, over a `cached` LRU with a time to live, keyed by the path and the headers the route varies on. | by hand |
| compressed | `Compress` around the /compressed scope, gzip at flate2's fast level. | actix-web |
| etag | actix-middleware-etag's `Etag` around the /etag scope, which hashes the answer with xxh3 and answers 304 when If-None-Match names it. | actix-middleware-etag |
| template | An askama template, compiled into the binary. | askama |
| items | One resource at `/items/{id}` with a route per method, HEAD among them. | actix-web |
| errors | The App's 404 and the resource's 405, both with no body, the `Json` extractors' 400, and the handler's 404. | actix-web |
| cors | actix-cors's `Cors` around the /cors scope. | actix-cors |
| forms | `Form` binds the urlencoded body, and actix-multipart's derived `MultipartForm` reads the upload. | actix-web and actix-multipart |
| stream | A streaming body, one row and its newline per chunk. | actix-web |
| sse | actix-web-lab's `Sse` responder, one event per row. | actix-web-lab |
| static | actix-files' `Files` over the payload directory, mounted at `/static`. | actix-files |

## Notes

- The routes capture the payloads in their closures rather than reading them from actix-web's app
  data. The payloads are loaded once and kept for the life of the process, so each handler holds a
  `&'static` reference to them.
- HttpServer builds one App per worker thread, so whatever the App builds is per worker. The
  response cache's stores are made once, outside the App, and every worker's App shares them
  through an `Arc`. A store made inside would replay only what its own worker had stored.
- Each registration keeps the route literal and the method on one line, even where rustfmt would
  break it, because the snippet finder reads the method from the path's own line. The code is not
  run through rustfmt. Routes registered on a scope name a path relative to it, so they carry a
  mark.
- `web::get()` matches GET alone, and actix-web answers HEAD only where a route names it. The
  `/items/{id}` resource has a HEAD route onto the GET handler. The HTTP/1 codec leaves the body
  unwritten and sends the Content-Length it would have had.
- A route registered with `route` on the App or a ServiceConfig is a resource of its own with the
  method guard on the resource, so a method no route has falls through to the App's 404.
  `/items/{id}` is one resource with a route per method, which answers such a method with 405 and
  an Allow header instead.
- actix-web has no validation of its own. actix-web-validator, the crate that adds it, needs
  validator 0.20 in its newest release, 7.0.0, so the validate routes use an extractor written here
  over validator 0.21.
- validator cannot stop at the first failing rule, so the first-error route is wired by hand. It
  binds the order with actix-web's own `Json`, checks the fields one at a time, in the order the
  order declares them, each against its rule in a struct of its own, and refuses as the validate
  routes refuse.
- The validate routes' extractor takes a body of up to 32 KiB, where actix-web's own `Json` on the
  bind routes takes 2 MiB. The largest order the corpus sends is under 9 KB.
- actix-web's `Path` extractor answers a capture that does not convert with 404, and its `Header`
  extractor answers a header that does not parse with 400.
- actix-web-httpauth's bearer middleware refuses a request with no Authorization header itself,
  with 401 and `WWW-Authenticate: Bearer`, before the validator runs. The validator is the port's
  own code, and it refuses a wrong token with 403 and a line of text.
- `Compress` takes no level: actix-http gzips at flate2's fast level, which is 1. It compresses a
  body of any size, so compressed.gzip_small's 123 bytes arrive as 126 gzipped bytes. It compresses
  a body of 1 KiB or more on the blocking thread pool rather than on the worker, and a compressed
  answer goes out chunked, with no Content-Length.
- `Compress` writes `Vary: accept-encoding` only on an answer it compressed, so an identity answer
  does not say that it varies on Accept-Encoding.
- actix-middleware-etag writes a weak tag, `W/"<length in hex>-<xxh3 in base64>"`. It answers a
  match with a 304 that replaces the whole answer, so the 304 carries no ETag, although RFC 9110
  asks a 304 to carry the ETag a 200 would have. It compares If-None-Match with the tag as one
  string, so a list of several tags never matches.
- actix-cors writes `Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers`
  on every answer through the scope, and refuses a preflight from an origin it does not allow with
  400 and a line of text.
- actix-files reads a file in chunks on the blocking thread pool, as it reads every file by
  default. It sends an ETag and a Content-Disposition beside the Last-Modified the corpus checks.
- actix-web may answer before it has read a request's body, and closes the connection when it
  does, as it does for a 405 to a POST that carries a body. The corpus's wrong-method request
  carries none.
- actix-web-lab's `Sse` writes `Content-Encoding: identity` and `Cache-Control: no-cache` on the
  stream.
- actix-web leaves TCP_NODELAY at the operating system's default, which is off, so the small writes
  of a streamed answer can wait on Nagle's algorithm. `main.rs` turns it on with HttpServer's
  `tcp_nodelay`.
- The server is PID 1 in its container, and the kernel gives PID 1 no default action for SIGTERM.
  actix-server installs a handler of its own that starts a graceful shutdown, so `main.rs` needs
  none, and `docker stop` returns in about half a second.
- The allocator is mimalloc, set as the global allocator in `main.rs`. A server of this shape
  allocates on every request, and the benchmark runs every Rust framework on the same allocator so
  that a difference between two of them is the framework.
- On lambda-emulator the App answers behind lambda-web 0.2.1, the newest release, from January
  2023. The actix project ships no Lambda adapter, and lambda-web's `actix4` feature is the one
  written for actix-web. lambda-web pins lambda_runtime 0.7, where axum's function runs
  lambda_runtime 1.4. It builds each request with actix-web's `test::TestRequest` and calls the
  service of one App, where HttpServer builds an App per worker.
- `run_actix_on_lambda` reads the whole answer into one proxy response, so the sse and stream tests
  are listed as unsupported on lambda-emulator.
- lambda-web posts every body in base64, text included. It keeps one value of each header, the
  last the App wrote, except Set-Cookie, whose values go in the proxy response's cookies.
- lambda-web's default feature, br, brotli-compresses a text answer the App did not compress when
  the request accepts br. It is off, so every answer is the App's own.
- lambda-web posts the row the HEAD route answers with, which the HTTP/1 codec leaves unwritten. A
  Function URL's caller reads no body in an answer to HEAD, so nothing reads it.
- The function is built on the Lambda base image it runs on. Amazon Linux 2023's glibc is older
  than the one in the rust images, and a binary linked against a newer glibc may not start on it.

## Refusals

Every refusal but those of the validate routes is what actix-web or the middleware on the route
writes. actix-web has no validation of its own, so the extractor written for those routes answers a
broken rule with 400 and validator's `ValidationErrors` as JSON. That is an object keyed by each
field's Rust name, such as `customer_id`, holding the rules it broke, with a list entry's errors
under its index. `order.invalid` binds and breaks every rule, so it is refused naming all three
fields. The first-error route answers the same way, naming the first field alone. A body that is not
JSON never reaches the rules. The extractor refuses it with a 400 whose body is `Payload error:` and
actix-web's message as text, with no Content-Type, which is how `errors.malformed` is answered. A
missing row and a path with no route are answered with 404 and no body, a method `/items/{id}` has
no route for with 405, and a wrong bearer token with 403 and a line of text.
