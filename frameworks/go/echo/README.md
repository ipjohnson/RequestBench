# Echo

Echo 5.3.1 on Go 1.27, answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Echo is a Go HTTP framework over net/http, with a radix-tree router, groups, and a binder,
validator slot, renderer slot and JSON serializer on the instance. A handler takes an
`*echo.Context` and returns an error, and every error a handler or middleware returns goes to one
error handler, which writes the answer. A middleware wraps a handler, and a route's own
middlewares are wrapped around it when the route is added. Every feature a family reaches for is
Echo's own, a slot Echo's guide fills, or written for the family where Echo has none.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `router.go` builds the instance, a function in a file named for each family registers that family's routes, and `cmd/server` is the main package that loads the payloads and serves. |
| `Implementation/views/` | The template, compiled into the binary. |
| `UnitTests/` | go test tests of the wiring, sending each request to the instance served by `net/http/httptest`. |
| `client-exception/` | How the corpus reads Echo's error bodies. |
| `go.mod` | The module, and every module version the build selects. |
| `go.sum` | The hash of each of those modules, which the build checks. |

There is no client, because Echo writes no OpenAPI document of its own.

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
| baseline | `c.String` | Echo |
| json | `c.JSON` hands the payload to the instance's JSONSerializer, whose default encodes it with encoding/json straight onto the response. | Echo |
| middleware | No-op `echo.MiddlewareFunc` layers, given to the route after its handler. | Echo |
| parameters, query, headers | `echo.BindPathValues`, `echo.BindQueryParams` and `echo.BindHeaders` fill a struct from its `param`, `query` and `header` tags, each value converted to its field's type. | Echo |
| body | `c.Bind` decodes the order with the JSONSerializer. On the validate routes `c.Validate` then runs `e.Validator`, the adapter Echo's guide shows over go-playground's validator. | Echo, go-playground/validator |
| authorized | A middleware on the route compares the bearer token and returns `echo.ErrForbidden` for any other. | by hand |
| cache | A middleware in front of each cache route replays a stored answer, or stores what the handler wrote. | by hand |
| compressed | Echo's Gzip middleware on the two `/compressed` routes, at gzip's fastest level. | Echo |
| etag | A middleware on the two `/etag` routes holds back the body, hashes it with SHA-1, and answers 304 when `If-None-Match` names the hash. | by hand |
| template | `c.Render` through `e.Renderer`, which is `echo.TemplateRenderer` over html/template, embedded with `go:embed`. | Echo |
| items | One route per method on `/items/:id`, the id bound with `echo.BindPathValues`. GET and HEAD share a handler. | Echo |
| errors | The router's 404 and 405, the binder's 400, and `echo.ErrNotFound` for a missing row, each written by the default error handler. | Echo |
| cors | Echo's CORS middleware on the `/cors` group. | Echo |
| forms | `c.Bind` picks the form or the multipart parser from the Content-Type, and binds the file part as a `*multipart.FileHeader`. | Echo |
| stream | As Echo's streaming cookbook does, encoding/json's encoder writes each row and its newline, and net/http's `ResponseController` flushes it. | Echo's cookbook |
| sse | The `Event` type and `MarshalTo` from Echo's SSE cookbook write each row as the data of one event, and each is flushed. | Echo's cookbook |
| static | `e.Static` over the payload directory, which hands each file to net/http's `ServeContent`. | Echo, net/http |

## Notes

- The instance carries `middleware.Recover()` alone of the stack Echo's README starts from. The
  README's `middleware.RequestLogger()` writes a line for every request.
- `echo.New` gives the instance a JSON slog logger on stdout. `e.Start` writes Echo's banner and
  the listening address through it, and no request is logged.
- `e.Start` serves with its own `http.Server`, whose `ReadTimeout` is 30 seconds. `IdleTimeout` is
  left unset, so net/http closes a keep-alive connection idle for 30 seconds.
- `e.Start` stops the server on SIGTERM and shuts it down gracefully, waiting up to 10 seconds for
  requests in flight.
- The v5 guide's validator adapter returns `echo.ErrBadRequest.Wrap(err)`. The default error
  handler writes that error as `{"message":"Bad Request"}`, without the validator's text, although
  the guide prints the text in its example answer. The adapter here returns
  `echo.NewHTTPError(http.StatusBadRequest, err.Error())`, which writes the answer the guide prints.
