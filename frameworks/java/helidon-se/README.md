# Helidon SE

Helidon SE 27.0.0 on Helidon's own WebServer, running on Amazon Corretto 27, answering the
RequestBench corpus.
The contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Helidon SE is Helidon's imperative flavour: a WebServer that runs each request on a virtual thread,
with routes, filters and error handlers registered in code on `HttpRouting`. Every family uses
Helidon's own facility where Helidon has one. The cache and etag families are wired by hand,
because Helidon SE has neither for an answer a handler writes.

Helidon 27's jars are compiled for Java 27. Temurin, which the other Java frameworks run on, has
published no Java 27 image yet, so this port builds and runs on Amazon Corretto 27.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module. `Main` builds the server, and one `HttpFeature` per corpus family under `src/main/java/implementation/routes/` registers that family's routes. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `UnitTests/` | JUnit tests of the wiring, a Maven module that starts the Implementation on a random port with Helidon's `@ServerTest`. |
| `client-exception/` | How the corpus reads Helidon's error bodies. |
| `pom.xml` | The two modules, under Helidon's SE application parent, which pins every Helidon module and plugin through Helidon's BOM. It also pins Thymeleaf, which the parent does not manage. |

There is no client, because Helidon SE writes no OpenAPI document from its routes. The Client
section says why.

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/implementation.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 27 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which `Main`
loads before it starts the server. The tests find `tests/payloads` themselves when it is not set.
`PORT` defaults to 8080. Each test carries its corpus ids as JUnit tags, so `-Dgroups=<id>` runs
the tests of one.

The jar is packaged as Helidon's SE quickstart packages an application. Its manifest names each
dependency under `libs/`, which the parent's `copy-libs` fills in `target/`, and the image copies
both. Helidon's annotation processors run in the build. They write a JSON converter for each
`@Json.Entity` record and a validator for each `@Validation.Validated` one, and register both with
Helidon's service registry.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler sends the string, and Helidon's string media support writes it as text/plain. | Helidon |
| json | The handler sends the record, and Helidon JSON Binding writes it with the converter generated for it. | Helidon JSON Binding |
| middleware | No-op routes, four or sixteen, each registered for its one path ahead of the handler, passing the request on with `res.next()`. | Helidon |
| parameters, query, headers | The handler reads the path's parameters, the parsed query and the headers by name, and Helidon's mapper converts the numbers with `asInt()`. | Helidon |
| body | Helidon JSON Binding reads the order record on every route. The validate routes check it with Helidon Validation's `TypeValidation`, and the routing's error handler answers a `ValidationException` with 400. | Helidon JSON Binding and Helidon Validation |
| authorized | Helidon Security, through `SecurityFeature.secure()` on the route. `HeaderAtnProvider` takes the bearer token as the user, and an authorization provider permits settings.json's token alone. Helidon Security answers a denial with 403. | Helidon Security |
| cache | A store and a replay in the handler, keyed by the path and the route's vary headers. | by hand |
| compressed | Helidon's content encoding on the server's listener, with gzip alone, at the fastest level. | Helidon |
| etag | The handler hashes the JSON it is about to send with SHA-1 into the ETag, and answers 304 when If-None-Match names it. | by hand |
| template | Thymeleaf's own engine, run by the handler over `templates/items-page.html`. | Thymeleaf |
| items | One route per method on `/items/{id}`, and a HEAD route of its own. | Helidon |
| errors | The router's 404, Helidon JSON Binding's 400, and the items handlers' `NotFoundException`. | Helidon |
| cors | `CorsFeature`, with its one policy on `/cors/*`. | Helidon |
| forms | Helidon's media support reads the urlencoded body into `Parameters`, the type the query string is parsed into, and the multipart body part by part. | Helidon |
| stream | The handler writes each row and a newline to the response's output stream, and flushes it. | Helidon |
| sse | `SseSink`, one event per row. | Helidon |
| static | `StaticContentFeature` over the payload directory, under `/static`. | Helidon |

## Notes

- The port runs on Amazon Corretto 27, not on Temurin 25 like the other Java frameworks, because
  Helidon 27's jars need Java 27 and Temurin has no Java 27 image yet.
- Helidon JSON Binding and Helidon Validation are Helidon's own, and both were preview APIs in 4.5.
  Helidon 4.4 introduced Helidon JSON, and Helidon 27 uses it throughout its core. Of Helidon's JSON
  media supports it is the one that refuses a body it cannot read with a 400 of its own. The
  Jackson, JSON-B, JSON-P and Gson supports let the parser's exception through, which Helidon
  answers with 500 and a logged stack trace. The build passes `-Ahelidon.api.preview=ignore`,
  because each generated converter would otherwise warn of the preview.
- Helidon JSON Binding's annotation processor writes a converter for a generic record that does not
  compile. `Echoed` holds its echo as an `Object`, which the binding writes with the converter of
  its runtime type.
