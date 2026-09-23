# Koa

Koa 3.2.1 on Node.js 26, answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Koa is a Node HTTP framework from the team behind Express. An application is a stack of async
middleware, each awaiting `next()`, and Koa ships no router, body parser, validator or view layer.
Here @koa/router routes every request, and each family uses the middleware the Koa organisation
publishes for it, mounted in front of that family's routes alone.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, in TypeScript. `app.ts` builds it, `server.ts` starts it, and `routes/` holds one module per corpus family, each registering its routes on the one @koa/router. |
| `UnitTests/` | node:test tests of the wiring, sending each request through supertest over `app.callback()`. |
| `client-exception/` | How the corpus reads Koa's error bodies. |
| `package.json` | The dependencies, and the scripts that start, check and test the Implementation. |
| `package-lock.json` | What npm resolved, which the image installs. |
| `tsconfig.json` | How tsc checks the source. |

There is no `Client/`. Koa has no tooling that writes an OpenAPI document from its routes, and the
libraries that do, such as tsoa, are third-party projects.

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
| baseline | The handler sets the string as the body, and Koa sends a string that does not start with `<` as `text/plain`. | Koa |
| json | The handler sets the payload object as the body, and Koa writes it with `JSON.stringify` once the middleware has returned. | Koa |
| middleware | No-op async middleware in front of the route's handler. | Koa, @koa/router |
| parameters | `router.param` converts each named capture to a number before the route's middleware runs, and keeps it on `ctx.state`. | @koa/router |
| query, headers | The handler reads `ctx.query` or `ctx.get()` and converts the numbers with `Number()`. Koa binds nothing. | by hand |
| body | `@koa/bodyparser` parses the body on each route. On the validate routes, koa-parameter's `ctx.verifyParams` checks it against the parameter library's rules, and koa-parameter's middleware answers a failure. | @koa/bodyparser, koa-parameter |
| authorized | Route middleware compares the token and refuses any other with `ctx.assert(..., 403)`. | Koa |
| cache | koa-cash as route middleware over an lru-cache store, with the serial kept beside each stored answer. | koa-cash, lru-cache |
| compressed | koa-compress as route middleware, at its default threshold and zlib's fastest level. | koa-compress |
| etag | @koa/etag hashes the body with SHA-1, and koa-conditional-get answers a matching `If-None-Match` with 304, both as route middleware. | @koa/etag, koa-conditional-get |
| template | An EJS template rendered by `ctx.render`, which @koa/ejs puts on every context. | @koa/ejs, ejs |
| items | One route per method on `/items/:id`, the id converted by `router.param`. @koa/router answers HEAD with the GET route. | @koa/router |
| errors | Koa's 404, the 405 from @koa/router's `allowedMethods()`, and Koa's error handling for the body parser's 400 and `ctx.throw`'s 404. | Koa, @koa/router |
| cors | @koa/cors as route middleware on an OPTIONS route and on the GET route of `/cors/small`. | @koa/cors |
| forms | @koa/bodyparser parses the urlencoded body, which the handler converts as the query route does. @koa/multer reads the upload into memory. | @koa/bodyparser, @koa/multer |
| stream | The handler sets a `Readable` of lines as the body, and Koa pipes it into the response. | Koa |
| sse | The handler sets `text/event-stream` and a `Readable` of `data:` lines as the body, as the Koa organisation's server-sent events example does. | by hand |
| static | @koa/send on a `/static/:name` route over the payload directory. | @koa/send |

## Notes

- Koa ships no router, body parser, validator, response cache or view layer. Each family uses what
  the Koa organisation publishes for it: @koa/router, @koa/bodyparser, koa-parameter, koa-cash,
  koa-compress, @koa/etag with koa-conditional-get, @koa/cors, @koa/multer, @koa/send and @koa/ejs.
- Every middleware a family uses is route middleware on that family's routes. With `app.use`,
  koa-compress, @koa/etag and koa-cash would run on every request, including the json rows that the
  compressed, etag and cache rows are read against.
- The validator is koa-parameter, which the Koa organisation publishes. Its last release was in 2017,
  and it has about 150 downloads a week. The organisation's other validator, koa-joi-router, hands its
  failure to Koa's error handling, which writes it as text, and the corpus reads a rejection from a
  JSON body.
- The parameter library that koa-parameter runs checks every rule it is given and cannot stop at the
  first failure, so the first-error route hands it one field's rule at a time.
- Koa writes every error it does not expose to stderr, and the body parser's 400 for a body that is
  not JSON is one. `app.silent` turns that off, because no other framework in the corpus logs a
  request.
- @koa/router runs a route's middleware only for a method the route has, so the CORS preflight has an
  OPTIONS route of its own, which @koa/cors answers alone. `allowedMethods()` answers an OPTIONS
  request with 200 and an Allow header on any other path that has routes.
- Given a string, @koa/cors writes that origin on every answer, whichever origin asked. The origin is
  a function that names it only for a request that comes from it.
- koa-cash stores the body, its type, Last-Modified and ETag, and no other header, so the serial each
  answer was built with is kept beside it in a second lru-cache under the same key. koa-cash
  serialises a JSON body it stores with fast-safe-stringify, and adds `Vary: Accept-Encoding` to
  every answer it wraps.
- @koa/etag serialises a JSON body with `JSON.stringify` to hash it, and Koa serialises it again to
  write it.
- For HEAD, Koa serialises a JSON body to write its Content-Length, and then sends no body.
- The server is one Node process, as Koa's `listen` starts it, on the container's two cores.

## Refusals

Every refusal but a validation failure comes from Koa's error handling or its default 404, which
write the status message as `text/plain`. Nothing reshapes any of them.

- A body that breaks the rules is koa-parameter's answer: 422, and
  `{"message": "Validation Failed", "errors": [...], "params": {...}}`, where each failure has a
  `message`, a `code` and a `field`, such as `lines[0].qty`.
- The validate routes check every rule, so `order.invalid` is refused naming all three fields.
  `/body/validate/first-error` names `customerId` alone.
- A body that is not JSON is the body parser's 400, `Bad Request`.
- A path no route matches is Koa's 404, `Not Found`, and so is a missing row, through
  `ctx.throw(404)`.
- A method the path has no route for is @koa/router's 405, `Method Not Allowed`, with an Allow header.
- A wrong token is `ctx.assert`'s 403, `Forbidden`.
