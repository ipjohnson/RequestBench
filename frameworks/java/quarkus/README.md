# Quarkus

Quarkus 3.39.4 with Quarkus REST on Vert.x 4.5, running on Java 25, answering the RequestBench
corpus. The contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Quarkus builds the application ahead of time from the extensions Implementation's pom names, and
every family uses a Quarkus extension, Quarkus REST, or the Vert.x router Quarkus serves. The
project has the shape code.quarkus.io writes for Quarkus 3.39.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module with the `quarkus` packaging. One resource class per corpus family under `src/main/java/implementation/routes/`. |
| `container-h1/` | The `Dockerfile` that builds the image container-h1 runs. |
| `container-h2/` | The `Dockerfile` that builds the image container-h2 runs, as container-h1's, because Quarkus's Vert.x server answers HTTP/2 with prior knowledge on a plain port by default. |
| `lambda-emulator/` | How lambda-emulator starts it. `Dockerfile` builds the function as a native executable with Implementation's `lambda-emulator` profile, which adds quarkus-amazon-lambda-http and turns on Quarkus's native build, and puts it on the `provided.al2023` base image. `bootstrap` starts the executable. |
| `UnitTests/` | `@QuarkusTest` classes driven with REST Assured, which Implementation's pom compiles as its tests. |
| `Client/` | The OpenAPI document SmallRye OpenAPI writes, and a Maven module that generates a REST Client from it. |
| `client-exception/` | How the corpus reads Quarkus's error bodies. |
| `pom.xml` | The two modules, with the Quarkus platform BOM, which pins every extension and library. |

`@QuarkusTest` builds the application from the module its tests are in, and Quarkus REST treats
only that module's classes as the application's. From a module of its own, the suite would test an
application built differently from the image: with the payload records outside the application,
Quarkus REST gives their routes no default `application/json`, so it compresses none of them and
answers HEAD with no content type. So UnitTests/ has no pom, and Implementation's names it as the
test sources, as axum's `Cargo.toml` names UnitTests/.

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/quarkus-app/quarkus-run.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 25 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which the
Implementation loads while Quarkus starts, before it opens its socket. The tests fall back to
`tests/payloads` when it is not set. `PORT` defaults to 8080. Each test carries its corpus ids as
JUnit tags, so `-Dgroups=<id>` runs the tests of one.

The image runs the fast-jar under `target/quarkus-app/`, copied as Quarkus's own `Dockerfile.jvm`
copies it.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The resource method returns the string, and Quarkus REST writes it as text/plain. | Quarkus REST |
| json | The resource method returns the record, and Quarkus REST's Jackson writer serialises it. | Quarkus REST |
| middleware | No-op `@ServerRequestFilter` methods, four or sixteen, each bound to its route by a `@NameBinding` annotation. | Quarkus REST |
| parameters, query, headers | `@RestPath`, `@RestQuery` and `@RestHeader` parameters, and query.many's eight values bound into a record as a `@BeanParam`. | Quarkus REST |
| body | Jackson binds the order record. `@Valid` runs its Bean Validation constraints through Hibernate Validator, and Quarkus refuses a body that breaks one with its violation report. | quarkus-hibernate-validator |
| authorized | A permission in `application.properties` puts `/authorized/*` under `BearerTokenPolicy`, an `HttpSecurityPolicy` that permits settings.json's bearer token and denies any other. | quarkus-security |
| cache | `@CacheResult` on each resource method, over the extension's default Caffeine caches. | quarkus-cache |
| compressed | Quarkus's HTTP compression, on for the whole server, at gzip's fastest level. | Quarkus, over Vert.x |
| etag | Jakarta REST's `Request.evaluatePreconditions` answers a matching `If-None-Match` with 304. The handler hashes the serialised body with SHA-1 for the tag. | Jakarta REST, and the hash by hand |
| template | Qute, with a type-safe `@CheckedTemplate`. | quarkus-rest-qute |
| items | One resource method per HTTP method on `/items/{id}`. Jakarta REST answers HEAD with the GET method. | Quarkus REST |
| errors | Quarkus REST's 405, Jackson's 400 and the items handlers' `NotFoundException`, all with no body, and the Vert.x router's 404 page. | Quarkus REST and Vert.x |
| cors | Quarkus's CORS filter, configured from settings.json through the `HttpSecurity` event. | Quarkus |
| forms | `@RestForm` binds the urlencoded fields into a record, and the multipart file part arrives as a `FileUpload`. | Quarkus REST |
| stream | A `Multi` of the rows from a method that produces `application/x-ndjson`, written a line per row. | Quarkus REST |
| sse | A `Multi` of the rows from a method that produces `text/event-stream`, sent as one event per row. | Quarkus REST |
| static | Vert.x's `StaticHandler` over the payload directory under `/static/`, installed on Quarkus's router by a `StartupEvent` observer. | Vert.x, through Quarkus |

