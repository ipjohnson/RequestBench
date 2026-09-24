# Hono

Hono 4.13.8 on Node.js 26, served by @hono/node-server 2.1.1, answering the RequestBench corpus.
The contract every route follows is [`frameworks/openapi.json`](../../openapi.json).

Hono is an HTTP framework built on the web standard Request and Response. A router matches each
request's method and path to the handlers registered for them, and middleware is given on a route
or on a path. On Node, @hono/node-server turns each request into a Request, hands it to the
application's `fetch`, and writes the Response it gets back.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, in TypeScript. `app.ts` builds it, and `routes/` holds one module per corpus family. |
| `container-h1/` | How container-h1 starts it. `server.ts` loads the payloads and listens, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `server.ts` hands @hono/node-server node:http2's `createServer`, which answers HTTP/2 with prior knowledge, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `handler.mjs` exports the handler the Lambda runtime hands each event, the application behind `handle()` from `hono/aws-lambda`, and `Dockerfile` builds the function on the `nodejs:26-preview` base image. The runtime imports a handler's module only as `.js`, `.mjs` or `.cjs`, so `handler.mjs` is JavaScript, and Node strips the types of the application it imports. |
| `UnitTests/` | node:test tests of the wiring, sending each request through Hono's `app.request()`. |
| `client-exception/` | How the corpus reads Hono's error bodies. |
| `package.json` | The dependencies, and the scripts that start, check and test the Implementation. |
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
which Node 22 needs and Node 26 accepts. Node only removes types, so the source keeps to syntax that
erases, and the template is `html` from `hono/html` rather than Hono's JSX.

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns `c.text()`, which Hono sends as `text/plain`. | Hono |
| json | The handler returns `c.json()`, which Hono writes with `JSON.stringify`. | Hono |
| middleware | No-op middleware given on the route before its handler. | Hono |
| parameters, query, headers | `zValidator` on the route, with the param, query or header target. It hands a zod schema what Hono read, and the schema converts what it declares as an integer. | @hono/zod-validator, zod |
| body | `zValidator` with the json target on the validate routes. The bind routes read the body with `c.req.json()` and validate nothing. | @hono/zod-validator, zod |
| authorized | Middleware on the route compares the token and refuses any other by throwing `HTTPException` with 403. | Hono |
| cache | `hono/cache` on each route, over the part of the Web Cache API it calls, written for Node. | Hono, by hand |
| compressed | `hono/compress` on each route, at its default threshold, gzipping at zlib's default level. | Hono |
| etag | `hono/etag` on each route. It hashes the answer with SHA-1 and answers 304 when `If-None-Match` names it. | Hono |
| template | `html` from `hono/html`, sent by `c.html()`. | Hono |
| items | One route per method on `/items/:id`, the id converted by `zValidator`. Hono answers HEAD with the GET route. | Hono |
| errors | The default not-found handler's 404, for a miss and for `c.notFound()`, and the default error handler's 400 for the validator's `HTTPException`. | Hono |
| cors | `hono/cors` on every path under `/cors`. | Hono |
| forms | `zValidator`'s form target binds the urlencoded body by query.many's schema. `c.req.parseBody()` reads the upload. | Hono, @hono/zod-validator |
| stream | `stream()` from `hono/streaming` writes a line per row. | Hono |
| sse | `streamSSE()` from `hono/streaming` writes each row as the data of one event. | Hono |
| static | `serveStatic` from @hono/node-server over the payload directory at `/static/`. | @hono/node-server |

## Notes

- RegExpRouter, which Hono's default SmartRouter tries first, refuses a static path that a capture
  route also matches, in either order. `/parameters/static/segment/literal` and
  `/parameters/:one/segment/literal` are such a pair, so SmartRouter routes the whole application
  with TrieRouter, and `app.router.name` reads `SmartRouter + TrieRouter`.
- Hono runs the handlers that match a path in the order they were registered, and the first to
  answer ends the request. `/parameters/static/segment/literal` is registered before the capture
  that also matches it.
