# Fastify

Fastify 5.12.5 on Node.js 26, answering the RequestBench corpus. The contract every route follows
is [`frameworks/openapi.json`](../../openapi.json).

Fastify is a Node HTTP framework built on a radix router, a JSON Schema per route, and plugins.
Fastify encapsulates a plugin: the hooks, body parsers and decorators it registers apply to the
routes registered inside it and to no others. Every family here is a plugin of its own.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, in TypeScript. `app.ts` builds it, `server.ts` starts it, and `routes/` holds one plugin per corpus family. |
| `UnitTests/` | node:test tests of the wiring, sending each request through Fastify's `inject()`. |
| `Client/` | The OpenAPI document @fastify/swagger writes from the route schemas, and the Kiota client generated from it. |
| `client-exception/` | How the corpus reads Fastify's error bodies. |
| `package.json` | The dependencies, and the scripts that start, check and test the Implementation and write the client. |
| `package-lock.json` | What npm resolved, which the image installs. |
| `tsconfig.json` | How tsc checks the source. |

## Building, running and testing

```sh
npm ci
RB_PAYLOADS=../../../tests/payloads PORT=8080 npm start
npm test
```

Nothing is built. Node strips the types as it loads each file and runs the source. tsc only checks
it, which `npm test` does before it runs the suite. The scripts pass `--experimental-strip-types`,
which Node 22 needs and Node 26 accepts.

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and Fastify sends a string as `text/plain`. | Fastify |
| json | A response schema on the route. Fastify compiles it with fast-json-stringify at startup, and the handler returns the payload object. | Fastify |
| middleware | No-op `onRequest` hooks on the route. | Fastify |
| parameters, query, headers | A JSON Schema for the params, the querystring or the headers on the route. Fastify runs it with ajv before the handler, and ajv converts what it declares as an integer. | Fastify |
| body | A JSON Schema for the body on the validate routes. The bind routes declare none, so their bodies are only parsed. | Fastify |
| authorized | An `onRequest` hook on the route compares the token and refuses any other with `reply.forbidden()`. | Fastify, @fastify/sensible |
| cache | An `onRequest` hook replays a stored answer and an `onSend` hook stores one, both in the cache family's plugin. A vary route names its headers in its route config. | by hand |
| compressed | `@fastify/compress` in the compressed family's plugin, at its default threshold and zlib's fastest level. | @fastify/compress |
| etag | `@fastify/etag` in the etag family's plugin. It hashes the serialised body with SHA-1 and answers 304 when `If-None-Match` names it. | @fastify/etag |
| template | An EJS template rendered by `@fastify/view`. | @fastify/view, ejs |
| items | One route per method on `/items/:id`, the id converted by a params schema. Fastify gives every GET route a HEAD route. | Fastify |
| errors | The default not-found handler's 404, the JSON parser's 400, and the items handlers' 404 from `@fastify/sensible`. | Fastify |
| cors | `@fastify/cors` in the plugin mounted under `/cors`. | @fastify/cors |
| forms | `@fastify/formbody` parses the urlencoded body, which query.many's schema binds. `@fastify/multipart` parses the upload. | @fastify/formbody, @fastify/multipart |
| stream | The handler returns a `Readable` of lines, and Fastify pipes it into the response. | Fastify |
| sse | `@fastify/sse` writes each row as the data of one event. | @fastify/sse |
| static | `@fastify/static` over the payload directory at `/static/`. | @fastify/static |

Choices a reader might not expect:

- Every plugin a family uses is registered inside that family's plugin. On the root,
  `@fastify/compress` and `@fastify/etag` would run an `onSend` hook on every route, including
  the json rows that the compressed and etag rows are read against.
- The stream and sse rows write each row with a function fast-json-stringify compiles from the
  item schema in the json rows' response schemas, so the three families share one serializer.
- Fastify ships no response cache. `@fastify/caching` sets cache headers and hands out a store,
  and replays nothing, so the cache family is two hooks written for it.
- `@fastify/bearer-auth` refuses a wrong token with 401, and the corpus asks for 403, so the token
  check is a hook written for the route.
- `@fastify/cors` writes a string origin on every answer, whichever origin asked. The origin is
  given as a list of one, so the plugin checks the request's origin and adds `Vary: Origin`.
- `@fastify/cors` registers a catch-all OPTIONS route for preflights. The cors plugin is mounted
  under `/cors`, so that route is `/cors/*`, and a preflight anywhere else is a 404.
- Fastify closes the connection after it refuses a body its parser cannot read, because the client
  may still be sending. Under load, every `errors.malformed` request pays for a new connection.
- The server is one Node process, as Fastify's `listen` starts it, on the container's two cores.

## Refusals

Every refusal is Fastify's own, written by its default error handler or its default not-found
handler as `statusCode`, `error` and `message`, with `code` where the error has one. Nothing
reshapes it.

- A body that fails its schema is `FST_ERR_VALIDATION`, 400, with ajv's failure as the message,
  such as `body/customerId must be > 0`. No field is named outside the message, so
  `client-exception` reads the field off the front of it.
- ajv stops at the first failure, which is Fastify's setting, so `/body/validate/small` and
  `/body/validate/first-error` both refuse `order.invalid` naming `customerId` alone.
- A body that is not JSON is `FST_ERR_CTP_INVALID_JSON_BODY`, 400.
- A path no route matches, and a method a path has no route for, get the not-found handler's 404,
  such as `Route POST:/items/17 not found`.
- A missing row is `@fastify/sensible`'s 404, and a wrong token its 403.

## Client

`Client/` holds the OpenAPI document Fastify's route schemas produce and a TypeScript client
generated from it. Fastify recommends no client generator, so the client is Kiota's.

- `Client/document.ts` registers @fastify/swagger on an instance, passes it to `build`, and writes
  `app.swagger()` to `Client/openapi.json`. It never listens. @fastify/swagger collects routes as
  they are added, which is why `build` takes the instance.
- `Client/generate.ts` runs Kiota 1.35.0 through `@microsoft/kiota`, which downloads that release
  from GitHub on first use and checks its hash. Kiota writes `Client/Kiota/` and its workspace files
  to `Client/.kiota/`.
- Kiota's TypeScript imports `./x/index.js` for `x/index.ts`, which Node's type stripping cannot
  load, so `generate.ts` rewrites each relative import to name the `.ts` file. tsc rejects the
  generated root client, because Kiota reserves `query` for the HTTP QUERY method and the corpus has
  a `/query` family, so each generated file starts with `// @ts-nocheck`. The calls work.
- `RB_PAYLOADS=../../../tests/payloads npm run client` does both. `npm run rb -- client
  node:fastify` runs it and fails if anything under `Client/` changed.
- `UnitTests/kiota.test.ts` calls the Implementation through the client, over `inject()`.

@fastify/swagger, `@microsoft/kiota` and `@microsoft/kiota-bundle` are dev dependencies, so the
image installs what it did before.

What the document leaves out:

- A route's schema is also its validator. The bind routes, the item writes and the multipart form
  declare no body schema, so the document gives them no request body. Adding one would make Fastify
  validate those bodies, which the bind rows do not measure.
- The CORS preflight and `/static` are answered by plugins, so no route describes them.
- @fastify/swagger leaves out HEAD routes unless `exposeHeadRoutes` is set.
- `forms.urlencoded` is described as JSON, because the route sets no `consumes`.
