# Javalin

Javalin 7.2.3 on Jetty 12.1, running on Java 25, answering the RequestBench corpus. The contract
every route follows is [`frameworks/openapi.json`](../../openapi.json).

Javalin is a web framework over an embedded Jetty. An application adds its routes, its before and
after handlers, its exception mappers and its plugins to the config `Javalin.create` hands it,
before the server starts. Every family uses Javalin's own facility where Javalin has one: its
router, its validator, its bundled plugins, or one of its rendering modules.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module. One class per corpus family under `src/main/java/implementation/routes/`, each adding its routes to the config. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | How container-h2 starts it. `H2c.java` serves the application on a Jetty connector that answers HTTP/2 with prior knowledge, and `Dockerfile` builds the image with Implementation's `container-h2` profile, which compiles `H2c.java` and adds Jetty's HTTP/2 module. |
| `UnitTests/` | JUnit tests of the wiring, a Maven module. Each test starts the Implementation on a random port with javalin-testtools' `JavalinTest.test`. |
| `Client/` | The OpenAPI document javalin-openapi writes from the handlers' `@OpenApi` annotations, and the Java client OpenAPI Generator writes from it, a Maven module. |
| `client-exception/` | How the corpus reads Javalin's error bodies. |
| `pom.xml` | The three modules. Javalin offers no parent pom for an application, so this one pins every dependency and plugin, each version a property, Javalin's own artifacts through `javalin-bom`, and every Jetty module through `jetty-bom` at the Jetty Javalin runs on. |

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/implementation-0.0.0-exec.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 25 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which the
Implementation loads before Javalin starts. The tests find `tests/payloads` themselves when it is
not set. `PORT` defaults to 8080. Each test carries its corpus ids as JUnit tags, so
`-Dgroups=<id>` runs the tests of one.

The executable jar is built by the shade plugin, as Javalin's Docker tutorial builds one. It goes
beside the plain jar under the `exec` classifier, because UnitTests compiles against the plain one.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `ctx.result`, under Javalin's default content type, text/plain. | Javalin |
| json | `ctx.json`, which writes the payload with Javalin's default JSON mapper, JavalinJackson, over Jackson 2. | Javalin |
| middleware | No-op before handlers, four or sixteen, each registered for its one path. | Javalin |
| parameters, query, headers | `ctx.pathParamAsClass`, `ctx.queryParamAsClass` and `ctx.headerAsClass`, whose `Validator` converts each value with Javalin's converter for its type. query.many reads its eight values into a record. | Javalin |
| body | `ctx.bodyAsClass` reads the order on the bind routes. The validate routes read it through `ctx.bodyValidator`, with orderRequest's rules as checks, and Javalin answers a failed check with 400. | Javalin |
| authorized | A `beforeMatched` handler on `/authorized/*` throws `ForbiddenResponse` for any token but settings.json's, and Javalin answers it with 403. | Javalin |
| cache | A before handler on `/cache/*` replays a stored answer and skips the route, and an after handler stores what the route answered. | by hand |
| compressed | Javalin's compression, which covers the whole application, set to gzip's fastest level. | Javalin |
| etag | Javalin's `ETagGenerator`, called by an after handler on `/etag/*`. Javalin's writer answers a matching `If-None-Match` with 304. | Javalin |
| template | `ctx.render`, with `JavalinMustache` as the file renderer. | javalin-rendering-mustache |
| items | One route per method on `/items/{id}`, and a HEAD route that runs the GET handler. | Javalin |
| errors | The router's 404, `ctx.bodyValidator`'s 400 and the items handlers' `NotFoundResponse`, each answered by Javalin. | Javalin |
| cors | Javalin's bundled CORS plugin, with its one rule on `/cors/*`. | Javalin |
| forms | `ctx.formParamAsClass` reads the urlencoded form into query.many's record. The multipart fields and `ctx.uploadedFile` read the parts Jetty parses. | Javalin |
| stream | `ctx.outputStream`, writing one row per line and flushing after each. | Javalin |
| sse | `config.routes.sse`, and `SseClient.sendData` for each row, one event per row. | Javalin |
| static | Javalin's static-file handler over the payload directory, under `/static`, and an after handler that adds Last-Modified. | Javalin |