- `hono/compress` gzips through the platform's `CompressionStream`, which takes no level, so on
  Node the compressed rows gzip at zlib's default level, 6. Every other framework here compresses
  at its fastest level except Spring Boot, so these rows are not read against another framework's.
- `hono/compress` skips a body under its 1 KB threshold only when the answer states a
  `Content-Length`, and `c.json()` states none, so it gzips the 123-byte small payload too.
- `hono/cache` keeps answers in the Web Cache API, which Workers and Deno have and Node does not.
  The cache family writes the part of that API it calls, `caches.open` and a cache's `match` and
  `put`, over a `Map` set as `globalThis.caches`. `hono/cache` does the rest: the key, the Vary
  header and the replay. It needs `wait: true`, because otherwise it hands the write to
  `executionCtx.waitUntil`, which no Node server gives it. It never answers a request that carries
  an `Authorization` header from the store.
- `hono/bearer-auth` refuses a wrong token with 401 and takes no status, and the corpus asks for
  403, so the token check is middleware written for the route. It throws `HTTPException` with 403
  and the message `Forbidden`, as Hono's own csrf and ip-restriction middleware refuse.
- zod checks every field and has no setting to stop at the first that fails, so
  `/body/validate/first-error` runs `zValidator` three times: on `customerId`, on `status`, and on
  the whole order.
- `@hono/zod-validator` answers a failed body with zod's `safeParse` result as JSON. zod 4 writes
  its issues into the error's `message` as a JSON string, which is the only place the answer names
  a field.
- Hono's default error handler writes an `HTTPException`'s answer from the body stream of the
  Response it builds, so a refusal it writes, the 400 for a body that is not JSON and the 403 for a
  wrong token, goes out chunked, with no `Content-Length`.
- The server is one Node process, which @hono/node-server starts, on the container's two cores.
  The function on lambda-emulator runs on one core.
- container-h2 lists `sse.medium` as unsupported. hono's streamSSE sets Transfer-Encoding, which
  node:http2 refuses as a connection-specific header. The throw escapes @hono/node-server's error
  handler and ends the process.
- On lambda-emulator the application answers behind `handle()` from `hono/aws-lambda`, Hono's own
  adapter, in place of @hono/node-server. It buffers the whole answer into one proxy response, so
  the sse and stream tests are listed as unsupported there. `streamHandle()` would stream every
  answer.
- The function is built on `public.ecr.aws/lambda/nodejs:26-preview`, because container-h1 runs
  Node 26 and Lambda's Node 26 runtime is still a preview. The runtime logs a warning saying so when
  it starts.

## Refusals

Every refusal is Hono's own or @hono/zod-validator's, written by Hono's default handlers. Nothing
reshapes it.

- A body that fails its schema is @hono/zod-validator's 400,
  `{"success":false,"error":{"name":"ZodError","message":"[...]"}}`, where `message` holds zod's
  issues, each with its path. `client-exception` parses the message and reads each issue's path.
- zod reports every field that fails, so `/body/validate/small` refuses `order.invalid` naming
  `customerId`, `status` and `lines`. `/body/validate/first-error` names `customerId` alone.
- A body that is not JSON is refused by Hono's validator before zod runs, with an `HTTPException`
  whose answer is 400 and `Malformed JSON in request body` as text/plain.
- A path no route matches, a method a path has no route for, and a missing row, which the items
  handlers answer with `c.notFound()`, all get the not-found handler's 404, `404 Not Found`, as
  text/plain.
- A wrong token is 403 with `Forbidden` as text/plain, thrown as an `HTTPException` by the route's
  middleware.

## Client

There is no `Client/`. Hono writes an OpenAPI document only for routes written with
@hono/zod-openapi's `createRoute` on an `OpenAPIHono` application, and these are plain Hono
routes. Hono's own client, `hc`, is typed from the application's TypeScript type and needs no
document. The routes here are registered one statement at a time, so that type carries none of them.
