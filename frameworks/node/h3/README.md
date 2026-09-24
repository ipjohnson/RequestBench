# h3

h3 2.0.1-rc.32 on Node.js 26, answering the RequestBench corpus. The contract every route follows
is [`frameworks/openapi.json`](../../openapi.json).

h3 is a small HTTP framework from the h3js project, built on the web's `Request` and `Response`, the
rou3 router, and utilities a handler calls. On Node, h3's `serve()` runs srvx, which adapts Node's
HTTP server to `Request` and `Response`. npm's latest h3 is a release candidate of version 2, which
this port runs. Version 1 is 1.15.11, under npm's `1x` tag.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, in TypeScript. `app.ts` builds it, and `routes/` holds one module per corpus family. `views/` holds the EJS template. |
| `container-h1/` | How container-h1 starts it. `server.ts` loads the payloads and listens, and `Dockerfile` builds the image. |
| `UnitTests/` | node:test tests of the wiring, sending each request through h3's `app.request()`. |
| `client-exception/` | How the corpus reads h3's error bodies. |
| `package.json` | The dependencies, and the scripts that start, check and test the Implementation. |
| `package-lock.json` | What npm resolved, which the image installs. |
| `tsconfig.json` | How tsc checks the source. |

There is no `Client/`. h3 writes no OpenAPI document about its routes. Nitro's experimental one
covers Nitro applications only.

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
| baseline | The handler returns the string, and h3 sends a string as `text/plain`. | h3 |
| json | The handler returns the payload, and h3 writes it with `JSON.stringify`. | h3 |
| middleware | No-op middleware in the route's options, which h3 runs for that route alone. | h3 |
| parameters, query | A zod schema that `getValidatedRouterParams` or `getValidatedQuery` runs on the captures or the query string, converting the numbers to integers. | h3, zod |
| headers | The handler reads the three headers from the request and converts the account. | by hand |
| body | A zod schema that `readValidatedBody` runs on the validate routes. The bind routes only parse, with `readBody`. The first-error route pipes one-field schemas one into the next. | h3, zod |
| authorized | Middleware in the route's options compares the token and throws `HTTPError` with 403 for any other. | h3 |
| cache | ocache's `defineCachedHandler` around each cache route's handler, with h3's `toResponse` making the `Response` it stores. | ocache |
| compressed | Middleware written for the two routes through h3's `onResponse`, which gzips a body of 1 KB or more with node:zlib at level 1. | by hand |
| etag | The handler hashes the serialised body with SHA-1, and h3's `handleCacheHeaders` writes the tag and answers a match with 304. | h3, by hand |
| template | An EJS template compiled once at startup, rendered by the handler and answered through h3's `html(raw())`. | ejs |
| items | One route per method on `/items/:id`, the id converted by a zod schema. h3 answers HEAD with the GET route. | h3 |
| errors | The router's 404, `readBody`'s 400, and the `HTTPError` the items handlers throw. | h3 |
| cors | `handleCors`, called by the `/cors/small` handler, answers a preflight and adds its headers to any other request. | h3 |
| forms | `readBody` parses the urlencoded form, which query.many's schema binds through `readValidatedBody`, and reads the upload through the request's `formData()`. | h3 |
| stream | The handler returns h3's `iterable` over a generator of lines. | h3 |
| sse | The handler returns h3's `EventStream` and pushes each row to it as one event. | h3 |
| static | h3's `serveStatic` on a `/static/**` route, over the payload directory. | h3 |

## Notes

- h3 runs a middleware registered with `app.use()` on every request, and one registered with a
  path checks that path against every request. Every middleware here is in a route's options,
  which h3 runs for that route alone.
- h3's own response cache is its `cache` route rule, and route rules run as one `app.use()`
  middleware. The cache routes wrap their handlers in ocache's `defineCachedHandler` instead,
  which the rule is built on. It adds `x-cache`, a weak `etag` and `cache-control: max-age=3600`
  to each answer, and replays it as a standard `Response`, which srvx sends chunked.
- ocache stores what the handler returns, and h3's `toResponse` turns that into the `Response`
  with the headers the handler staged. That is how `x-rb-serial` is stored and replayed.
- h3's authentication is Basic only, through `basicAuth`, so the bearer check is middleware
  written for the route.
- h3 ships no compression, so the compressed family's middleware is written for it. It gzips when
  `gzip` appears in Accept-Encoding, without weighing q-values.
- h3 hashes nothing for an ETag. `handleCacheHeaders` takes the tag as given, so the handler
  hashes the body. It also writes `cache-control: public` on every answer it tags.
- A handler that answers 304 through `handleCacheHeaders` and returns `null` sends
  `Content-Length: 0`. RFC 9110 forbids that on a 304 unless it is the length the 200 would have
  had. `serveStatic`'s 304 sends none.
- h3 has no view layer. Its `html` tag escapes what it interpolates and answers at once, so it
  cannot build a page row by row, and the page is an EJS template compiled at startup.
- zod checks every field of an object, and has no setting that stops at the first failure. The
  first-error route pipes three one-field schemas one into the next, and zod stops at the first
  that fails.
- h3 binds no headers. Its validation utilities cover the body, the query and the route's params,
  so the headers family reads its three by hand.
- The router's 404 names the request's whole URL, host included, such as
  `Cannot find any route matching [GET] http://127.0.0.1:8080/errors/unmatched`.
- srvx writes an empty reason phrase, such as `HTTP/1.1 200 `, unless the answer sets a
  `statusText`, as `HTTPError.status(404, "Not Found")` does.
- srvx answers HEAD with the GET route's headers and no `Content-Length`, which HTTP allows.
- srvx stops the server on SIGTERM itself when its graceful shutdown is on. It is on unless `CI`
  or `TEST` is set, so `server.ts` asks for it. The process ends about a second after the signal,
  when srvx's own one-second timer runs out.
- `handleCors` sends `access-control-expose-headers: *` on every request it allows, its default.
- The server is one Node process, as `serve()` starts it, on the container's two cores.
- h3 implements no container-h2. srvx, which h3's `serve` starts, serves HTTP/2 only with a TLS
  certificate.

## Refusals

Every refusal is h3's own error JSON: `status`, `statusText` where the error has one, and `message`.
Nothing reshapes it.

- A body the zod schema refuses is 400, with `statusText` and `message` both `Validation failed`,
  and `data.issues` holding zod's issues, each with the `path` of the value it names. zod reports
  every failure, so `/body/validate/small` names `customerId`, `status` and `lines` for
  `order.invalid`, and `/body/validate/first-error` names `customerId` alone.
- A body that is not JSON is `readBody`'s 400, `Invalid JSON body`, which names no field.
- A path no route matches, and a method a path has no route for, get the router's 404, such as
  `Cannot find any route matching [POST] http://127.0.0.1:8080/items/17`.
- A missing row is `HTTPError.status(404, "Not Found")` and a wrong token
  `HTTPError.status(403, "Forbidden")`, each thrown by the port and written by h3.