- A body the binder cannot decode is `echo.ErrBadRequest` wrapping the decoder's error, which the
  default error handler writes as `{"message":"Bad Request"}`. The decoder's message is shown only
  by the handler `echo.DefaultHTTPErrorHandler(true)` makes.
- `c.JSON` encodes onto the response with an `encoding/json` Encoder, so every JSON answer ends
  with a newline and goes out as `application/json` with no charset.
- The default JSONSerializer reads the whole request body into a pooled buffer before it decodes.
- `c.Bind` binds path values, then query values for GET, DELETE and HEAD only, then the body. It
  never reads headers, which only `echo.BindHeaders` binds. The binder looks a header tag up as it
  is written and otherwise compares it with every header the request carries, so the tags are
  written in the canonical form net/http keys headers by.
- Echo's KeyAuth middleware refuses a wrong key with 401, and the corpus asks for 403, so the
  token check is a middleware written for the route.
- Echo's router answers HEAD only where a route names it, unless its `AutoHandleHEAD` setting is
  on. The setting is off by default, and its documentation suggests registering a HEAD route
  where one is safe instead, so `/items/:id` registers HEAD beside GET with the same handler.
- A method a path has no route for is answered 405, with an `Allow` header naming the methods the
  path has. An OPTIONS request to any path that has a route is answered 204 with that header.
- A group with middleware registers a 404 route for its own prefix, so every request under
  `/cors` that no route of the group matches runs the CORS middleware. A preflight reaches the
  middleware that way, with no OPTIONS route.
- Echo's CORS middleware treats every OPTIONS request as a preflight and answers it with 204. It
  adds `Vary: Origin` to every answer under `/cors`, and lists the allowed header as configured,
  `x-rb-tenant`.
- Echo's Gzip middleware adds `Vary: Accept-Encoding` to every answer it sees, compressed or not.
  It compresses whenever `Accept-Encoding` contains `gzip`, however small the body, and pools its
  gzip writers and buffers.
- Echo ships no response cache. The cache family's store and middleware are written for it. The
  store is sized in entries and aged by settings.json, and a full store drops whichever entry the
  map yields first.
- Echo computes no ETag, and neither does net/http under it for anything but a file, so the etag
  family's middleware is written for it.
- `c.Render` renders the template into a buffer and then sends it as `text/html; charset=UTF-8`,
  so a failed render still reaches the error handler.
- Echo has no event stream. The SSE cookbook's `Event` writes an `id:` line with every event,
  empty when the event has no ID, which leaves an EventSource's last event ID empty.
- `e.Static` registers GET alone, and serves each file through net/http's `ServeContent`, which
  sends `Content-Length`, `Last-Modified` and `Accept-Ranges`.
- The server is one process. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under
  the orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports.
- A struct tag such as `json:"items"` reads as the route literal `/items`, so the items routes
  carry `rb:handler` marks.

## Refusals

Echo writes every error a handler returns through its default error handler: the status the error
carries, and `{"message": ...}`, the message of an `echo.HTTPError` or the status text of any
other error. Nothing reshapes it.

- A body that breaks the rules is 400, with go-playground's text as the message, naming each rule
  it breaks on a line of its own, such as
  `Key: 'CheckedOrder.customerId' Error:Field validation for 'customerId' failed on the 'gt' tag`.
  The validator names a field by its json name, the name the client sent, through the hook
  go-playground offers for that.
- go-playground reports every rule a body breaks and has no setting to stop at the first, so
  `/body/validate/first-error` is wired by hand. It binds the order without its rules, then runs
  the same validator over one field at a time, in the order `CheckedOrder` declares them, and
  refuses with the first failure. The answer is the line the full check would have written first.
- A body that is not JSON is 400 with `{"message":"Bad Request"}`, which names no field.
- A path no route matches is 404 with `{"message":"Not Found"}`. A method a path has no route for
  is 405 with `{"message":"Method Not Allowed"}`.
- A missing row is `echo.ErrNotFound`, the router's own 404 answer, and a wrong token
  `echo.ErrForbidden`, 403 with `{"message":"Forbidden"}`.
