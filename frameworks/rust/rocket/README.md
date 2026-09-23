# Rocket

Rocket 0.5.1, the newest release, from May 2024, on tokio and hyper 0.14, answering the
RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Rocket routes by attributes on handler functions. What a handler takes from the request is a
guard: a request guard for anything in the head, a data guard for the body, and FromParam and
FromForm for the path and the query. A failed guard hands the request to the catcher for its
status. Fairings are Rocket's middleware and run on every request, so its documentation points
per-route work at guards. Rocket ships no compression, response cache, CORS or conditional
answers. Those families come from crates written for Rocket, and the response cache is written
by hand.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application: a library with one stage per corpus family under `routes/`, each mounting its routes on the one Rocket, and the server binary, `main.rs`. |
| `Implementation/templates/` | The template, which rocket_dyn_templates reads from disk when Rocket ignites. |
| `UnitTests/` | The suite, which drives the application in process with Rocket's local client. |
| `client-exception/` | How the corpus reads Rocket's error bodies. |
| `Cargo.toml` | One package: the library, the binary and the suite, each at its own path. |
| `Cargo.lock` | Every crate as resolved. |

There is no client project. Rocket writes no OpenAPI document without a third-party library, such
as okapi's rocket_okapi.

## Building, running and testing

```sh
cargo build --release
RB_PAYLOADS=../../../tests/payloads PORT=8080 target/release/server
cargo test
```

`RB_PAYLOADS` names the payload directory, which the server loads before Rocket ignites. `PORT`
defaults to 8080. `cargo test` reads `RB_PAYLOADS` too, and finds `tests/payloads` by walking up
from this directory when it is not set.

`template_dir` defaults to `Implementation/templates`, relative to the working directory. The
image copies the template to `/templates` and sets `ROCKET_TEMPLATE_DIR`, which Rocket reads as
`template_dir`.

The release profile is fat LTO with one codegen unit, as upstream measured every Rust framework.
The image build pays for it once.

Rocket builds its own tokio runtime, with one worker per core that num_cpus counts. num_cpus
reads the cgroup's CPU quota, so the container runs two workers under its two-CPU budget.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns a `&str`, which Rocket sends as text/plain. | Rocket |
| json | The handler returns `Json` of the payload, which serde_json writes from the `Serialize` the payload types derive. The payloads are Rocket's managed state, reached through the `State` guard. | Rocket and serde |
| middleware | Four or sixteen no-op request guards, which Rocket resolves one after another before the handler. | Rocket |
| parameters, query | `<segment>` captures bound by `FromParam`, `?<page>` bound as an integer and `?<search..>` bound into a struct by `FromForm`. | Rocket |
| headers | A request guard of this application's own reads the three headers, because Rocket has no header binder. | by hand |
| body | `Json` binds the order. On the validate routes, rocket-validation's `Validated` guard runs the validator crate's rules after `Json` has bound the body, fails with 422, and its catcher answers with validator's errors as JSON. | rocket-validation and validator |
| authorized | A request guard that fails with 403 unless Authorization is settings.json's bearer token. | Rocket |
| cache | A `Handler` wrapped around each cache route's own, which answers from an LRU with a time to live before that handler runs, keyed by the path and the headers the route varies on. | by hand, over cached |
| compressed | rocket_async_compression's `Compress` responder around the answer, gzip at its fastest level. | rocket_async_compression |
| etag | rocket-etag-if-none-match's guard reads If-None-Match, and the handler hashes the body with entity-tag's XXH3 and answers 304 when the tag matches. | rocket-etag-if-none-match and entity-tag |
| template | A Tera template rendered by rocket_dyn_templates, Rocket's own view layer. | rocket_dyn_templates |
| items | One route per method on `/items/<id>`. Rocket answers HEAD with the GET route and strips the body, and `uri!` builds the created item's Location. | Rocket |
| errors | Rocket's default catchers answer 404, and 400 for a body `Json` cannot parse. A handler that answers `None` is a 404. | Rocket |
| cors | rocket_cors in its request-guard mode, with its catch-all OPTIONS route mounted under `/cors`. | rocket_cors |
| forms | The `Form` data guard, with `TempFile` for the upload's file. | Rocket |
| stream | `ByteStream`, one row and its newline per item, under the application/x-ndjson type. | Rocket |
| sse | `EventStream`, one event per row. | Rocket |
| static | `FileServer` over the payload directory, mounted at `/static`, its handler wrapped to add Last-Modified. | Rocket |

