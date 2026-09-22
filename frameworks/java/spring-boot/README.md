# Spring Boot

Spring Boot 4.1.1 with Spring MVC on Tomcat 11, running on Java 25, answering the RequestBench
corpus. The contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Spring Boot configures Spring MVC, Tomcat, Jackson and each Spring project a family reaches for,
from the starters Implementation's pom names. Every family uses Spring's own facility where Spring
has one.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, a Maven module. One controller per corpus family under `src/main/java/implementation/routes/`. |
| `UnitTests/` | JUnit tests of the wiring, a Maven module that boots the Implementation on a random port with `@SpringBootTest`. |
| `Client/` | The OpenAPI document springdoc serves, and the Kiota client generated from it, a Maven module. |
| `client-exception/` | How the corpus reads Spring Boot's error bodies. |
| `pom.xml` | The three modules, under Spring Boot's starter parent, which pins every dependency and plugin. |

## Building, running and testing

```sh
mvn -B package -DskipTests
RB_PAYLOADS=../../../tests/payloads PORT=8080 java -jar Implementation/target/implementation-0.0.0-exec.jar
mvn -B test
mvn -B test -Dgroups=body.rejected_first
```

The build needs JDK 25 and Maven 3.9. `RB_PAYLOADS` names the payload directory, which the
Implementation loads while the context starts, before Tomcat listens. The tests find
`tests/payloads` themselves when it is not set. `PORT` defaults to 8080. Each test carries its
corpus ids as JUnit tags, so `-Dgroups=<id>` runs the tests of one.

The executable jar has the `exec` classifier. Spring Boot's repackage would otherwise replace the
plain jar that UnitTests compiles against.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and Spring MVC's string converter writes it as text/plain. | Spring MVC |
| json | The handler returns the record, and Spring MVC's Jackson 3 message converter writes it. | Spring MVC |
| middleware | No-op servlet filters, four or sixteen, each registered for its one path. | the Servlet API, through Spring Boot |
| parameters, query, headers | `@PathVariable`, `@RequestParam` and `@RequestHeader` parameters, and query.many's eight values bound into a record through its constructor. | Spring MVC |
| body | Jackson binds the order record. `@Valid` runs its Bean Validation constraints through Hibernate Validator, and Spring MVC refuses a body that breaks one with 400. | Spring MVC and Hibernate Validator |
| authorized | Spring Security on `/authorized` alone, with a rule that permits settings.json's bearer token and denies any other. | Spring Security |
| cache | `@Cacheable` on each handler, over Boot's default `ConcurrentMapCacheManager`. | Spring |
| compressed | Tomcat's compression on the whole connector, turned on in `application.properties`. | Tomcat |
| etag | `ShallowEtagHeaderFilter` registered for `/etag/*`, which hashes the written body with MD5 and answers a matching `If-None-Match` with 304. | Spring |
| template | Thymeleaf, through Spring MVC's view resolution. | Thymeleaf |
| items | One handler per method on `/items/{id}`. Spring MVC answers HEAD with the GET handler. | Spring MVC |
| errors | DispatcherServlet's 404 and 405, Jackson's 400 and the items handlers' `ResponseStatusException`, each written by Boot's error page. | Spring Boot |
| cors | Spring MVC's CORS support, mapped to `/cors/**`. | Spring MVC |
| forms | Tomcat parses both bodies into request parameters. The form binds to query.many's record, and the file part arrives as a `MultipartFile`. | Spring MVC |
| stream | `StreamingResponseBody`, writing and flushing one row per line. | Spring MVC |
| sse | `SseEmitter`, one event per row. | Spring MVC |
| static | Spring MVC's resource handling over the payload directory, under `/static/`. | Spring MVC |

Choices a reader might not expect:

- Spring Boot registers Spring Security's filter for every path and has no setting that narrows
  it. `Application` excludes that registration, and `AuthorizedSecurity` registers the filter for
  `/authorized/*` alone, so no other route pays for it. Boot's generated user is excluded too,
  because nothing signs in with a password. With no way to sign in configured, Spring Security
  answers a denied request through its `Http403ForbiddenEntryPoint`, which is the 403 the corpus
  asks for. A request with no token is refused the same way. The session policy is stateless, so
  a denial does not open a session to save the request in.
- Hibernate Validator keeps a bean's constraints in a set whose iteration order changes from one
  JVM to the next. Its fail-fast mode alone named customerId, status or lines, varying across eight
  runs. The first-error route binds a record of its own, `FirstErrorOrder`, whose group sequence
  validates one field at a time in declaration order and stops at the first that fails.