## Notes

- `RestApplication` is annotated `@NonBlocking`, which makes the Vert.x I/O thread that read a
  request the default for every resource method. Quarkus REST would otherwise run a method that
  returns a plain object on a worker thread, and a method that returns a `Uni` or a `Multi` on the
  I/O thread. No handler here blocks.
- quarkus-security puts two handlers in front of every route, one that authenticates and one that
  checks permissions, and neither can be narrowed to a path. `quarkus.http.auth.proactive=false`
  makes the first only defer the identity until something asks for it. The second matches each
  path against `/authorized/*` and lets any other through. That is what every other row pays for
  the authorized family.
- With no authentication mechanism installed, Quarkus answers a denied request with the challenge
  of its fallback mechanism, which is a 403 with no body. A request with no token is refused the
  same way. `BearerTokenPolicy` never asks for the identity, so a permitted request is not
  authenticated at all.
- Quarkus's CORS filter is one filter for the whole server, run before routing, and nothing
  narrows it to `/cors`. A request with no `Origin` passes it after one header lookup, so the other
  rows pay little, but the allowed origin gets the policy from every route, and `cors.scoped` is
  skipped. The policy comes from settings.json, so it is set through the `HttpSecurity` event,
  which Quarkus marks experimental, where `quarkus.http.cors.*` would copy it by hand.
- Quarkus's compression is one switch for the whole server. It marks every answer
  `Content-Encoding: identity` and takes the mark off an answer whose type is in
  `quarkus.http.compress-media-types`, and Vert.x's compressor sits in every connection. An answer
  with no body passes the compressor untouched, so the 304 and Quarkus REST's refusals keep the
  mark on the wire. Vert.x compresses at any size, so `/compressed/small`'s 123 bytes go out as
  133. It sends no `Vary: Accept-Encoding`.
- Hibernate Validator keeps a bean's constraints in a set whose iteration order changes from one
  JVM to the next, and its fail-fast mode is one setting for the whole application. The first-error
  route binds a record of its own, `FirstErrorOrder`, whose group sequence validates one field at
  a time in declaration order and stops at the first that fails.
- The cache routes return a `Uni`. `@CacheResult` waits for a plain return value by blocking, which
  the I/O thread refuses, and for a `Uni` it stores the item. What it stores is the whole answer,
  so a replay carries the `x-rb-serial` it was written with. A lone argument is the key itself,
  and the cache takes no null key, so `/cache/vary/one` keys a request with no `x-rb-tenant` as
  empty.
- The Caffeine caches have no expiry and no size limit, so settings.json's capacity and TTL are not
  applied. The ladder's load lasts about four minutes, well inside the hour the TTL gives.
- `quarkus.http.static-dir` reads its directory while the application is built and packages every
  file in it, which would copy the payloads into the build. The `/static/*` route is the Router
  observer Quarkus's HTTP reference shows, with Vert.x's `StaticHandler` over `RB_PAYLOADS`.
- Quarkus REST writes each multipart file part under `${java.io.tmpdir}/uploads` before the handler
  runs, and deletes it when the request ends.
- The container runs `java -jar` as PID 1 with the collector and heap the JVM chooses. The JVM
  reads the container's CPU quota, counts 2 CPUs under `--cpus 2` and chooses G1. On SIGTERM
  Quarkus shuts down and exits in under a second. At startup the JDK warns that brotli4j, which
  Quarkus's HTTP extension ships beside Netty, loads a native library. Brotli is not among the
  compressors.
- On lambda-emulator the function is a native executable, and the other hosts run the JVM. Quarkus's
  native build makes it with Mandrel 25.0.4.1 on `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image`,
  the builder image Quarkus's native guide names. Its glibc is 2.34, which is Amazon Linux 2023's.
- The application answers behind quarkus-amazon-lambda-http 3.39, Quarkus's extension for API
  Gateway payload format 2.0. In the native executable the extension's own poll loop asks the
  Runtime API for each event, and hands it to Vert.x's router through a virtual connection, with
  no socket. The extension buffers the whole answer, so the sse and stream tests are listed as
  unsupported there.
