# Fiber

Fiber 3.5.0 on Go 1.27, answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Fiber is a Go web framework modelled on Express, served by fasthttp rather than net/http. A
handler is a `func(fiber.Ctx) error`, and a middleware is a handler that calls `c.Next()`, so a
route's chain is the app's and its group's middleware followed by the handlers the route is
registered with. Fiber ships its own binder, and middleware for compression, CORS, ETags, a
response cache, static files and server-sent events. Every family reaches for one of those, or is
written for the family where Fiber has none.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `router.go` builds the app, a function in a file named for each family registers that family's routes, and `cmd/server` is the main package that loads the payloads and serves. |
| `Implementation/views/` | The template, compiled into the binary. |
| `UnitTests/` | go test tests of the wiring, sending each request over HTTP to the app served on a loopback port. |
| `client-exception/` | How the corpus reads Fiber's error bodies. |
| `go.mod` | The module, and every module version the build selects. |
| `go.sum` | The hash of each of those modules, which the build checks. |

There is no client, because Fiber writes no OpenAPI document of its own.

## Building, running and testing

```sh
go build -o server ./Implementation/cmd/server
RB_PAYLOADS=../../../tests/payloads PORT=8080 ./server
go test ./...
```

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080. The suite reads `RB_PAYLOADS` too, and without it finds
`tests/payloads` by walking up from the working directory. Each test is a subtest named for the
corpus id it covers, so `go test ./UnitTests -run '/json.small'` runs one.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `c.SendString` | Fiber |
| json | `c.JSON` encodes the payload with the app's JSONEncoder, encoding/json's `Marshal` by default. | Fiber |
| middleware | No-op handlers ahead of the handler in the route's chain, each calling `c.Next`. | Fiber |
| parameters, query, headers | `c.Bind().URI`, `c.Bind().Query` and `c.Bind().Header` fill a struct from its `uri`, `query` and `header` tags, each value converted to its field's type. | Fiber |
| body | `c.Bind().Body` decodes the order by its Content-Type and runs the app's StructValidator, go-playground's validator behind the adapter Fiber's validation guide registers. | Fiber, go-playground/validator |
| authorized | A middleware on the route compares the bearer token and returns `fiber.ErrForbidden` for any other. | by hand |
| cache | Fiber's cache middleware in front of each cache route, with one store for the process. | Fiber |
| compressed | Fiber's compress middleware on the two `/compressed` routes, at its fastest level. | Fiber, fasthttp |
| etag | Fiber's etag middleware on the two `/etag` routes. | Fiber |
| template | `c.Render` through the app's Views, gofiber/template's html engine over the embedded template. | gofiber/template |
| items | One route per method on `/items/:id`, the id bound with `c.Bind().URI`. HEAD is answered by the GET route. | Fiber |
| errors | The default error handler's 404, 405 and 500, and `fiber.ErrNotFound` for a missing row. | Fiber |
| cors | Fiber's cors middleware on the `/cors` group. | Fiber |
| forms | `c.Bind().Form` fills the form tags from a urlencoded or a multipart body, the file part as a `*multipart.FileHeader`. | Fiber |
| stream | `c.SendStreamWriter`, writing and flushing one row per line. | Fiber, fasthttp |
| sse | Fiber's `sse` handler, sending each row as one event. | Fiber |
| static | Fiber's static middleware on a wildcard route, over fasthttp's file server. | Fiber, fasthttp |

## Notes

- Fiber serves fasthttp, not net/http. fasthttp sends a body it holds in full with its
  Content-Length, so `json.large` goes out with its length where a net/http framework chunks it.
  It writes the Date header from a value it refreshes once a second.
- The app runs Fiber's recover middleware and nothing else on every route, because Fiber recovers
  from no panic by default.
- Fiber tries a method's routes in the order they were registered, so the static parameters
  route is registered before the capture that also matches its path.
- Fiber registers a HEAD route beside every GET route, running the same handlers, unless the
  config sets `DisableHeadAutoRegister`. So the read route answers `items.head`, and every GET
  route in the app answers HEAD.
- The app's StructValidator runs on every struct `c.Bind()` fills, the uri, query, header and form
  structs and the bind rows' order included, although none of them carries a rule.
