# Vert.x Web

Vert.x Web 5.2.0 on Vert.x core's HTTP server and Netty 4.2, running on Java 25, answering the
RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Vert.x core runs an HTTP server on an event loop, and Vert.x Web adds a router whose routes chain
handlers, each calling the next. Every family uses a Vert.x Web handler or another module of the
Vert.x stack where Vert.x has one. The response cache and the server-sent events are written for
their families, because Vert.x has neither.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module. `Application` deploys one `Server` verticle per core, and each builds a router over one class per corpus family under `src/main/java/implementation/routes/`. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, as container-h1's, because Vert.x's `HttpServerOptions` answer HTTP/2 with prior knowledge on a plain port by default. |
| `UnitTests/` | JUnit tests of the wiring, a Maven module that deploys the server verticle on a random port with vertx-junit5. |
| `client-exception/` | How the corpus reads Vert.x's error bodies. |
| `pom.xml` | The two modules. Vert.x's stack BOM, imported as Vert.x's starter imports it, pins every Vert.x module and what they depend on. This pom pins that BOM, JUnit's BOM and every plugin. |

There is no client, because Vert.x writes no OpenAPI document about its own routes. vertx-openapi
and vertx-web-openapi-router read a contract and build a router from it, and nothing in the
Vert.x stack writes one from a router.

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/implementation-0.0.0-fat.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 25 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which the
Implementation reads before Vert.x starts. The tests find `tests/payloads` themselves when it is
not set. `PORT` defaults to 8080. Each test carries its corpus ids as JUnit tags, so
`-Dgroups=<id>` runs the tests of one.

The executable jar is shaded, as Vert.x's starter builds one, and written beside the plain jar that
UnitTests compiles against.

`Application` deploys one server verticle per core the JVM counts, which is 2 under `--cpus 2`, as
Vert.x's documentation spreads a server over the cores. Vert.x runs each verticle on an event loop
of its own and hands the servers new connections in turn. Its event-loop pool holds two threads
per core, so two of the four serve.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler ends the response with the string, as text/plain. | Vert.x core |
| json | `RoutingContext.json` encodes the payload, a `JsonObject`, with Jackson's streaming generator. | Vert.x Web |
| middleware | No-op handlers chained on the route, four or sixteen, each calling `next()`. | Vert.x Web |
| parameters, query, headers | A `ValidationHandler` on the route declares each value with a schema of its type, and the handler reads the typed value from `RequestParameters`. | vertx-web-validation |
| body | `BodyHandler` buffers the body. The bind routes parse it with `RequestBody.asJsonObject`. On the validate routes a `ValidationHandler` parses it and checks it against orderRequest's rules as a vertx-json-schema schema, and refuses a body that breaks one with 400. | vertx-web-validation and vertx-json-schema |
| authorized | `SimpleAuthenticationHandler` makes the bearer token the user, and `AuthorizationHandler` requires a permission that only settings.json's token is granted, on `/authorized/*` alone. | Vert.x Web and vertx-auth |
| cache | A handler in front of each cache route replays a stored answer, or lets the route's handler build one and keeps it, in a local map of Vert.x's shared data. | by hand |
| compressed | The HTTP server's compression, on every connection, gzip at level 1, the fastest. | Vert.x core |
| etag | The handler hashes the encoded body with SHA-1 and sets the tag with `RoutingContext.etag`, and `RoutingContext.isFresh` decides the 304. | Vert.x Web, the hash by hand |
| template | Handlebars, through vertx-web-templ-handlebars' `HandlebarsTemplateEngine`. | vertx-web-templ-handlebars |
| items | One route per method on `/items/:id`, the id bound by a `ValidationHandler`. The GET route names HEAD too, because a route answers only the methods it names. | Vert.x Web |
| errors | The router's 404 page and its 405, the `ValidationHandler`'s 400 for a body that is not JSON, and the items handlers' 404. | Vert.x Web |
| cors | `CorsHandler` on `/cors/*`. | Vert.x Web |
| forms | `BodyHandler` parses both bodies and streams the file part to a file, and a `ValidationHandler` binds the fields as a form body. | Vert.x Web and vertx-web-validation |
| stream | `HttpServerResponse.write`, one row and its newline per write, on a chunked answer. | Vert.x core |
| sse | The handler writes each row as the data of one event, a write of its own, on a chunked answer. | by hand |
| static | `StaticHandler` over the payload directory, under `/static/`. | Vert.x Web |

## Notes

- Each server verticle builds its own router, because Vert.x Web's handlers keep state for the
  event loop that runs them. The payloads, the serial counter, the response cache and the compiled
  template belong to the process, and both verticles use them.