- Helidon leaves TCP_NODELAY off, and writes the last chunk of a chunked answer in a write of its
  own. With Nagle's algorithm on, the end of every chunked answer waits for the client to acknowledge
  the data before it, which a delayed acknowledgement puts off by about 40 ms. `Main` turns
  TCP_NODELAY on through `connectionOptions`, which Helidon's performance guide names for such
  workloads.
- Helidon tries a request's routes in the order they were registered, and a route matches the
  method and the path together. The literal `/parameters/static/segment/literal` is registered
  before the capture that also matches it. Each middleware layer is a route registered ahead of the
  handler on its path. A method a path has no route for gets the same 404 as a path with none.
- Helidon answers HEAD only where a route names it, and writes any body a handler sends.
  `/items/{id}` has a HEAD route of its own, which looks the row up and answers its content type
  with no body. Helidon adds `Content-Length: 0`.
- `SecurityFeature` puts a filter in front of every route. It builds a security context from every
  request's headers, path and query, whether or not the route asks for security. Helidon Security
  has no setting that registers it for one path, so every other row pays for it. A request with no
  token fails authentication, which Helidon Security answers with 401. A wrong token authenticates
  as another user, whom the authorization provider denies.
- `CorsFeature`'s filter also runs on every route. For a request with no Origin header it reads that
  header and does nothing more. Unless `addDefaults` is off, the feature adds a policy for every
  path that allows any origin. Each list in a path's policy defaults to `*`, which an added value
  would keep, so `CorsRoutes` sets the lists whole.
- Helidon's content encoding belongs to the server's listener, so it covers every route, and a
  request that asks for gzip on any route gets it. A request without Accept-Encoding pays for the
  lookup. An answer a handler sends as bytes, such as a cache or etag answer, is copied once more
  whenever an encoding is configured, even when the request asks for none.
- The frameworks here compress at gzip's fastest level wherever the level can be set.
  `GzipEncoding` writes through a `GZIPOutputStream` at the JDK's default level and has no setting
  for it, so `FastestGzip` wraps it and deflates at `Deflater.BEST_SPEED`. There is no size
  threshold, so `/compressed/small`'s 123 bytes are gzipped too.
- Helidon closes the connection after it refuses a body Helidon JSON Binding cannot read, because
  the binding's `HttpException` does not ask to keep it, so errors.malformed pays for a reconnect
  each time under load.
- The cache store keeps every key for the life of the process, so settings.json's capacity and TTL
  are not applied. The cache family stores 13 keys, and the ladder's load lasts about four minutes,
  well inside the hour the TTL gives.
- Helidon's test extension gives the suite's server builder the features Helidon's service registry
  holds, a `CorsFeature` that allows every origin among them. `Main.setup` sets the server's feature
  list whole, which replaces them.
- Thymeleaf logs through SLF4J, and no SLF4J provider is on the class path, so it logs nothing, and
  SLF4J says so once at startup.
- The container runs `java -jar` as PID 1 with the collector and heap the JVM chooses. The JVM
  reads the container's CPU quota, counts 2 CPUs under `--cpus 2`, and sizes the carrier threads of
  Helidon's virtual threads to match. On SIGTERM Helidon's shutdown hook stops the server.

## Refusals

Every refusal but one is what Helidon writes. Helidon writes no body for an order that breaks a
rule, and the routing's error handler writes one.

- `TypeValidation` throws a `ValidationException` for an order that breaks a rule.
  helidon-webserver-validation, Helidon's own mapping of one, answers 400 with no body and closes
  the connection, so the refusal names no field. The routing's error handler answers the exception
  as Helidon's SE quickstart answers a body it refuses: 400, and the exception's own message under
  `error`. The message lists each violation with the path Helidon recorded for it, such as
  `0 is not positive at TYPE(implementation.OrderRequest)/RECORD_COMPONENT(customerId)`. A list
  entry's path records no index.
- Helidon Validation reports every rule an object breaks and has no setting to stop at the first.
  The first-error route asks `TypeValidation` about one record component at a time, in the order
  `OrderRequest` declares them, and stops at the first that fails. Its message names that one, with
  a path that starts at the component.
- A body Helidon JSON Binding cannot read never reaches the validator. The media support throws an
  `HttpException` with 400, which Helidon writes as text/plain:
  `Failed to deserialize JSON request entity`.
- A path no route matches, and a method a path has no route for, get the router's 404, with
  `Endpoint not found` as text/plain. A missing row is the handler's `NotFoundException`, which
  Helidon writes the same way with its message.
- A wrong token is Helidon Security's 403, with no body.

## Client

Helidon SE writes no OpenAPI document from its routes. helidon-openapi serves a static document
the application packages, and reads nothing from `HttpRouting`. Helidon 27 previews generating one
for Helidon Declarative's endpoints, which are annotated classes rather than SE routing.