- The virtual connection has no compressor, so compressed.gzip_large's answer arrives
  uncompressed, and the test is listed as unsupported there.
- The native build changed the application in two places. `Settings` is annotated
  `@RegisterForReflection`, because only `Payloads` reads it, and Quarkus REST registers the types
  its resource methods take and return. `application.properties` names
  `META-INF/vertx/vertx-version.txt` in `quarkus.native.resources.includes`, because `/__meta` reads
  the Vert.x version from it.
- `bootstrap` starts the executable with `-Drb.adapter`, the adapter `/__meta` names, as the
  bootstrap example Quarkus writes beside `function.zip` passes system properties. A native image
  reads them from its command line and keeps none it was built with. `/__meta` adds `native image`
  to the runtime when Quarkus's `ImageMode` says it runs in one.
- When the Runtime API goes away, the poll loop stops the application, but the executable keeps
  running until SIGTERM. The main thread waits in `Quarkus.run` for an exit, and stopping the
  application does not ask for one.
- `/__meta` has no `bootMs` on lambda-emulator. It is taken when the HTTP server starts, and the
  function starts none.
- The executable runs with native-image's defaults: the serial collector, a maximum heap of 80% of
  the memory it sees, and code for native-image's default machine, which is x86-64-v3 on amd64 and
  armv8.1-a on arm64. The function runs on one core.

## Refusals

Every refusal is what Quarkus writes. Nothing reshapes it. `order.invalid` binds and breaks all
three rules, so Hibernate Validator refuses it, and Quarkus answers 400 with its violation report:
`title`, `status`, and a `violations` entry per field, named by its property path after the
method and the parameter, such as `validateSmall.order.customerId`. The first-error route lists
one. A body Jackson cannot read never reaches the validator and is refused with a 400 and no body.
Under `@QuarkusTest`, Quarkus answers a value of the wrong type with a body that names it, where
the image answers with none. A missing row and a method the path lacks answer 404 and 405 with no
body. A path no resource matches is passed on to the Vert.x router, which answers 404 with its
HTML page.

## Client

`Client/` holds the OpenAPI document SmallRye OpenAPI writes for the routes, and a module that
generates a Java client from it. The generator is the Quarkiverse OpenAPI Generator, the REST
Client generator in Quarkus's extension catalog. It writes a Quarkus REST Client: one interface
per resource class, and the model classes.

- `mvn -B -P client,!suite package -Dmaven.test.skip=true` builds Implementation with the `client`
  profile, which adds quarkus-smallrye-openapi. SmallRye OpenAPI builds the document from the
  routes while Quarkus builds the application, and `quarkus.smallrye-openapi.store-schema-directory`
  writes it to `Client/src/main/openapi` as `openapi.json` and `openapi.yaml`. Only the profile adds
  the extension, so the image, built without it, does not serve `/q/openapi`.
- The generator is a Quarkus code generator. Every build of the Client module runs it in
  `quarkus:generate-code`, which writes the client under `target/generated-sources` and has no
  setting for another directory. So `Client/` commits the document alone, and every build
  generates the client from it, as the extension's documentation describes. It reads
  `openapi.json` and leaves out `openapi.yaml`.
- `!suite` turns off the profile that makes the Client a test dependency of Implementation, so the
  reactor builds Implementation first and the generator reads the document just written.
  `-Dmaven.test.skip=true` leaves the suite out, because its client tests need that profile.
- `npm run rb -- client java:quarkus` runs the command and fails if anything under `Client/`
  changed.
- `UnitTests/.../ClientTests.java` calls the application `@QuarkusTest` started through the client,
  built with `QuarkusRestClientBuilder` for the test's port.

Three more settings of the `client` profile apply to the document run alone. The generator's
OpenAPI 3.1 support is in beta and writes an inline copy of each referenced schema, such as
`ItemsIdGet200Response` for `Item`, so the document is written as OpenAPI 3.0.3. The template
routes return a Qute `TemplateInstance`, which SmallRye OpenAPI would describe down to Qute's
internals, so `mp.openapi.schema.io.quarkus.qute.TemplateInstance` describes it as a string. The
servers SmallRye OpenAPI adds by default come from the build's port setting, so none are added.

What the document leaves out:

- The CORS preflight and `/static`, which no resource method answers.
- HEAD on `/items/{id}`, which Jakarta REST answers with the GET method.
- The 201 of `POST /items` and the 304 of the etag family.
- The multipart form, which is described as a urlencoded one.
- Every operation id. The generator names each method from its path and its HTTP method, such as
  `jsonSmallGet`, and warns for each.