## Notes

- Javalin matches a request against its routes one at a time, in the order they were added. It
  checks the path against every before and after handler the same way. A pattern that is not the
  request's path verbatim is matched with a regular expression. So each scoped handler here costs
  every other request one match: the middleware layers, the cache's pair, the etag and static
  after handlers, the CORS plugin's pair and the authorized check. `Application` adds the baseline
  and json routes first.
- Every handler carries an `rb:handler` mark. Its route literal is in its `@OpenApi` annotation as
  well as in its registration, so the handler finder would find it twice.
- Javalin computes an ETag only when `config.http.generateEtags` is on, and that switch covers
  every GET answer in the application. The generator reads each answer's bytes one at a time into
  an Adler-32 checksum, json.large's 130 KB included. An after handler on `/etag/*` calls the same
  generator, `ETagGenerator`, for these two routes alone. `ETagGenerator` is a class of Javalin's
  that its documentation does not name. The ETag is the checksum as a number with no quotes, as
  Javalin writes it.
- Javalin compresses every answer by default, with gzip at level 6, and has no setting that
  narrows it to a path. `Application` sets level 1, gzip's fastest. Javalin compresses an answer
  when the client asks for gzip and the first write is at least 1,500 bytes, so
  `/compressed/small`'s 123 bytes go out as they are. Every answer passes through Javalin's
  compressing stream whatever the setting, so the other rows pay only for reading
  Accept-Encoding. Javalin sends no `Vary: Accept-Encoding`.
- Javalin's validator runs every check it holds and has no mode that stops at the first. The
  first-error route reads the order through `ctx.bodyValidator` with no checks. It then gives each
  rule a `Validator` of its own, in the order orderRequest states them, and the first that fails
  throws the `ValidationException` Javalin answers.
- A check's field name is fixed when the check is added, before the body is read. So a rule about
  a line is filed under `lines`, and not under the line's index.
- The bind routes read the body with `ctx.bodyAsClass`, which is not a validator. Javalin answers
  a body it cannot read there with 500 and logs it as an uncaught exception. No row sends one.
- Javalin answers HEAD on a path with a GET route itself, with 200, no body and its default
  text/plain type, and does not run the route. items.head asks for the JSON type, so
  `/items/{id}` has a HEAD route that runs the GET handler, and Jetty sends no body.
- Javalin's router matches the method and the path together, and `prefer405over404` is off by
  default. So a method a path has no route for gets 404, as a path with no route does.
- The CORS plugin has no list of methods or headers. It answers a preflight from an allowed origin
  with the method and the headers the preflight asked for, so settings.json's method and header
  are not applied. No route answers a preflight, so the plugin's after handler turns the router's
  404 into 200 with an empty body.
- The cache's store is a map sized in entries and aged by settings.json, one per process. A full
  store drops one entry to take another, whichever the map yields first.
- Javalin's static-file handler streams a file with no length, which Jetty sends chunked once it
  passes its 32 KB buffer, and it never sends Last-Modified. With `precompressMaxSize` set,
  Javalin reads a file into memory the first time it is asked for, gzipped too for a client that
  asks for gzip, and sends it with its length. The after handler on `/static/*` adds
  Last-Modified from the file.
- Javalin keeps a multipart part in memory only up to 1 byte by default. So Jetty writes each of
  forms.multipart's three parts to a file in `/tmp`, and deletes them when the request ends. The
  default is left alone.
- `config.routes.sse` runs the handler on Javalin's async executor and answers with
  `Connection: close`, so every sse.medium request under load opens a new connection.
- `ctx.outputStream` is Javalin's compressing stream, whose flush does nothing. The stream route
  flushes the servlet response under it after each row.
- JavalinJackson, Javalin's default JSON mapper, is Jackson 2, which Javalin leaves to the
  application to add. Javalin can write with Jackson 3 through `JavalinJackson3`, which this build
  does not configure.
- Javalin serves each request on a thread from Jetty's pool of up to 250. Virtual threads stay
  off, as they are by default.
- The server logs through slf4j-simple, the logger Javalin's documentation adds. Javalin logs
  nothing for a request that succeeds.
