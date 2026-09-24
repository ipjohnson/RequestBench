# Micronaut

Micronaut 5.1.5 on its Netty server, running on Java 25, answering the RequestBench corpus. The
contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Micronaut's annotation processors turn the controllers, beans and serialised types into bean
definitions, introspections and serialisers at compile time. Every family uses Micronaut's own
facility where Micronaut has one, from the Micronaut modules Implementation's pom names.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module. One controller per corpus family under `src/main/java/implementation/routes/`. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, with `micronaut.server.http-version` at 2.0, with which its Netty server answers HTTP/2 with prior knowledge. |
| `lambda-emulator/` | How lambda-emulator starts it. `Dockerfile` builds the function as a native executable with Implementation's `lambda-emulator` profile, which adds micronaut-function-aws-custom-runtime, micronaut-function-aws-api-proxy, micronaut-aws-lambda-events-serde and micronaut-http-client, and puts it on the `provided.al2023` base image. `bootstrap` starts the executable. |
| `UnitTests/` | JUnit tests of the wiring, a Maven module that boots the Implementation on a random port with `@MicronautTest`. |
| `Client/` | The OpenAPI document micronaut-openapi writes, and the declarative client generated from it, a Maven module. |
| `client-exception/` | How the corpus reads Micronaut's error bodies. |
| `pom.xml` | The three modules, under `micronaut-parent`, which imports the Micronaut platform's BOM and pins every dependency and plugin through it. It names the annotation processors every module compiles with. |

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/implementation-0.0.0.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 25 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which Micronaut
reads as the property `rb.payloads`. The Implementation loads it while the context starts, before
Netty listens. The tests find `tests/payloads` themselves when it is not set. `PORT` defaults to
8080. Each test carries its corpus ids as JUnit tags, so `-Dgroups=<id>` runs the tests of one.

micronaut-maven-plugin's lifecycle for jar packaging shades the application and its dependencies
into `implementation-0.0.0.jar`, which the image runs. It keeps the plain jar as
`original-implementation-0.0.0.jar`.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and Micronaut writes it as text/plain, the type its `@Get` produces. | Micronaut |
| json | The handler returns the record, and Micronaut Serialization writes it with the serializer its processor generated. | Micronaut Serialization |
| middleware | No-op `@RequestFilter` methods, four or sixteen, each a filter of its own, in a `@ServerFilter` class whose pattern is the route's path. | Micronaut |
| parameters, query, headers | `@PathVariable`, `@QueryValue` and `@Header` parameters, and query.many's eight values bound into a record as a `@RequestBean`. | Micronaut |
| body | Micronaut Serialization binds the order record. `@Valid` runs its Bean Validation constraints through micronaut-validation, and Micronaut refuses a body that breaks one with 400. | Micronaut and micronaut-validation |
| authorized | micronaut-security on `/authorized` alone, with a `TokenValidator` that gives settings.json's bearer token the role the route's `@Secured` asks for. | micronaut-security |
| cache | `@Cacheable` on a bean's methods, over one Caffeine cache per route, sized and aged by settings.json. | micronaut-cache |
| compressed | The Netty server's compression on the whole server, at gzip's fastest level, set in `application.properties`. | Micronaut |
| etag | A `@ResponseFilter` on `/etag/**` hashes the serialised body with SHA-1 and answers a matching `If-None-Match` with 304. | by hand |
| template | Thymeleaf, through Micronaut Views. The handler returns a `ModelAndView`, and micronaut-views' body writer renders it. | Micronaut Views |
| items | One handler per method on `/items/{id}`. `@Get` registers a HEAD route beside the GET. | Micronaut |
| errors | The router's 404 and 405, the parser's 400, and the 404 Micronaut answers for a handler that returns null, each written by Micronaut's default error processor. | Micronaut |
| cors | Micronaut's `CorsFilter`, with a configuration built from settings.json when Micronaut creates the server's CORS configuration. | Micronaut |
| forms | Micronaut binds the urlencoded form to query.many's record, and the multipart parts to the handler's parameters, the file part as a `CompletedFileUpload`. | Micronaut |
| stream | The handler returns a `Publisher` of each row's JSON and a newline, and Micronaut writes each element as a chunk. | Micronaut |
| sse | The handler returns a `Publisher` of `Event`, and Micronaut writes each one's data as JSON, as one event. | Micronaut |
| static | Micronaut's static resource router over the payload directory, mapped to `/static/**` in `application.properties`. | Micronaut |

