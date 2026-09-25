# NestJS

NestJS 12.1.0 on Node.js 26, answering the RequestBench corpus on its Express adapter, over Express
5.2.1, and on its Fastify adapter, over Fastify 5.12.5. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Nest is a Node framework for server applications, written in TypeScript. An application is built
from modules, controllers and providers, which Nest's dependency injection wires together. A
controller's decorators declare its routes, and the pipes, guards and interceptors that run around
each handler. Nest runs on an HTTP platform through an adapter: Express by default, or Fastify.
Every family uses a Nest facility where Nest has one, and the platform's own where Nest leaves the
family to the platform.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `app.module.ts` is the root module, which `AppModule.register` builds from the payloads and the platform. One directory per corpus family holds its controller and what else the family uses, such as a DTO, a guard or an interceptor. `express.ts` and `fastify.ts` set up what each platform needs for the whole application. `views/` holds the Handlebars view. |
| `container-h1/` | How container-h1 starts it. `main.ts` creates the application on the Express adapter and listens, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `main.ts` creates the application on the Fastify adapter with Fastify's `http2` option, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `handler.ts` creates the application on the Express adapter and exports the handler @codegenie/serverless-express makes of it, and `Dockerfile` builds the function on the `nodejs:26-preview` base image. |
| `UnitTests/` | Vitest tests of the wiring, sending each request through supertest, on both adapters. |
| `Client/` | The OpenAPI document @nestjs/swagger writes from the controllers, and the Kiota client generated from it. See [Client](#client). |
| `client-exception/` | How the corpus reads Nest's error bodies. |
| `package.json` | The dependencies, and the scripts that build, start and test the Implementation and write the client. |
| `package-lock.json` | What npm resolved, which the image installs. |
| `nest-cli.json`, `tsconfig.build.json` | How `nest build` compiles the application into `dist/`. |
| `tsconfig.json` | The compiler options, and what tsc checks: the source, the suite and the client. |
| `vitest.config.ts` | Where Vitest finds the suite. |

## Building, running and testing

```sh
npm ci
npm run build
RB_PAYLOADS=../../../tests/payloads PORT=8080 npm start
npm test
```

Nest's classes are written with decorators, which Node's type stripping does not run. So
`nest build` compiles the source with tsc into `dist/` and copies the view beside it, as Nest's CLI
builds a project. TypeScript stays at 6, because the Nest CLI compiles through TypeScript's
JavaScript API, which TypeScript 7 does not have. `npm test` checks the source with tsc and runs the
suite with Vitest, which compiles each file as it loads it.

`RB_PAYLOADS` names the payload directory, which each host loads before it creates the application.
`PORT` defaults to 8080. `npm start` runs container-h1's `main.ts`, and
`node dist/container-h2/main.js` runs container-h2's.

## Hosts

container-h1 runs the application on Nest's Express adapter, and container-h2 runs the same
application on Nest's Fastify adapter. The Express adapter has no HTTP/2 option. Fastify's `http2`
option starts Node's HTTP/2 server without TLS, which answers a connection that opens with the
HTTP/2 preface. The controllers are the same on both, and `express.ts` and `fastify.ts` set up what
differs.

lambda-emulator runs the application on the Express adapter behind @codegenie/serverless-express
5.0, as Nest's serverless recipe does. The recipe creates the application on the first event, because
a CommonJS handler cannot wait at the top of its module. `handler.ts` is an ES module, so it creates
the application while the runtime imports it, before the function asks for its first event.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and `@Header` sets its type to `text/plain`. | Nest |
| json | The handler returns the payload, and the platform writes it with `JSON.stringify`. | Nest |
| middleware | A functional middleware that calls `next` and nothing else, applied four or sixteen times to the route through the module's `MiddlewareConsumer`. | Nest |
| parameters | `@Param` reads each capture, and `ParseIntPipe` converts it to an integer. | Nest |
| query | `@Query` reads the query string. `ParseIntPipe` converts query.one's page, and `ValidationPipe` binds query.many's eight values to a DTO whose decorators convert the numbers. | Nest, class-validator, class-transformer |
| headers | `@Headers` reads each header by name. It takes no pipe, so the handler converts the account and throws `BadRequestException` for a header that is missing or no integer. | Nest |
| body | `ValidationPipe` on each validate route checks the body against class-validator's decorators on the order's DTO. The first-error route runs it over one field's DTO at a time, each made with `PickType`. The bind routes use no pipe, so their bodies are only parsed. | Nest, class-validator |
| authorized | A guard on the route lets settings.json's bearer token through, and Nest answers any other request with `ForbiddenException`'s 403. | Nest |
| cache | `CacheInterceptor` from @nestjs/cache-manager, over an in-memory Keyv store sized and aged by settings.json. Its `trackBy` is overridden to key on the route's vary headers as well as the URL, as Nest's caching guide customises it. | Nest, @nestjs/cache-manager |
| compressed | The compression middleware on Express, and @fastify/compress on Fastify, as Nest's compression guide installs each, at zlib's fastest level and a 1 kB threshold. | compression, @fastify/compress |
| etag | Express's `etag` setting, on by default. On Fastify, @fastify/etag. | Express, @fastify/etag |
| template | A Handlebars view rendered by `@Render`: hbs as Express's view engine, and @fastify/view with Handlebars on Fastify, as Nest's MVC guide sets up each. | Nest, hbs, @fastify/view |
| items | One handler per method on `/items/:id`, the id converted by `ParseIntPipe` and each body bound by `ValidationPipe`. Express and Fastify answer HEAD with the GET handler. | Nest |
| errors | Nest's not-found handler's 404, the body parser's 400, and the items handlers' `NotFoundException`. | Nest |
| cors | `enableCors`, which installs the cors middleware on Express and @fastify/cors on Fastify. | Nest |
| forms | The platform's urlencoded parser reads the form, which `ValidationPipe` binds to query.many's DTO. `FileInterceptor` reads the upload, with Multer on Express and @fastify/multipart on Fastify. | Nest |
| stream | The handler returns a `StreamableFile` over a `Readable` of lines, and the platform pipes it into the response. | Nest |
| sse | `@Sse` sends each value of the `Observable` the handler returns as one event. | Nest |
| static | `ServeStaticModule` over the payload directory under `/static`, which serves it with `express.static` on Express and @fastify/static on Fastify. | @nestjs/serve-static |

CacheInterceptor stores the value a handler returns, not the answer. A replay would lose the
headers the handler wrote, x-rb-serial among them. So each cache handler returns its headers with
its body, and an interceptor outside CacheInterceptor writes them on the fresh answer and on a
replay.

## Notes

- `enableCors`, compression and Express's ETag cover the whole application. Every answer on
  container-h1 carries `Vary: Origin, Accept-Encoding` and a weak ETag, and a matching
  `If-None-Match` gets 304 on any GET route. Nest has no way to scope CORS to a route, so
  `cors.scoped` is skipped.
- Every answer on container-h1 and lambda-emulator carries `X-Powered-By: Express`. Nest leaves
  Express's default as it is.
- @fastify/etag writes a strong tag, where Express writes a weak one. Both hash the body with SHA-1.
- CacheInterceptor adds `X-Cache: HIT` or `X-Cache: MISS` to every answer it handles.
- On Fastify, the cache routes' `Vary` goes out as a second `Vary` line beside the one @fastify/cors
  writes. On Express the two are joined into one line.
- Nest answers a POST with 201 unless the handler sets another status with `@HttpCode`. The body and
  forms routes create nothing, so they set 200.
- Nest starts an SSE answer with an empty line and numbers each event with an `id:` field. It writes
  `Expire: 0`, where the header HTTP defines is `Expires`, beside `Cache-Control`, `Pragma` and
  `X-Accel-Buffering: no`. The typo was raised in https://github.com/nestjs/nest/issues/17588 and is
  still in 12.1.0.
- Express's `res.render` adds `_locals` to the object it renders. The template handlers return a copy
  of the payload, so the payload the other handlers return is never changed.
- Nest's upload interceptors come from `@nestjs/platform-express` and from
  `@nestjs/platform-fastify/multipart`, and each works on its own platform alone. The multipart
  controller is made with the host's `FileInterceptor`.
- On the Fastify adapter, the application's `setViewEngine` returns before the adapter has imported
  @fastify/view, and drops the promise of the plugin's registration. `listen` can then start before
  the plugin is registered and never settle. `fastify.ts` registers the plugin itself and waits for
  it.
- Nest's testing module creates every provider before it has an HTTP adapter, so ServeStaticModule
  finds no adapter and chooses the loader that serves nothing. The suite creates each application
  with `NestFactory`, as the hosts do and as https://github.com/nestjs/serve-static/issues/240
  advises.
- Nest logs each route it maps as the application starts, and nothing per request.
- The server is one Node process, as Nest's `listen` starts it, on the container's two cores. The
  function on lambda-emulator runs on one core.
- On lambda-emulator, @codegenie/serverless-express buffers the whole answer into one proxy
  response, so the sse and stream tests are listed as unsupported there.
- The function is built on `public.ecr.aws/lambda/nodejs:26-preview`, because container-h1 runs
  Node 26 and Lambda's Node 26 runtime is still a preview. The runtime logs a warning saying so when
  it starts.

## Refusals

Every refusal is Nest's own, written by Nest's exception filter as `message`, `error` and
`statusCode`. Nothing reshapes it.

- A body that breaks a rule is the `BadRequestException` ValidationPipe throws, 400, with a message
  for each rule in `message`, such as `customerId must not be less than 1`. A line's field is named
  as `lines.0.qty`.
- ValidationPipe checks every field, so `/body/validate/small` names all three of `order.invalid`'s
  fields. `/body/validate/first-error` names `customerId` alone.
- A body that is not JSON is 400. On Express it is the body parser's error, with `JSON.parse`'s
  message, such as `Unexpected end of JSON input`. On Fastify it is Fastify's JSON parser's error,
  whose body has no `error`.
- A path no route matches, and a method a path has no route for, get Nest's not-found handler's
  404, such as `Cannot POST /items/17`.
- A missing row is `NotFoundException`'s 404, whose body has no `error`.
- A wrong bearer token is the guard's refusal, `ForbiddenException`'s 403, with the message
  `Forbidden resource`.

## Client

`Client/` holds the OpenAPI document @nestjs/swagger writes from the controllers, and a TypeScript
client generated from it. Nest's documentation recommends no client generator, so the client is
Kiota's.

- `npm run client` builds the application a second time into `dist/client/`, with
  `nest-cli.client.json`, which adds @nestjs/swagger's CLI plugin to the build as Nest's OpenAPI
  guide configures it. The plugin records the properties of each DTO, in the files named
  `*.dto.ts`, and each handler's parameters and return type. The image is built with
  `nest-cli.json`, which has no plugin, so it does not change.
- `Client/document.ts` creates the application from that build, passes it to
  `SwaggerModule.createDocument`, and writes `Client/openapi.json`. It never listens.
- `Client/generate.ts` runs Kiota 1.35.0 through `@microsoft/kiota`, which downloads that release
  from GitHub on first use and checks its hash. Kiota writes `Client/Kiota/` and its workspace files
  to `Client/.kiota/`. tsc rejects the generated root client, because Kiota reserves `query` for the
  HTTP QUERY method and the corpus has a `/query` family, so each generated file starts with
  `// @ts-nocheck`.
- `RB_PAYLOADS=../../../tests/payloads npm run client` does all three. `npm run rb -- client
  node:nestjs` runs it and fails if anything under `Client/` changed.
- `UnitTests/kiota.spec.ts` calls the Implementation through the client, over HTTP on a port the
  test listens on.

@nestjs/swagger, `@microsoft/kiota` and `@microsoft/kiota-bundle` are dev dependencies, so the image
installs what it did before.

What the document leaves out:

- The payloads and rows are TypeScript interfaces, which the plugin cannot read. Each answer is
  described as an object with no properties, so the client gives its fields in `additionalData`.
  The bind routes bind the order to an interface, so the document gives them no request body.
- `UpdateItem` extends `PartialType` from @nestjs/mapped-types, which copies class-validator's rules
  and not the plugin's metadata, so the PATCH body is described with no properties.
- The plugin describes an integer as a `number`.
- `forms.urlencoded` is described as JSON, and `forms.multipart` with no body, because neither route
  names what it consumes.
- The CORS preflight and `/static` are answered by middleware, so no route describes them.
- The body routes read `Content-Length` with `@Headers`, so the document lists it as a required
  header parameter.