- `c.Bind()` returns a decode or conversion failure as a `*fiber.BindError`, which carries no
  status. Returned as the validation guide returns it, the default error handler answers it with
  500 and the error's text. `c.Bind().WithAutoHandling()` would answer 400 instead.
- The validation guide's answer names a field by go-playground's `Field()`, its own name without
  the path to it, so a line's `qty` is named `qty`.
- Fiber's keyauth middleware answers a wrong key with 401 and `Missing or invalid API Key`, and
  the corpus asks for 403, so the token check is a middleware written for the route.
- The cache middleware partitions every entry on the request's Accept, Accept-Encoding and
  Accept-Language by default, and on the request headers a stored answer's Vary names. The vary
  routes write Vary, and that is what keys them.
- The cache is sized in bytes, 1 MB by default, so settings.json's capacity in entries has no
  setting to go to. It keeps no body larger than the limit, and drops the entries nearest their
  expiry to make room.
- The cache honours a request's Cache-Control: `no-cache` skips a stored answer, and `max-age`,
  `min-fresh` and `only-if-cached` are read too. It shares no entry with a request that carries
  Authorization. Every answer it passes carries `Age` and `X-Cache`, `hit` or `miss`, and a hit
  adds `Cache-Control: public, max-age=` the seconds left.
- The compress middleware hands the answer to fasthttp, which compresses no body shorter than 200
  bytes, so `compressed.gzip_small` goes out uncompressed. fasthttp prefers brotli, then gzip,
  deflate and zstd, whichever the request accepts. The middleware adds `Vary: Accept-Encoding` to
  every answer on its routes, compressed or not.
- The etag middleware tags a body with its length and its CRC-32, as `"<length>-<checksum>"`, a
  strong tag. A 304 keeps the Content-Type and every header the handler wrote.
- The cors middleware answers a preflight with 204. A preflight from an origin the policy does
  not name gets 204, `Access-Control-Allow-Methods`, `-Allow-Headers` and `-Max-Age` too, and no
  `Access-Control-Allow-Origin`, which is what stops the browser. A request under `/cors` with no
  Origin gets `Vary: Origin`.
- The sse handler writes a comment every 15 seconds while a stream is open, from a goroutine of
  its own. It abandons the request's context, which Fiber then never returns to its pool.
- The static middleware hands each file to fasthttp's file server, which keeps a file open for 10
  seconds after its last use. It sends Content-Length and Last-Modified, and no ETag.
- The html engine parses the template when the app is built, and `c.Render` renders into a
  buffer, which goes out with its length.
- The server is one process. Fiber's prefork, which would start a child process per CPU, is off
  by default. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under the
  orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports.
- The server is PID 1 in its container. Fiber installs no handler for SIGTERM, and the Go runtime
  ends the process on it at once, with no graceful shutdown.
- A struct tag such as `json:"items"` reads as the route literal `/items`, so the items routes
  carry `rb:handler` marks.

## Refusals

Fiber's default error handler answers an error a handler returns as text/plain: the status of a
`*fiber.Error`, or 500 for any other error, with the error's text. Step 4 of Fiber's validation
guide answers a failed validation itself, and every route here does the same. Nothing reshapes
either.

- A body that breaks the rules is 400 with one entry per rule it breaks, holding go-playground's
  field and tag, such as `{"errors":[{"field":"customerId","rule":"gt"}]}`. The validator names a
  field by its json name, the name the client sent, through the hook go-playground offers for
  that.
- go-playground reports every rule a body breaks and has no setting to stop at the first, so
  `/body/validate/first-error` binds the order with `SkipValidation(true)`, then runs the same
  validator over one field at a time, in the order `CheckedOrder` declares them, and answers the
  first failure in the same shape.
- A body that is not JSON is a `*fiber.BindError`, which the default error handler answers with
  500 and its text, such as `bind from body: unexpected end of JSON input`.
- A path no route matches is 404 with `Not Found`. A method a path has no route for is 405 with
  `Method Not Allowed` and an `Allow` header naming the methods it has.
- A missing row is `fiber.ErrNotFound`, 404 with `Not Found`, and a wrong token
  `fiber.ErrForbidden`, 403 with `Forbidden`.