## Notes

- Rocket reads its address and port only from its own configuration, Rocket.toml or `ROCKET_`
  variables, and listens on 127.0.0.1 unless told otherwise. `main.rs` merges `0.0.0.0` and
  `PORT` into it.
- Rocket has no per-route middleware. A fairing runs on every request and cannot answer one, so
  the middleware rows are no-op request guards, which is where Rocket's documentation sends
  per-route work. Each guard is an async call that allocates its future.
- Nothing in Rocket can answer before a handler except another handler, so the cache wraps the
  handler each cache route's attribute generates in a `Handler` of its own. It has to read a
  fresh answer's body to store it and write it back.
- rocket-validation 0.2, the crate that joins validator to Rocket, pins validator 0.16. That
  validator keys an error by a field's Rust name, `customer_id`, unless the field has a serde
  rename of its own, and never reads the struct's `rename_all`. validator cannot stop at the
  first failing rule, so the first-error route's body implements `Validate` by hand, one field
  at a time, and goes through the same `Validated` guard.
- Every refusal except the validator's comes from Rocket's default catchers, which answer with an
  HTML page unless the request's Accept header prefers JSON. The corpus's requests send none, so
  its malformed body, wrong token and missing path get HTML.
- Rocket routes on the method and the path together and never answers 405. A method a path has
  no route for gets the same 404 as a path with no route.
- A path segment that is not an integer fails its `FromParam` guard, which Rocket answers with
  422, not 404.
- Rocket's Shield fairing is on by default and adds `X-Content-Type-Options`, `X-Frame-Options`
  and `Permissions-Policy` to every answer. Every answer also carries `Server: Rocket`.
- `FileServer` sends no Last-Modified and no ETag. The static route's handler is wrapped to add
  Last-Modified from the file's modification time.
- rocket_cors writes `Vary: Origin` only when it allows every origin and echoes the one that
  asked, so the policy's one origin is answered with no Vary, and cors.vary is skipped. Its
  fairing mode puts the policy on every route, so the port uses its request-guard mode, whose
  preflight route is a catch-all OPTIONS route mounted under `/cors`.
- rocket_async_compression's `Compress` responder compresses a body of any size, so the small
  compressed row is gzipped too, and it prefers brotli when a request accepts both. It sends no
  `Vary: Accept-Encoding`.
- `TempFile` writes every uploaded file to a temporary file, created on a blocking thread, before
  the handler runs. `TempFile::name()` drops everything from the first dot, so the handler echoes
  the name the client sent through `dangerous_unsafe_unsanitized_raw()`.
- `EventStream` sends a heartbeat comment every 30 seconds by default, and its first tick fires at
  once, so every answer carries one `:` comment line among its events.
- `Template::render` converts the context into a figment value when it is called, and Tera converts
  that into its own context when the answer is written, so the payload is copied twice before it
  is rendered.
- Rocket writes Content-Length whenever it knows the body's size, so every 304 carries
  `Content-Length: 0`. RFC 9110 section 8.6 allows the header on a 304 only when it is the length
  the 200 would have sent.
- Rocket sets TCP_NODELAY on every connection it accepts, and stops gracefully on SIGTERM by
  default, so `main.rs` does neither. A release build logs nothing below critical.
- The allocator is mimalloc, set as the global allocator in `main.rs`, as for every Rust
  framework here.

## Refusals

Every refusal is what Rocket or the crate on the route writes. Nothing reshapes it. `order.invalid`
binds and breaks every rule, so rocket-validation's guard fails with 422 and its catcher answers
`{"code":422,"message":...,"errors":...}`, where `errors` is validator's `ValidationErrors`: an
object keyed by each field's Rust name, such as `customer_id`, holding the rules it broke, with a
list entry's errors under its index. The first-error route answers the same way, naming the first
field alone. A body that is not JSON never reaches the rules. `Json` fails it with 400, and Rocket's
default catcher answers with its HTML page, as it answers a missing row, a path with no route, a
method a path lacks and a wrong bearer token.