## Notes

- micronaut-security refuses every route no rule allows, and its filter runs on every path unless
  `micronaut.security.filter.pattern` names others. `application.properties` sets it to
  `/authorized/**`, so no other route pays for the filter or is refused by it.
- micronaut-security answers a refused request with 401 when it is anonymous and with 403 when it
  is authenticated. `SettingsToken` authenticates every bearer token and gives the role to
  settings.json's token alone, so a token one character off is refused with 403. A request with no
  token is refused with 401.
- micronaut-validation reports every rule a body breaks and has no mode that stops at the first.
  The first-error route binds a record of its own, `FirstErrorOrder`, whose group sequence
  validates one field at a time in declaration order and stops at the first that fails.
- Micronaut answers HEAD from the `@Get` route and drops the body before it is encoded, so the
  answer has no Content-Type unless the handler sets one, and the read handler does. It has no
  Content-Length either, and Micronaut closes the connection after an answer with neither a length
  nor chunked encoding, so items.head pays for a reconnect each time under load. The load charges
  that reconnect to items.head.
  [micronaut-core issue 3685](https://github.com/micronaut-projects/micronaut-core/issues/3685)
  reports the missing length.
- Micronaut writes to a response while it answers with it, so one stored response cannot answer
  several requests. The cache stores the payload and the serial it was written with, and each cache
  handler builds its answer from them. Without a configuration, micronaut-cache creates a cache the
  first time a method names it, with no size limit and no expiry. `CacheRoutes.Caches` configures
  one per route from settings.json's capacity and TTL.
- The Netty server compresses an answer when the client asks for gzip, the type is text-based, and
  the length is unknown or at least 1 KB. `/compressed/small`'s 123 bytes go out as they are. The
  compression covers the whole server, so every answer pays the check of the request's
  Accept-Encoding.
- Micronaut computes no ETag for an answer a handler returns, so that family's filter is written
  for it. It serialises the payload the handler returned and sends those bytes as the body, so the
  payload is serialised once.
- Micronaut's CORS configuration names origins and no path, so the policy covers every route. The
  per-route `@CrossOrigin` takes its policy as annotation constants, which would copy
  settings.json's policy into the source. rb.json skips cors.scoped for that reason. `CorsFilter`
  is on every route, and a request with no Origin header skips it.
- Without a policy for the request's origin, `CorsFilter` refuses a cross-origin request with 403
  when the server is addressed as localhost or 127.x, to stop a page on another origin from
  reaching a server on the reader's machine. cors.disallowed's preflight gets that 403.
- micronaut-views renders a route annotated `@View` from a response filter that runs on every path.
  `application.properties` turns that filter off, and the template routes return a `ModelAndView`,
  which micronaut-views renders through its body writer.
- The router checks every scoped filter's pattern against every request's path: the twenty
  middleware layers, the ETag filter and micronaut-security's.
- The container runs `java -jar` as PID 1 with the collector and heap the JVM chooses. On SIGTERM,
  Micronaut's shutdown hook stops the server and the process exits in under a second.
- On lambda-emulator the function is a native executable, and the other hosts run the JVM. The
  `lambda-emulator` profile sets the packaging to `native-image`, whose package phase runs
  native-image through the GraalVM Native Build Tools. The image builds it with Oracle GraalVM
  25.0.4.1.1 on `container-registry.oracle.com/graalvm/native-image`, the image micronaut-maven-plugin
  builds native executables on. It is Oracle Linux 9, whose glibc is 2.34, which is Amazon Linux
  2023's. The plugin's own native Lambda build downloads the latest Oracle GraalVM, which no digest
  pins.
- The executable's main class is micronaut-function-aws-custom-runtime's
  `APIGatewayV2HTTPEventMicronautLambdaRuntime`, the runtime Micronaut's AWS guide names for payload
  format 2.0. It asks the Runtime API for each event with Micronaut's HTTP client, and reads it
  with Micronaut Serialization, for which micronaut-aws-lambda-events-serde imports the AWS event
  classes. It hands the event to micronaut-function-aws-api-proxy 5.1's
  `APIGatewayV2HTTPEventFunction`, which hands it to Micronaut's router through Micronaut Servlet's
  request and response. Netty serves nothing. The adapter buffers the whole answer, so the sse and
  stream tests are listed as unsupported there.
- The compression is the Netty server's, so compressed.gzip_large's answer arrives uncompressed on
  lambda-emulator. The adapter's request reads a multipart body as a urlencoded form and finds no
  parts, so forms.multipart's `@Part tenant` is missing and Micronaut answers 400. Both tests are
  listed as unsupported there.
- `APIGatewayV2HTTPEventFunction` registers each invocation's Lambda `Context` and its logger as
  singletons in the bean context, through micronaut-function-aws's `HandlerUtils`. Each
  registration adds a bean definition and first looks through the ones added before it, so an
  invocation takes longer the more invocations the function has served.
- The native build changed the application in two places. `Item` is annotated `@ReflectiveAccess`,
  because Thymeleaf reads each row's properties through OGNL, which uses reflection.
  `META-INF/native-image/dev.requestbench/implementation/reachability-metadata.json` names Netty's
  version resources, which `/__meta` reads.
- `bootstrap` starts the executable with the arguments micronaut-maven-plugin writes into a native
  function's bootstrap, and with `-Drb.adapter`, the adapter `/__meta` names. A native image reads
  system properties from its command line and keeps none it was built with. `/__meta` adds
  `native image` to the runtime when Micronaut's `NativeImageUtils` says it runs in one. It has no
  `bootMs` there, because no server starts to send the startup event that sets it.
- The executable runs with native-image's defaults: the serial collector, a maximum heap of 80% of
  the memory it sees, which the bootstrap's `-XX:MaximumHeapSizePercent=80` repeats, and code for
  native-image's default machine, which is x86-64-v3 on amd64 and armv8.1-a on arm64. The function
  runs on one core.

## Refusals

Every refusal is what Micronaut writes, and its default error processor writes every body: the
status's reason under `message`, the request's path under `_links.self`, and one entry per error
under `_embedded.errors`. Micronaut Serialization lists the errors even when there is one. Nothing
reshapes it. `order.invalid` binds and breaks all three rules, so micronaut-validation refuses it
with 400 and one error per rule. Each message is the property path from the handler's parameter
and the rule's message, as in `order.customerId: must be greater than 0`, and the errors are sorted
by message. The first-error route lists one. A body the parser cannot read never reaches the
validator. It is refused with 400 and one error whose `path` is the parameter, `/order`, and whose
message names no property.

## Client

`Client/` holds the OpenAPI document micronaut-openapi writes for the controllers, and a Java client
generated from it by Micronaut's OpenAPI generator. Both are Micronaut's own: micronaut-openapi's
annotation processor writes the document at compile time, and micronaut-maven-plugin's
`generate-openapi-client` goal generates declarative `@Client` interfaces and models.

- `mvn -B -Pclient clean compile -pl Client -am` compiles Implementation with the `client` profile,
  which adds micronaut-openapi's processor and names `Client/openapi.yml` as its target. Nothing
  starts, because the processor reads the controllers as they compile. Only the profile adds the
  processor, so the image, built without it, does not change. The command cleans first, because a
  compile that finds its classes up to date runs no processor.
- The same profile runs `generate-openapi-client` in Client, which writes `Client/Generated/`. A
  build without the profile compiles it as it is. The generator is micronaut-openapi-generator
  7.0.0 on OpenAPI Generator 7.22.0, the versions micronaut-maven-plugin 5.0.2 depends on.
- `npm run rb -- client java:micronaut` runs the command and fails if anything under `Client/`
  changed.
- `UnitTests/.../ClientTests.java` calls the Implementation on its random port through the client,
  whose base path is the property `openapi-micronaut-client.base-path`.

The document is YAML, micronaut-openapi's default. Its JSON is written on one line, which does not
read as a diff. The processor names each operation after its handler method and numbers a repeated
name in path order, so `/json/small` is the client's `small5()`. The client returns Reactor's
`Mono`, the generator's default.

What the document leaves out or describes otherwise:

- The CORS preflight, `/static` and HEAD on `/items/{id}`, which no controller method declares.
- The 201 of `POST /items`, the 204 and 404 of the items routes, the 304 of the etag family and
  every refusal. A handler that returns an `HttpResponse` names no status.
- The bind and validate answers' `echo`, which is an object with no properties, so the client holds
  it as a map.
- The stream route's answer, described as a list of binary strings, the SSE route's, described as
  a list of events, and the template routes', described as a `ModelAndView` object.
- The generated models check the document's rules before a request is sent. The document gives
  `customerId` an exclusive minimum of 0, which the generated model checks as `@Min(0)`, so the
  client sends a `customerId` of 0 and the Implementation refuses it.
