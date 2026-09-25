# net/http

Go 1.27's `net/http`, with no framework, answering the RequestBench corpus. The contract every
route follows is [`frameworks/openapi.json`](../../openapi.json).

net/http is the HTTP package in Go's standard library. Its `ServeMux` has matched a method and
wildcards in a pattern since Go 1.22, as in `GET /items/{id}`, and answers each request with the
most specific pattern that matches it. A handler is an `http.Handler`, and a layer in front of one
is a function from one `http.Handler` to another. net/http binds, validates and renders nothing.
Each family uses the standard library where it has something, such as `encoding/json`,
`html/template`, `compress/gzip` or `ServeContent`, and code written for the family where it has
nothing.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `mux.go` builds the ServeMux, and a function in a file named for each family registers that family's routes. |
| `Implementation/views/` | The template, compiled into the binary. |
| `container-h1/` | How container-h1 starts it. `main.go` is the main package that loads the payloads and serves over HTTP/1.1, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.go` serves over HTTP/2 with prior knowledge through net/http's `Server.Protocols`, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `main.go` hands the ServeMux to aws-lambda-go-api-proxy's `httpadapter`, which aws-lambda-go's runtime client gives each event, and `Dockerfile` builds the function on the `provided.al2023` base image. |
| `UnitTests/` | go test tests of the wiring, sending each request to the ServeMux served by `net/http/httptest`. |
| `client-exception/` | How the corpus reads the error bodies. |
| `go.mod` | The module, and every module version the build selects. The application needs none, and the two it requires are the Lambda host's. |
| `go.sum` | The hash of each of those modules, which the build checks. |

There is no client, because net/http writes no OpenAPI document.

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
| json | encoding/json's encoder writes the payload after the handler sets `application/json`. | encoding/json |
| middleware | No-op `func(http.Handler) http.Handler` layers wrapped around the handler when the route is registered. | by hand |
| parameters | `PathValue` reads each wildcard as a string, and strconv converts it. | net/http |
| query | net/http parses the query string into `url.Values`, and strconv converts the numbers. | net/http |
| headers | The values net/http parsed, the account converted with strconv. | net/http |
| body | encoding/json decodes the order. On the validate routes the handler checks the order's rules itself, and `errors.Join` puts each broken rule on a line of its own. | encoding/json, by hand |
| authorized | A handler wrapped around the route compares the bearer token and refuses any other with `http.Error` and 403. | by hand |
| cache | A handler wrapped around each cache route replays a stored answer, or stores what the handler wrote. | by hand |
| compressed | A handler wrapped around the `/compressed` routes gzips the answer with compress/gzip at its fastest level. | compress/gzip |
| etag | The handler hashes the encoded body with SHA-1 for the ETag, and `ServeContent` answers 304 when `If-None-Match` names it. | net/http |
| template | html/template, embedded with `go:embed`, parsed once, and executed into the response. | html/template |
| items | One pattern per method on `/items/{id}`. The GET pattern answers HEAD too. | net/http |
| errors | The ServeMux's 404 and 405, the decoder's 400, and net/http's `NotFound` for a missing row. | net/http |
| cors | A handler wrapped around a ServeMux of its own under `/cors/` answers the preflight, and adds the CORS headers for the allowed origin. | by hand |
| forms | net/http's `ParseForm` and `FormFile` read the two bodies, and strconv converts the numbers. | net/http |
| stream | encoding/json's encoder writes each row and its newline, and net/http's `ResponseController` flushes it. | net/http |
| sse | Each row written as the data of one event and flushed, by hand. | by hand |
| static | net/http's `FileServerFS` under a pattern for everything below `/static/`. | net/http |

## Notes

- net/http ships with Go, so its version is the Go release it was built with, which `/__meta`
  reports as `version`.
- The ServeMux answers with the most specific pattern that matches, whatever order the patterns
  were registered in. `/parameters/static/segment/literal` wins over
  `/parameters/{one}/segment/literal` for that reason alone.
- A pattern that names GET matches HEAD too, and net/http leaves the body of an answer to HEAD
  unwritten.
- A method a path has no pattern for is answered 405, with `Method Not Allowed` as text and an
  `Allow` header naming the methods the path has.
- The ServeMux answers a path that is not in its clean form, such as one with a doubled slash,
  with a 301 to the clean path.
- There is no recovery layer. net/http recovers a panicking handler itself, logs the panic and
  closes the connection with no answer. On HTTP/2 it resets the stream instead.
- Each layer in the middleware family is wrapped around the handler once, when the route is
  registered, so a layered route builds nothing per request.
- net/http has no JSON writer, so every JSON answer is written by encoding/json's encoder and ends
  with a newline.
- The gzip wrapper compresses every answer on the `/compressed` routes to a request whose
  `Accept-Encoding` names gzip with a weight above zero, whatever its size. It keeps its gzip
  writers in a `sync.Pool`, and adds `Vary: Accept-Encoding` to every answer there, compressed or
  not.
- net/http computes no ETag, not even for a file. `ServeContent` compares `If-None-Match` only
  with a tag the handler has set. It also answers a Range request on the etag routes and writes
  `Accept-Ranges: bytes`, and its 304 carries the ETag and drops `Content-Type`.
- net/http stores no answers, so the cache family's store and wrapper are written for it. The
  store is sized in entries and aged by settings.json, and a full store drops whichever entry the
  map yields first.
- The CORS wrapper answers every preflight with 204, and writes the allow headers only for the
  allowed origin. It lists the policy's method and header whatever the preflight asked for, and
  writes `Vary: Origin` on every answer under `/cors/`.
- The server is one process. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under
  the orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports. The function
  on lambda-emulator runs on one core, and so on one thread.
- On lambda-emulator the ServeMux answers behind aws-lambda-go-api-proxy 0.16's
  `httpadapter.NewV2`, the library's adapter for a plain `http.Handler`, which reads API Gateway
  payload format 2.0.
- httpadapter buffers the whole answer into one proxy response, and its response writer cannot
  flush. The sse and stream handlers stop at their first `Flush`, so both tests are listed as
  unsupported on lambda-emulator.
- httpadapter posts whatever a handler writes for HEAD. A Function URL's caller reads no body in an
  answer to HEAD, so nothing reads it.
- The function is built with `-tags lambda.norpc`, as AWS builds a Go function for
  `provided.al2023`. The tag leaves out the RPC mode of the retired go1.x runtime.
- The server is PID 1 in its container. The Go runtime installs its own handler for SIGTERM, so
  `docker stop` ends it at once, with no graceful shutdown.
- A struct tag such as `json:"items"` reads as the route literal `/items`, so the create route
  carries an `rb:handler` mark. The GET pattern on `/items/{id}` is marked for `items.head` too,
  and the `/static/` pattern for `static.file`, because neither names what its test sends.

## Refusals

net/http's own refusal is `http.Error`, which writes its message as text/plain. The corpus reads a
refused body as JSON, so a body the handlers refuse is answered with 400 and the error's own text
under `error`, written with encoding/json's encoder. Nothing reshapes the error's text.

- A body that breaks the rules is 400, with each rule it breaks on a line of its own, as
  `errors.Join` joins them, such as `customerId: must be greater than 0`. A field is named as the
  client sent it, and a line's field with the line's index, as `lines[0].qty`.
- `/body/validate/first-error` stops the check at the first rule the body breaks, in the order
  `Order` declares its fields, and refuses with that rule alone.
- A body that is not JSON gets the decoder's message, such as `unexpected EOF`, which names no
  field.
- A path no pattern matches gets the ServeMux's 404, `404 page not found` as text/plain. A method
  a path has no pattern for gets its 405, `Method Not Allowed` as text/plain.
- A missing row is net/http's `NotFound`, the same 404 text.
- A wrong token is `http.Error` with 403 and `Forbidden` as text/plain.
