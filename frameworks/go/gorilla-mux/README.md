# gorilla/mux

gorilla/mux 1.8.1 on Go 1.27, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

gorilla/mux is a request router for net/http, part of the Gorilla web toolkit. A route matches on
a path template and on any mix of method, host, header and query matchers, and routes are tried in
the order they were registered. A handler is an `http.Handler`, and a middleware is a
`mux.MiddlewareFunc` that belongs to a router or a subrouter. mux binds and renders nothing. The
toolkit's `handlers` package has CORS, compression and recovery, and its `schema` package decodes
form values into structs. Each family uses one of those where it can, net/http where they have
nothing, and code written for the family where neither does.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `router.go` builds the router, and a function in a file named for each family registers that family's routes. |
| `Implementation/views/` | The template, compiled into the binary. |
| `container-h1/` | How container-h1 starts it. `main.go` is the main package that loads the payloads and serves over HTTP/1.1, and `Dockerfile` builds the image. |
| `UnitTests/` | go test tests of the wiring, sending each request to the router served by `net/http/httptest`. |
| `client-exception/` | How the corpus reads the error bodies. |
| `go.mod` | The module, and every module version the build selects. |
| `go.sum` | The hash of each of those modules, which the build checks. |

There is no client, because mux writes no OpenAPI document of its own.

## Building, running and testing

```sh
go build -o server ./container-h1
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
| baseline | The handler writes the text after setting text/plain. | net/http |
| json | encoding/json's encoder writes the payload after the handler sets `application/json`, as mux's README writes JSON. | encoding/json |
| middleware | No-op `mux.MiddlewareFunc` layers on a subrouter of the route's own path, which mux wraps around the matched handler. | mux |
| parameters | `mux.Vars` reads each capture as a string, and strconv converts it. | mux |
| query | gorilla/schema decodes the query string into a struct, converting the numbers. | gorilla/schema |
| headers | The values net/http parsed, the account converted with strconv. | net/http |
| body | encoding/json decodes the order. On the validate routes go-playground's validator checks the `validate` tags. | encoding/json, go-playground/validator |
| authorized | A middleware on the `/authorized` subrouter compares the bearer token and refuses any other with `http.Error` and 403, as mux's README writes its authentication middleware. | by hand |
| cache | A middleware on a subrouter in front of each cache route replays a stored answer, or stores what the handler wrote. | by hand |
| compressed | gorilla/handlers' `CompressHandlerLevel` on the `/compressed` subrouter, at gzip's fastest level. | gorilla/handlers |
| etag | A middleware on the `/etag` subrouter holds back the body, hashes it with SHA-1, and answers 304 when `If-None-Match` names the hash. | by hand |
| template | html/template, embedded with `go:embed`, parsed once, and executed into the response. | html/template |
| items | One route per method on `/items/{id}`. The read route names GET and HEAD. | mux |
| errors | The router's 404 and 405, the decoder's 400, and net/http's `NotFound` for a missing row. | mux, net/http |
| cors | gorilla/handlers' `CORS` on the `/cors` subrouter. | gorilla/handlers |
| forms | net/http parses the two bodies, and gorilla/schema decodes their values. | net/http, gorilla/schema |
| stream | encoding/json's encoder writes each row and its newline, and net/http's `ResponseController` flushes it. | net/http |
| sse | Each row written as the data of one event and flushed, by hand. | by hand |
| static | net/http's `FileServer` under a path prefix, exactly as mux's README serves static files. | net/http |

## Notes

- gorilla/mux 1.8.1 and gorilla/handlers 1.5.2 are from October 2023, and neither has a release
  since.
- The router is wrapped whole in gorilla/handlers' `RecoveryHandler`, as the handlers package's
  documentation wraps a router, so a panic is answered 500.
- mux keeps a router's middlewares apart from its routes and wraps them around the matched
  handler on every request. A layered route pays for building its chain each time it is asked.
- A middleware belongs to a router, so each layered route in the middleware family is a subrouter
  of its own path, and each scoped family is a subrouter of its prefix.
- mux runs a router's middlewares only for a request one of its routes matched. A preflight is an
  OPTIONS request, so the `/cors` route names OPTIONS beside GET, and gorilla/handlers' CORS
  answers the preflight before the handler runs.
- gorilla/handlers' CORS writes `Vary: Origin` only when the policy allows more than one origin.
  settings.json names one, so the answer does not say it varies by origin, and rb.json skips
  `cors.vary`.
- gorilla/handlers' CORS answers a preflight from an origin it does not allow with 200 and no
  CORS header. It lists the requested header in canonical form, `X-Rb-Tenant`, and writes no
  `Access-Control-Allow-Methods` for GET, which CORS always allows.
- A method a path has no route for is answered 405 with no body and no `Allow` header, which RFC
  9110 requires a 405 to carry.
- `CompressHandlerLevel` gzips every answer to a request whose Accept-Encoding names gzip, whatever
  its type or size. It makes a new gzip writer for each answer and pools none, and it adds
  `Vary: Accept-Encoding` to every answer, compressed or not.
- mux has no JSON writer, so every JSON answer is written by encoding/json's encoder and ends with
  a newline.
- gorilla/schema refuses a query or form key its struct does not name, which is its default.
- mux answers HEAD only where a route names it, so the read route on `/items/{id}` names GET and
  HEAD.
- mux answers a path that is not in its clean form, such as one with a doubled slash, with a 301
  to the clean path.
- mux tries routes in the order they were registered. The static parameters route comes before
  the one with a capture, and the two vary cache routes come before the `/cache` prefix, which
  matches them too.
- mux and the gorilla toolkit compute no ETag and store no answers, and net/http computes an ETag
  for nothing but a file, so the etag and cache families' middlewares are written for them. The
  store is sized in entries and aged by settings.json, and a full store drops whichever entry the
  map yields first.
- The server is one process. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under
  the orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports.
- The server is PID 1 in its container. The Go runtime installs its own handler for SIGTERM, so
  `docker stop` ends it at once, with no graceful shutdown.
- mux names a route's methods in `.Methods(...)`, which the handler finder does not read, and a
  struct tag such as `json:"items"` reads as the route literal `/items`. The items routes carry
  `rb:handler` marks for both.

## Refusals

mux has no refusal of its own. Its README refuses in a middleware with `http.Error`, which writes
text, and writes JSON with encoding/json's encoder. A refusal here is 400 with the error's own
text under `error`, written with the encoder. Nothing reshapes the error's text.

- A body that breaks the rules is 400, with go-playground's text naming each rule it breaks on a
  line of its own, such as
  `Key: 'CheckedOrder.customerId' Error:Field validation for 'customerId' failed on the 'gt' tag`.
  The validator names a field by its json name, the name the client sent, through the hook
  go-playground offers for that.
- go-playground reports every rule a body breaks and has no setting to stop at the first, so
  `/body/validate/first-error` runs the validator over one field at a time, in the order
  `CheckedOrder` declares them, and refuses with the first failure. The answer is the line the
  full check would have written first.
- A body that is not JSON gets the decoder's message, such as `unexpected EOF`, which names no
  field.
- A path no route matches gets net/http's `NotFoundHandler`: 404, `404 page not found` as
  text/plain. A method a path has no route for gets mux's bare 405.
- A missing row is net/http's `NotFound`, the same 404 text.
- A wrong token is `http.Error` with 403 and `Forbidden` as text/plain, as mux's README refuses in
  its authentication middleware.
