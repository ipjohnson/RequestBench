# chi

chi 5.3.2 on Go 1.27, answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

chi is a router for net/http, with a radix tree, inline middlewares, groups and subrouters. A
handler is an `http.HandlerFunc` and a middleware is a `func(http.Handler) http.Handler`, so
anything written for net/http runs in it. chi binds and renders nothing itself. Its README names
two optional subpackages, `middleware` and `render`, and lists more packages under go-chi. Each
family uses one of those where it can, net/http where they have nothing, and code written for the
family where neither does.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `router.go` builds the router, and a function in a file named for each family registers that family's routes. |
| `Implementation/views/` | The template, compiled into the binary. |
| `container-h1/` | How container-h1 starts it. `main.go` is the main package that loads the payloads and serves over HTTP/1.1, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.go` serves over HTTP/2 with prior knowledge through net/http's `Server.Protocols`, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `main.go` hands the router to aws-lambda-go-api-proxy's `httpadapter`, which aws-lambda-go's runtime client gives each event, and `Dockerfile` builds the function on the `provided.al2023` base image. |
| `UnitTests/` | go test tests of the wiring, sending each request to the router served by `net/http/httptest`. |
| `client-exception/` | How the corpus reads chi's error bodies. |
| `go.mod` | The module, and every module version the build selects. |
| `go.sum` | The hash of each of those modules, which the build checks. |

There is no client, because chi writes no OpenAPI document of its own.

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
| baseline | `render.PlainText` | go-chi/render |
| json | `render.JSON` encodes the payload with encoding/json into a buffer and writes the buffer. | go-chi/render |
| middleware | No-op `func(http.Handler) http.Handler` layers, which `r.With` wraps around the route's handler. | chi |
| parameters | `chi.URLParam` reads each capture as a string, and strconv converts it. | chi |
| query, headers | The values net/http parsed, the numbers converted with strconv. | net/http |
| body | `render.Bind` decodes the order by its Content-Type and calls its `Bind` method. On the validate routes `Bind` runs go-playground's validator over the `validate` tags. | go-chi/render, go-playground/validator |
| authorized | A middleware on the route compares the bearer token and refuses any other with `http.Error` and 403, as chi's README writes its AdminOnly middleware. | by hand |
| cache | go-chi/stampede in front of each cache route, over one goware/cachestore-mem store. | go-chi/stampede |
| compressed | chi's `middleware.Compress` on the two `/compressed` routes, at gzip's fastest level. | chi |
| etag | A middleware on the two `/etag` routes holds back the body, hashes it with SHA-1, and answers 304 when `If-None-Match` names the hash. | by hand |
| template | html/template, embedded with `go:embed`, parsed once, and executed into the response. | html/template |
| items | One route per method on `/items/{id}`. GET and HEAD share a handler. | chi |
| errors | The router's 404 and 405, the decoder's 400, and the example's `ErrNotFound` for a missing row. | chi, go-chi/render |
| cors | go-chi/cors among the `/cors` subrouter's middlewares. | go-chi/cors |
| forms | net/http's `ParseForm` and `FormFile`. | net/http |
| stream | encoding/json's encoder writes each row and its newline, and net/http's `ResponseController` flushes it. | net/http |
| sse | Each row written as the data of one event and flushed, by hand. | by hand |
| static | net/http's `FileServer` on a wildcard route, as chi's fileserver example serves files. | net/http |

## Notes

- The router carries `middleware.Recoverer` alone of the base stack chi's README starts from.
  RequestID, RealIP and Logger each do work on every request, and Logger writes a line for each.
- `render.JSON` encodes into a buffer and then writes it, so every JSON answer ends with a newline
  and goes out as `application/json` with no charset.
- `render.Status` stores a status in the request's context, which copies the request, so a 201
  and every refusal rendered through `ErrResponse` pay for one copy.
- `render.Bind` picks its decoder from the request's Content-Type and refuses a type it has no
  decoder for. After the decode it walks the payload's fields by reflection, looking for nested
  binders, on every bind.
- chi answers HEAD only where a route names it, so `/items/{id}` registers HEAD beside GET with
  the same handler. chi's `middleware.GetHead` would route each HEAD to its GET route, but it runs
  on every request.
- A method a path has no route for is answered 405, with an `Allow` header naming the methods the
  path has. chi collects them from a map, so their order changes from one answer to the next.
- go-chi/cors answers a preflight with 200, and lists the requested header in canonical form,
  `X-Rb-Tenant`. Every answer under `/cors` gets `Vary: Origin`.
- chi's Compress gzips only the Content-Types it lists, `application/json` among them, however
  small the body, and pools its gzip writers. It adds `Vary: Accept-Encoding` only to an answer it
  compresses.
- stampede keys an answer on the lowercased path and the listed request headers, hashed with
  xxh3, and never on the query. Concurrent requests for one key wait for a single run of the
  handler. A replayed answer carries `x-cache: hit`, and stampede never replays an
  `Access-Control-` header or `Set-Cookie`.
- The store is goware/cachestore-mem, an LRU sized in entries by settings.json, so a full store
  drops the entry used least recently.
- chi computes no ETag, and neither does net/http under it for anything but a file, so the etag
  family's middleware is written for it.
- render has an event stream, which a handler reaches by rendering a channel. It gives every event
  the type `data`, where an EventSource dispatches `message`, and ends the stream with an event
  named `EOF`. The sse route writes its events by hand instead.
- `render.HTML` writes a string it is handed, so the template routes execute the template straight
  into the response instead.
- The server is one process. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under
  the orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports. The function
  on lambda-emulator runs on one core, and so on one thread.
- On lambda-emulator the router answers behind aws-lambda-go-api-proxy 0.16's `httpadapter.NewV2`,
  which reads API Gateway payload format 2.0. It buffers the whole answer into one proxy response,
  and its response writer cannot flush. The sse and stream handlers stop at their first `Flush`, so
  both tests are listed as unsupported there.
- httpadapter posts whatever a handler writes for HEAD. A Function URL's caller reads no body in an
  answer to HEAD, so nothing reads it.
- The function is built with `-tags lambda.norpc`, as AWS builds a Go function for
  `provided.al2023`. The tag leaves out the RPC mode of the retired go1.x runtime.
- The server is PID 1 in its container. The Go runtime installs its own handler for SIGTERM, so
  `docker stop` ends it at once, with no graceful shutdown.
- The handler finder knows no HEAD, so `r.Head` on `/items/{id}` reads as a route for every
  method, and a struct tag such as `json:"items"` reads as the route literal `/items`. The items
  routes carry `rb:handler` marks for both.

## Refusals

chi writes nothing for a body it cannot bind, because it binds nothing. render's README points
to chi's REST example, which answers a failed `render.Bind` with
`render.Render(w, r, ErrInvalidRequest(err))`. `ErrResponse` is the example's type, copied as the
example writes it, so a refusal is 400 with `status` and the error's own text under `error`.
Nothing reshapes it.

- A body that breaks the rules is 400, with go-playground's text naming each rule it breaks on a
  line of its own, such as
  `Key: 'CheckedOrder.customerId' Error:Field validation for 'customerId' failed on the 'gt' tag`.
  The validator names a field by its json name, the name the client sent, through the hook
  go-playground offers for that.
- go-playground reports every rule a body breaks and has no setting to stop at the first, so
  `/body/validate/first-error` binds an order whose `Bind` runs the validator over one field at a
  time, in the order `CheckedOrder` declares them, and returns the first failure. The answer is
  the line the full check would have written first.
- A body that is not JSON gets the decoder's message, such as `unexpected EOF`, which names no
  field.
- A path no route matches gets net/http's `NotFound`: 404, `404 page not found` as text/plain. A
  method a path has no route for gets 405 with no body.
- A missing row is the example's `ErrNotFound`: 404 with `{"status":"Resource not found."}`.
- A wrong token is `http.Error` with 403 and `Forbidden` as text/plain, as chi's README refuses in
  its AdminOnly middleware.