- Boot 4 renamed `server.error.include-binding-errors` to
  `spring.web.error.include-binding-errors`, and the old name does nothing. Without the setting,
  Boot's error page leaves the field errors out.
- The handlers that write `x-rb-serial` set it on the `HttpServletResponse` and return the record,
  so their answers go out the way json.small's does. Spring MVC flushes the answer of a handler
  that returns a `ResponseEntity`, so Tomcat sends it chunked and, when gzip is asked for,
  compresses it at any size. The cache routes return a `ResponseEntity` all the same, because the
  cache stores what the method returns and a replayed answer has to carry its serial. items.create
  returns one for its 201 and `Location`.
- Tomcat compresses an answer when the client asks for gzip, the type is compressible, and the
  length is unknown or at least 2 KB. `/compressed/small`'s 123 bytes are buffered whole, so Tomcat
  knows the length and sends them as they are. Tomcat adds `Vary: accept-encoding` to every answer
  it might have compressed.
- Every other framework here compresses at gzip's fastest level. Tomcat has no setting for it:
  `server.compression.enabled` is off, on or force, and its filter writes through a
  `GZIPOutputStream`, which deflates at zlib's default level. So this family's answers leave this
  framework compressed harder, and its compressed rows are not read against another framework's.
- Tomcat closes the connection after a 400, so errors.malformed and the two body.rejected rows pay
  for a reconnect each time under load. It also closes a keep-alive connection after its 100th
  request. Both are Tomcat's defaults and are left alone.
- The simple cache provider has no expiry and no size limit, so settings.json's capacity and TTL
  are not applied. The ladder's load lasts about four minutes, well inside the hour the TTL
  gives.
- The container runs `java -jar` as PID 1 with the collector and heap the JVM chooses. The JVM
  reads the container's CPU quota, counts 2 CPUs under `--cpus 2` and chooses G1. On SIGTERM it
  runs Spring's graceful shutdown and exits in under a second.

## Refusals

Every refusal is what Spring writes, and Boot's error page writes every body: `timestamp`,
`status`, `error` and `path`, and `errors` for a body that broke a rule. Nothing reshapes it.
`order.invalid` binds and breaks all three rules, so Bean Validation refuses it and Spring MVC
answers 400 with an entry per field under `errors`. The first-error route lists one. A body
Jackson cannot read never reaches the validator, and is refused with a 400 that names no field.

## Client

`Client/` holds the OpenAPI document springdoc serves for the controllers and a Java client
generated from it. Spring Boot writes no document of its own, and springdoc is the project Spring
applications use, though not a Spring project. Spring recommends no client generator, so the
client is Kiota's.

- `mvn -B -Pclient verify -pl Client -am` builds Implementation with the `client` profile, which adds
  springdoc. `spring-boot:start` runs the application on port 18080 before `integration-test`,
  springdoc's Maven plugin reads `/v3/api-docs` into `Client/openapi.json`, and `spring-boot:stop`
  ends it. Only the profile adds springdoc, so the image, built without it, does not change.
- The same profile runs kiota-community's `kiota-maven-plugin` 0.0.39 in Client, with Kiota 1.35.0
  named, because the plugin's own default is 1.22.2. It downloads that release from GitHub and
  checks no hash. Kiota writes `Client/Kiota/`, which a build without the profile compiles as it is.
- The client registers no serializers, as Kiota's Java quickstart generates it.
  `microsoft-kiota-bundle`'s `DefaultRequestAdapter` registers them.
- `npm run rb -- client java:spring-boot` runs the command and fails if anything under `Client/`
  changed. Kiota's Linux binary needs libicu, which a GitHub runner has.
- `UnitTests/.../ClientTests.java` calls the Implementation on its random port through the client.

Three springdoc settings apply to the document run alone. The document is pretty-printed and its
keys ordered, so it reads as a diff. The controllers name no content type for their JSON answers,
which springdoc writes as `*/*` and Kiota reads as bytes, so the default is `application/json`.

What the document leaves out:

- The CORS preflight and `/static`, which no controller method answers.
- HEAD on `/items/{id}`, which Spring MVC answers with the GET method.
- The two template routes, whose handlers return a view name.
- The forms: the urlencoded body has no schema, and the multipart body is described as JSON.
- The 201 of `POST /items` and the 304 of the etag family.
- Under the `application/json` default, the SSE and stream routes are described as JSON objects
  named `SseEmitter` and `StreamingResponseBody`, the types their handlers return.