- The container runs `java -jar` as PID 1 with the collector and heap the JVM chooses. The JVM
  reads the container's CPU quota and counts 2 CPUs under `--cpus 2`. On SIGTERM it exits in under
  a second. Javalin registers no shutdown hook, so a request in flight is not finished.
- Javalin has no setting for HTTP/2. On container-h2, `H2c` adds a Jetty connector with an
  HTTP/1.1 and an h2c connection factory through `config.jetty.addConnector`, and Javalin adds its
  own HTTP/1.1 connector only when none was added. The HTTP/1.1 factory sees the preface a client
  with prior knowledge opens with, and hands the connection to the h2c factory.
- `Application.create` takes the host's settings as a second argument, applied after the
  application's own. `H2c` uses it, and container-h1 passes none.
- Javalin implements no lambda-emulator. Javalin ships no AWS Lambda adapter, and its maintainers
  declined to add one in [javalin issue 2576](https://github.com/javalin/javalin/issues/2576).

## Refusals

Every refusal is what Javalin writes. Nothing reshapes it.

- A failed check is Javalin's answer to a `ValidationException`: 400, and a JSON object keyed by
  the field each failed check is filed under. Each entry holds the check's message, its args and
  the value it saw, which is the whole order. `order.invalid` binds and breaks all three rules, so
  the validate routes name customerId, status and lines, and the first-error route names
  customerId.
- A body that is not JSON fails `ctx.bodyValidator` too: 400, with `DESERIALIZATION_FAILED` under
  `REQUEST_BODY` and the body it could not read as the value.
- `ForbiddenResponse`, `NotFoundResponse` and the router's miss are Javalin's
  `HttpResponseException` answers. Each is JSON when the request's Accept names
  application/json, HTML when it names text/html, and text otherwise. The corpus sends no Accept.
  So a wrong token is 403 with `Forbidden` and a missing row is 404 with `Not Found`. A path with
  no route is 404 with `Endpoint GET /errors/unmatched not found`, and a method a path has no route
  for is the same 404.

## Client

`Client/` holds the OpenAPI document javalin-openapi writes for the handlers and a Java client
generated from it. Javalin writes no document of its own, and javalin-openapi is the plugin its
documentation points to. Javalin's OpenAPI tutorial generates a client with OpenAPI Generator's
Maven plugin and names only the language. So the client is OpenAPI Generator's java generator with
its default library, okhttp-gson.

- javalin-openapi is an annotation processor. Each handler is a method that carries an `@OpenApi`
  annotation describing its route, and is registered by method reference, because an annotation
  cannot sit on a lambda. The annotations were written for the document. Nothing reads them at run
  time, and their artifact, openapi-specification, is provided scope, so it is not in the jar.
- `mvn -B -Pclient clean verify -pl Client -am` compiles Implementation under the `client`
  profile, which adds the processor. The processor writes the document among the classes, and
  the profile's antrun step copies it to `Client/openapi.json`. `clean` makes the compiler run
  again when the classes are current. The image is built without the profile, so it does not
  change.
- The same profile runs openapi-generator-maven-plugin 7.25.0 in Client, which writes
  `Client/OpenApiGenerator/`. A build without the profile compiles it as it is.
  `Client/.openapi-generator-ignore` leaves out the build files the generator writes for a project
  of its own, and `hideGenerationTimestamp` keeps the date out of the sources.
- `npm run rb -- client java:javalin` runs the command and fails if anything under `Client/`
  changed.
- `UnitTests/.../ClientTests.java` calls the Implementation JavalinTest started through the client.

What the document leaves out:

- The CORS preflight and `/static`, which no route answers.
- The type of an echo. An echoed payload is `Echoed<T>`, and `@OpenApiContent` names a class, so
  the document gives the echo as an object and the client reads it as a map of doubles.
- The refusals' bodies. The annotations name the 400, 403, 404 and 304 answers without content.
- The sse and stream answers' framing. The annotations describe each as one Item, in
  text/event-stream and application/x-ndjson.
- The form models. The generator makes the urlencoded form's fields and the multipart parts
  parameters of the client's methods.
