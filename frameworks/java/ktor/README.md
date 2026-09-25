# Ktor

Ktor 3.6.0 on its Netty engine and Netty 4.2, written in Kotlin 2.4 and running on Java 25, answering
the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Ktor is JetBrains' framework for HTTP servers in Kotlin. An application installs plugins and builds
its routes with Ktor's routing DSL, and a handler is a suspending function that responds through the
call. Most plugins can be installed on a route, where they serve that route and the routes under it
alone. Every family uses a Ktor plugin or a module of Ktor where Ktor has one. The response cache is
written for its family on Ktor's plugin API, because Ktor has none.

Ktor sits under `java` because the groups here are runtimes, as `node` holds the TypeScript
frameworks.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module. `Application.kt` holds `main`, which starts Netty through `EngineMain` and `application.conf`, and `corpus`, which installs the plugins the whole application uses. One file per corpus family under `src/main/kotlin/implementation/routes/` adds its routes and its route-scoped plugins. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs: the same jar, started with `-P:ktor.deployment.enableH2c=true`, which `EngineMain` reads as it reads `application.conf`. |
| `UnitTests/` | JUnit tests of the wiring, a Maven module. Each test runs the Implementation under Ktor's `testApplication`. |
| `Client/` | The OpenAPI document Ktor writes about its routes, the code that writes it, and the Java client Kiota generates from it, a Maven module. See [Client](#client). |
| `client-exception/` | How the corpus reads Ktor's error bodies. |
| `pom.xml` | The three modules. Ktor's BOM pins every Ktor module, so `ktor.version` is the one number that moves them. This pom pins that BOM, Kotlin, logback, JUnit's BOM and every plugin. |

Ktor's documentation covers Maven beside Gradle, and every other Java framework here builds with
Maven, so this one does too.

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/implementation-0.0.0.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 25 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which the module
loads before Netty listens. The tests find `tests/payloads` themselves when it is not set. `PORT`
overrides the port `application.conf` names, 8080. Each test carries its corpus ids as JUnit tags,
so `-Dgroups=<id>` runs the tests of one.

The jar is a plain one, which names its dependencies in `target/lib/` on its class path. A jar
shaded from all of them would keep one manifest, and `/__meta` reads Ktor's version, Netty's and
kotlinx.serialization's from the manifests of their own jars.

## Hosts

container-h1 and container-h2 run the same jar. On container-h2, `enableH2c` makes Ktor's Netty
pipeline answer a connection that opens with the HTTP/2 preface in HTTP/2.

There is no lambda-emulator. Ktor has no Lambda adapter, and its documentation never mentions
Lambda.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `call.respondText`, which writes the string as text/plain. | Ktor |
| json | `ContentNegotiation` with kotlinx.serialization's JSON converter, which encodes the payload, a `@Serializable` data class. | Ktor, kotlinx.serialization |
| middleware | No-op route-scoped plugins, four or sixteen of them, each with an empty `onCall` handler, installed on the route. | Ktor |
| parameters, query | `getOrFail`, which reads each value by name and converts the numbers with Ktor's data conversion. | Ktor |
| headers | The handler reads each header by name and converts the account itself, because Ktor binds no header. | by hand |
| body | `call.receive` binds the order through `ContentNegotiation`. On the validate routes, `RequestValidation` checks it as it is received, and `StatusPages` answers its exception with 400. | Ktor |
| authorized | The `Authentication` plugin's bearer provider, and a route-scoped plugin on the `AuthenticationChecked` hook that answers 403 for any token but settings.json's, as Ktor's documentation writes authorization. | Ktor |
| cache | A route-scoped plugin that replays a stored answer in `onCall` and stores the answer in `ResponseBodyReadyForSend`, one store for the process. | by hand, on Ktor's plugin API |
| compressed | The `Compression` plugin on the two routes, with its defaults. | Ktor |
| etag | The `ConditionalHeaders` plugin on the two routes, with a version provider that tags the body with Ktor's own SHA-1 of it. | Ktor |
| template | Thymeleaf, through Ktor's `Thymeleaf` plugin, as Ktor's website tutorial renders its pages. | ktor-server-thymeleaf |
| items | One route per method on `/items/{id}`, and the `AutoHeadResponse` plugin, which answers HEAD with the GET handler. | Ktor |
| errors | The router's 404, the `BadRequestException` a body that does not bind throws, and the items handlers' 404. | Ktor |
| cors | The `CORS` plugin, route-scoped on `/cors`. | Ktor |
| forms | `receiveParameters` parses the urlencoded form, read with `getOrFail`, and `receiveMultipart` hands the handler each part of the upload. | Ktor |
| stream | `respondTextWriter`, writing and flushing one row per line on a chunked answer. | Ktor |
| sse | The `SSE` plugin, whose `sse` route sends each row as the data of one event. | Ktor |
| static | `staticFiles` over the payload directory under `/static`, with `ConditionalHeaders` on the route for the file's `Last-Modified`. | Ktor |

Ktor's HTML DSL, kotlinx.html, is its other way to write a page, and it writes the doctype as
`<!DOCTYPE html>`. The corpus compares a page with `<!doctype html>` case for case, so the template
family uses a template file, and Thymeleaf writes its doctype as the file has it.

ktor-simple-cache, the response cache Ktor's project generator offers, keys a stored answer on the
path and the query alone, and stores the value the handler responded with rather than the answer.
A replay runs the serializer again without the headers the handler wrote, so it could neither vary
on a header nor repeat x-rb-serial. The cache family's plugin is written instead.

## Notes

- Ktor's router answers 405 for a method a path has no route for only when every segment it matched
  is a constant, such as `POST /json/small`. Under a capture it answers 404, so `POST /items/17` is
  404, and client-exception declares 404 as the wrong-method status. Its 405 carries no `Allow`
  header, which RFC 9110 requires.
- `ConditionalHeaders` is a route-scoped plugin, but it keeps the version providers of the last
  route it was installed on in the application's attributes, and every route that installs it reads
  them there. The etag and static routes install it with the same provider, the body tag, because
  with the default providers on `/static` the etag routes would send no ETag.
- Ktor's `staticFiles` writes `Last-Modified` only when `ConditionalHeaders` is installed, as its
  documentation says.
- Over HTTP/2, the SSE plugin's answer carries `content-type: text/event-stream` twice. Over HTTP/1.1
  it carries it once.
- The SSE plugin ends each line with CRLF, and adds `Cache-Control: no-store` and
  `X-Accel-Buffering: no` to the answer.
- `Compression` compresses at the JDK `Deflater`'s default level, 6, and has no setting for it, so
  the compressed rows run at level 6 rather than the fastest level most frameworks here use. It
  answers a request that asks for identity with `Content-Encoding: identity`.
- The CORS plugin refuses a preflight from an origin it does not allow with 403, and lists GET, HEAD
  and POST, the methods CORS calls simple, in `Access-Control-Allow-Methods` beside the policy's own.
- A request with no bearer token is not authenticated, and Ktor answers it with 401 and
  `WWW-Authenticate: Bearer`. Only a wrong token reaches the authorization plugin's 403.
- `AutoHeadResponse` runs the GET handler for HEAD, which encodes the row, and then leaves the body
  out with its `Content-Length` kept.
- `logback.xml` logs at INFO. The `logback.xml` Ktor's project generator writes logs at TRACE, at
  which Ktor logs how it routed every request.

## Refusals

Every refusal is Ktor's own, and nothing reshapes it.

- A body that breaks the rules is the `RequestValidationException` that `RequestValidation` throws
  with a reason for each rule, and `StatusPages` answers it with 400 and the reasons.
  `RequestValidation`'s documentation answers them through `StatusPages` too, joined into a line of
  text, and here they go out as a JSON array. Each reason starts with the field it is about, a line's
  field as `lines[0].qty`.
- `RequestValidation` runs whatever check it is given, and reports what the check returns. The
  first-error route's check stops at the first rule the order breaks, so its answer is the reason the
  full check would have listed first.
- A body that is not JSON, or does not bind to the order, is Ktor's `BadRequestException`, whose 400
  is a line of text that names no field.
- A path with no route is 404 with no body. A method a constant path has no route for is 405 with no
  body, and a method `/items/{id}` has no route for is 404.
- A missing row is 404 with a line of text, as Ktor's API tutorial answers one.
- A wrong bearer token is 403 with the text Ktor's authorization example writes.

## Client

`Client/openapi.json` is the document Ktor writes about its own routes. Under `-Pclient`,
Implementation compiles with the Ktor compiler plugin, which infers each route's parameters, body and
answers from its handler and registers them on the route, as Ktor's OpenAPI guide configures it for
Maven. `Client/document/Document.kt` then starts the application and writes the document Ktor
assembles from the routing tree. `Client/Kiota/` is the Java client Kiota 1.35.0 generates from the
document, through kiota-community's Maven plugin, because Ktor recommends no generator. The suite's
`ClientTests` call the Implementation through it.

```sh
mvn -B -Pclient verify -pl Client -am
```

- The compiler plugin, the runtime it registers the metadata with and the writer are in the profile
  alone, so the image, which is built without it, does not change.
- Ktor documents the routes that `staticFiles` and the CORS plugin add under a tailcard as
  `/static/{**}` and `/cors/{**}`, with a parameter named `**`, which Kiota writes into its Java as it
  is. Kiota's `excludePath` leaves both out of the client.
- Kiota reports as errors the three operations in the document that list no response, the SSE route
  and the two tailcards, in `Client/Kiota/client/kiota/.kiota.log`, and generates the client anyway.
