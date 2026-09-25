# Huma

Huma 2.39.1 on Go 1.27, over Go's `ServeMux`, answering the RequestBench corpus. The contract every
route follows is [`frameworks/openapi.json`](../../openapi.json).

Huma is an OpenAPI-first framework for Go. An operation is a Go function from a typed input struct
to a typed output struct, and Huma binds the path, query, headers and body into the input by struct
tags, validates them against the JSON Schema it builds from the same tags, and writes the output. It
writes an OpenAPI 3.1 document of every operation. Huma runs over a router you choose, through an
adapter. Here it runs over `http.ServeMux` through `humago`, so it measures Huma's layer over the
router [net/http](../net-http) uses. Each family uses Huma where it has something, and code written
for the family or net/http where it has nothing.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, the Go package `implementation`. `api.go` builds the Huma API over a new ServeMux, and a function in a file named for each family registers that family's operations. |
| `Implementation/views/` | The template, compiled into the binary. |
| `container-h1/` | How container-h1 starts it. `main.go` is the main package that loads the payloads and serves the ServeMux over HTTP/1.1, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.go` serves over HTTP/2 with prior knowledge through net/http's `Server.Protocols`, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `main.go` hands the ServeMux to aws-lambda-go-api-proxy's `httpadapter`, which aws-lambda-go's runtime client gives each event, and `Dockerfile` builds the function on the `provided.al2023` base image. |
| `UnitTests/` | go test tests of the wiring, through humatest, Huma's test utility. |
| `Client/` | The OpenAPI document Huma writes, and the Go client oapi-codegen generates from it. `go generate ./Client` rewrites both. |
| `client-exception/` | How the corpus reads the error bodies. |
| `go.mod` | The module, every module version the build selects, and oapi-codegen as a tool. |
| `go.sum` | The hash of each of those modules, which the build checks. |

## Building, running and testing

```sh
go build -o server ./container-h1
RB_PAYLOADS=../../../tests/payloads PORT=8080 ./server
go test ./...
RB_PAYLOADS=../../../tests/payloads go generate ./Client
```

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080. The suite reads `RB_PAYLOADS` too, and without it finds
`tests/payloads` by walking up from the working directory. Each test is a subtest named for the
corpus id it covers, so `go test ./UnitTests -run '/json.small'` runs one.

`go generate ./Client` builds the API over the payloads, writes its document to
`Client/openapi.yaml` with `OpenAPI().DowngradeYAML()`, and runs oapi-codegen over it, as Huma's
client SDK tutorial does. The document is OpenAPI 3.0.3, because oapi-codegen does not read 3.1
fully. The suite tests the client against the Implementation.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler answers a `[]byte` body under text/plain, which Huma writes as it is. | Huma |
| json | Huma serialises the output's `Body` with its JSON format. | Huma, encoding/json |
| middleware | No-op Huma middlewares in the operation's `Middlewares`. | Huma |
| parameters | Huma binds each path parameter into a typed input field by its `path` tag. | Huma |
| query | Huma binds the query string into typed input fields by their `query` tags. | Huma |
| headers | Huma binds the three headers into typed input fields by their `header` tags. | Huma |
| body | Huma parses the order into the input's `Body`. The validate routes check the JSON Schema Huma builds from `CheckedOrder`'s tags, and the first-error route runs Huma's validator one field at a time in a resolver. | Huma |
| authorized | A middleware on a Huma group around the operation compares the bearer token and refuses any other with `huma.WriteErr` and 403. | Huma, by hand |
| cache | A middleware on a Huma group around each cache operation replays a stored answer, or stores what the handler wrote. | by hand |
| compressed | A middleware on a Huma group around the `/compressed` operations gzips the answer with compress/gzip at its fastest level. | compress/gzip, by hand |
| etag | The handler hashes the encoded body with SHA-1 for the ETag, and Huma's conditional package answers 304 when `If-None-Match` names it. | Huma, by hand |
| template | html/template, embedded with `go:embed`, parsed once, rendered into a buffer, and answered as a `[]byte` body under text/html. | html/template |
| items | One Huma operation per method on `/items/{id}`. The GET operation answers HEAD too. | Huma |
| errors | The ServeMux's 404 and 405, Huma's 400 for a body that does not parse, and `huma.Error404NotFound` for a missing row. | net/http, Huma |
| cors | A middleware on a Huma group around the `/cors` operations answers the preflight, and adds the CORS headers for the allowed origin. | by hand |
| forms | Huma decodes the multipart form by its `form` tags. The handler parses the urlencoded form with net/url and converts the numbers with strconv. | Huma, net/url |
| stream | A `huma.StreamResponse` writes each row with encoding/json's encoder and flushes it. | Huma |
| sse | Huma's `sse` package sends each row as the data of a message event and flushes it. | Huma |
| static | net/http's `FileServerFS` under a ServeMux pattern for everything below `/static/`. | net/http |

## Notes

- humago registers each operation as a ServeMux pattern. A path no operation matches and a method
  a path has no operation for are the ServeMux's own answers, 404 and 405 as text, and not Huma's
  problem details.
- `huma.DefaultConfig` has a create hook that adds a `$schema` property to every JSON answer and a
  `Link` header naming the schema. The corpus compares each body whole, so `config.CreateHooks` is
  set to nil, as Huma's JSON Schema registry page shows.
- The default config also serves the OpenAPI document at `/openapi.json`, `/openapi.yaml` and their
  3.0 forms, a docs page at `/docs`, and each schema under `/schemas`. They stay on.
- Huma validates a body by decoding it into a map, checking the map against the schema, and then
  decoding it again into the Go type. The bind routes set `SkipValidateBody`, so Huma decodes their
  body once and checks nothing.
- Huma refuses a field the schema does not name, because every schema it builds sets
  `additionalProperties` to false.
- Huma reports every rule a body breaks, by design. The first-error route decodes the body a third
  time in its resolver and runs Huma's validator over one field at a time, in the order
  `CheckedOrder` declares them.
- A number in a path, query or header that does not parse is refused with 422, as a body that breaks
  its schema is.
- Each middleware chain is composed once, when the operation is registered.
- The etag handler encodes the payload itself and answers the bytes, so the hash is of the body
  sent. The conditional package compares `If-None-Match` without the tag's quotes. Its 304 is an
  error, so it carries `Content-Type: application/problem+json`, and the ETag only because the
  handler adds it with `huma.ErrorWithHeaders`.
- Huma's `sse` package writes `write deadline not supported by underlying writer` to stderr before
  every event, because humago hands it net/http's `ResponseWriter`, which has no `SetWriteDeadline`
  method. An answer of 89 events writes 89 lines.
- humago keeps 8 KB of a multipart form in memory, its `MultipartMaxMemory`, and net/http writes the
  rest of a file part to a temporary file. The 32 KB upload goes through the disk on every request.
- The cache and compressed middlewares wrap Huma's context to see what the handler writes. They
  embed it under a type of their own, as Huma embeds it in its sub-contexts, because a field named
  `Context` would hide the interface's `Context` method.
- The CORS preflight reaches Huma only through an operation, so the `/cors` group registers an
  OPTIONS operation on the same path, hidden from the document. The middleware answers a preflight
  with 204 before that operation runs.
- The server is one process. Go sets GOMAXPROCS from the container's CPU quota or cpuset, so under
  the orchestrator's two CPUs it runs Go code on two threads, which `/__meta` reports. The function
  on lambda-emulator runs on one core, and so on one thread.
- Huma has no Lambda adapter. On lambda-emulator the ServeMux answers behind aws-lambda-go-api-proxy
  0.16's `httpadapter.NewV2`, which reads API Gateway payload format 2.0.
- httpadapter buffers the whole answer into one proxy response, and its response writer cannot
  flush, so the sse and stream tests are listed as unsupported on lambda-emulator.
- The function is built with `-tags lambda.norpc`, as AWS builds a Go function for
  `provided.al2023`. The tag leaves out the RPC mode of the retired go1.x runtime.
- The server is PID 1 in its container. The Go runtime installs its own handler for SIGTERM, so
  `docker stop` ends it at once, with no graceful shutdown.
- A struct tag such as `json:"items"` reads as the route literal `/items`, so the create operation
  carries an `rb:handler` mark. So do the GET on `/items/{id}` for `items.head`, the `/cors/small`
  GET beside its OPTIONS operation, the sse operation, whose path sits in an `Operation` literal,
  and the `/static/` pattern.

## Refusals

Huma answers the errors it writes with its own RFC 9457 problem details, as
`application/problem+json`: `title`, `status`, `detail`, and under `errors` an entry for each rule
broken, with its `message`, its `location` and the `value` found there.

- A body that breaks the rules is 422, with an entry for each rule it breaks, such as
  `{"message": "expected number >= 1", "location": "body.customerId", "value": 0}`. A line's field
  is named with the line's index, as `body.lines[0].qty`.
- `/body/validate/first-error` answers the same problem details with the first rule alone.
- A body that is not JSON is 400, with one entry at `body` holding the decoder's message, such as
  `unexpected end of JSON input`.
- A missing row is `huma.Error404NotFound`: 404, `{"title": "Not Found", "status": 404, "detail": "no item has that id"}`.
- A wrong token is `huma.WriteErr` with 403: `{"title": "Forbidden", "status": 403, "detail": "Forbidden"}`.
- A path no operation matches gets the ServeMux's 404, `404 page not found` as text/plain. A method a
  path has no operation for gets its 405, `Method Not Allowed` as text/plain, with an `Allow` header.