- The payloads are Vert.x's `JsonObject`, and Vert.x encodes one with jackson-core's streaming
  generator. It would use Jackson's databind if jackson-databind 2 were on the class path, and it
  is not. vertx-core's pom adds Jackson 3 for a JDK of 21 or later, so the jar carries it, and
  Vert.x uses Jackson 3 only where Jackson 2 is missing.
- Vert.x compresses on the HTTP server alone, so the compressor sits in every connection's
  pipeline and every answer passes through it. It compresses at any size when the request asks for
  gzip, so `/compressed/small` goes out as 133 gzipped bytes for its 123. With it on, Vert.x sends
  a file through Netty's `ChunkedWriteHandler` rather than a zero-copy `FileRegion`, so static.file
  pays for it too.
- vertx-json-schema's default output, Flag, stops at the first failure and reports only that the
  body is invalid. The repository is set to Basic output, which lists every error, each with the
  JSON pointer of the value it is about.
- The first-error route mounts one `ValidationHandler` per field, customerId, status and lines, in
  the order orderRequest declares them, and the first that refuses the body stops the route. Each
  parses the body, so a body that passes is parsed three times. The measured row sends
  order.invalid, which the first refuses.
- The schema DSL keeps an object's properties in a `HashMap`, so the validator checks them and
  lists their errors in that map's order: customerId, lines, status. It also gives each schema a
  random id, which a refusal quotes in every error. Each schema is named with `alias()` instead, so
  a refusal reads the same from one start to the next.
- vertx-auth has no provider for an opaque token. `SimpleAuthenticationHandler` is Vert.x Web's
  handler for an application's own check, and it makes the token the user without judging it. The
  `AuthorizationProvider` in `AuthorizedRoutes` grants the route's permission to settings.json's
  token, and `AuthorizationHandler` refuses a user without it with 403. A request with no bearer
  token is not authenticated, which is 401.
- Vert.x Web logs a failure that reaches the router with no failure handler as an unhandled
  exception. The authorized routes send theirs to Vert.x Web's `ErrorHandler`, so a denied request
  writes no log line. A preflight from a refused origin is logged, and only the validation test
  sends one.
- A missing row is answered 404 with no body, as Vert.x's REST example answers one.
  `RoutingContext.fail(404)` would go through the router's failure handling, which logs each one.
- `CorsHandler` sends `Vary: Origin` only for a policy with more than one origin or a pattern. The
  one origin is given as a pattern that matches it alone. The handler answers a preflight with 204.
- Vert.x Web ships no response cache, and a handler cannot read what another handler wrote, so the
  cache routes' handlers hand their answer to the store. The store is sized in entries and aged by
  settings.json, and a full store drops whichever entry its key set yields first.
- Vert.x has no support for server-sent events. Vert.x Web's SockJS handler has an EventSource
  transport, which carries SockJS's own framing, so the handler writes the events itself.
- `BodyHandler` writes a multipart body's file part to a file under the JVM's temporary directory
  before the handler runs, and deletes it once the answer is sent.
- The payloads' `"items"` key reads as the route literal `/items`, so the create route carries an
  `rb:handler` mark.
- vertx-web-templ-handlebars brings slf4j-api with no provider, so the JVM prints SLF4J's
  no-provider warning at startup. Vert.x logs through java.util.logging.
- The container runs `java -jar` as PID 1 with the collector and heap the JVM chooses. The JVM
  reads the container's CPU quota and counts 2 CPUs under `--cpus 2`. On SIGTERM it exits at once,
  because nothing registers a shutdown hook.
- container-h2 lists `items.head` as unsupported. Over HTTP/2, Vert.x sends the row the route writes
  for HEAD as a DATA frame. HTTP/2 allows no content in an answer to HEAD, so the client resets the
  stream.

## Refusals

Every refusal is what Vert.x writes, and nothing reshapes it. A `ValidationHandler` fails a request
it refuses with 400 and a `BadRequestException`, which Vert.x Web answers with the status line's
text alone. vertx-web-validation's documentation handles the exception in
`router.errorHandler(400, ...)`, and the exception has `toJson()`, so the router's error handler
writes that: the exception's type and message, its cause's type and message, the content type, and
whether parsing or validation failed. For a body the schema refuses, the cause's message is the
validator's report, a line of text around the list of its errors as JSON.

- `order.invalid` binds and breaks three rules, and `/body/validate/small` lists all three, each
  under the pointer of its field, such as `#/customerId`. The first-error route lists customerId
  alone.
- A body that is not JSON is a parsing error, which names no field.
- A wrong bearer token is 403, and `ErrorHandler` writes `Error 403: Forbidden` as text.
- A path with no route is 404 with the router's HTML page, and a method the path lacks is 405 with
  an `Allow` header and no body. A missing row is 404 with no body.
