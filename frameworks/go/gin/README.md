# Gin

Gin 1.12.0 on Go 1.27, answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Gin is a Go HTTP framework over net/http, with a radix-tree router and route groups. A middleware
is a `gin.HandlerFunc` like a handler, and a route's chain is its group's middleware followed by
the functions the route is registered with. Every feature a family reaches for is Gin's own, a
gin-contrib package, or written for the family where Gin has none.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `router.go` builds the engine, and a function in a file named for each family registers that family's routes. |
| `Implementation/views/` | The template, compiled into the binary. |
| `container-h1/` | How container-h1 starts it. `main.go` is the main package that loads the payloads and serves over HTTP/1.1, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.go` serves over HTTP/2 with prior knowledge through gin's `UseH2C`, and `Dockerfile` builds the image. |
| `UnitTests/` | go test tests of the wiring, sending each request to the router served by `net/http/httptest`. |
| `client-exception/` | How the corpus reads Gin's error bodies. |
| `go.mod` | The module, and every module version the build selects. |
| `go.sum` | The hash of each of those modules, which the build checks. |

There is no client, because Gin emits none.

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
| baseline | `c.String` | Gin |
| json | `c.JSON` writes the payload with Gin's JSON codec, which is encoding/json by default. | Gin |
| middleware | No-op `gin.HandlerFunc` layers ahead of the handler in the route's chain. | Gin |
| parameters, query, headers | `ShouldBindUri`, `ShouldBindQuery` and `ShouldBindHeader` fill a struct from its `uri`, `form` and `header` tags, each value converted to its field's type. | Gin |
| body | `ShouldBindJSON` decodes the order on every route. On the validate routes the struct carries `binding` tags, and Gin runs go-playground's validator over them. | Gin, go-playground/validator |
| authorized | A middleware on the route compares the bearer token and stops any other with `c.AbortWithStatus(403)`. | by hand |
| cache | A middleware in front of each cache route replays a stored answer, or stores what the handler wrote. | by hand |
| compressed | `gin-contrib/gzip` on the `/compressed` group, at its fastest level. | gin-contrib/gzip |
| etag | A middleware on the `/etag` group holds back the body, hashes it with SHA-1, and answers 304 when `If-None-Match` names the hash. | by hand |
| template | `c.HTML` renders an html/template template, embedded with `go:embed` and loaded with `LoadHTMLFS`. | Gin |
| items | One route per method on `/items/:id`, the id bound with `ShouldBindUri`. The read route names GET and HEAD with `Match`. | Gin |
| errors | The router's 404, the decoder's 400, and the items handlers' `c.AbortWithStatus(404)`. | Gin |
| cors | `gin-contrib/cors` on the `/cors` group. | gin-contrib/cors |
| forms | `ShouldBind` picks Gin's form or multipart binding from the Content-Type, and binds the file part as a `*multipart.FileHeader`. | Gin |
| stream | `c.Stream`, writing and flushing one row per line. | Gin |
| sse | `c.SSEvent` inside `c.Stream`, writing and flushing each row as the data of one event. | Gin |
| static | `Static` over the payload directory, which hands each file to net/http's `FileServer`. | Gin, net/http |

## Notes

- The engine is `gin.New()` with `gin.Recovery()`, which is `gin.Default()` without its request
  logger. The logger writes a line for every request.
- Gin runs a group's middleware only for a request that one of the group's routes matched. A
  preflight is an OPTIONS request, so the `/cors` group has an OPTIONS route with no handler of
  its own, and gin-contrib/cors answers the preflight with 204.
- gin-contrib/cache keys an answer on its URL alone, so the two vary rows would each share one
  entry across every header value. The cache family's store and middleware are written for it.
  The store is sized in entries and aged by settings.json, and a full store drops whichever entry
  the map yields first.
- Gin computes no ETag, and neither does net/http under it, so the etag family's middleware is
  written for it.
- gin-contrib/gzip compresses every answer whose request asks for gzip, however small, at
  compress/gzip's fastest level, which every framework here compresses at.
- The template is compiled into the binary and parsed once. In debug mode Gin parses it again on
  every render, so the server sets release mode before it builds the router.
- JSON is encoding/json, Gin's default codec. Gin can switch to sonic or another codec with a
  build tag, and this build passes none.
- The server is one process. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under
  the orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports.
- The server is PID 1 in its container. The Go runtime installs its own handler for SIGTERM, so
  `docker stop` ends it at once, with no graceful shutdown.
- A struct tag such as `json:"items"` reads as the route literal `/items`, so the create route
  carries an `rb:handler` mark.

## Refusals

Gin writes no body for a request it cannot bind. Its README answers one with
`c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})`, and every route here does the same,
so a refusal is 400 with the error's own text. Nothing reshapes it.

- A body that breaks the rules is 400, with go-playground's text naming each rule it breaks on a
  line of its own, such as
  `Key: 'CheckedOrder.customerId' Error:Field validation for 'customerId' failed on the 'gt' tag`.
  The validator names a field by its json name, the name the client sent, through the hook
  go-playground offers for that. Gin hands its validator out through `binding.Validator.Engine()`
  for such settings.
- go-playground reports every rule a body breaks and has no setting to stop at the first, so
  `/body/validate/first-error` is wired by hand. It binds the order without its rules, then runs
  the same validator over one field at a time, in the order `CheckedOrder` declares them, and
  refuses with the first failure. The answer is the line the full check would have written first.
- A body that is not JSON gets the decoder's message, such as `unexpected EOF`, which names no
  field.
- A path no route matches, and a method a path has no route for, get the router's 404, with
  `404 page not found` as text/plain. `HandleMethodNotAllowed` stays off, so Gin answers no 405.
- A missing row is `c.AbortWithStatus(404)`, and a wrong token `c.AbortWithStatus(403)`, both with
  no body.
