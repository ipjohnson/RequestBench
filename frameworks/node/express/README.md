# Express

Express 5.2.1 on Node.js 26, answering the RequestBench corpus. The contract every route follows
is [`frameworks/openapi.json`](../../openapi.json).

Express is a Node HTTP framework built on a router and middleware. A route takes a list of handler
functions, each of which answers or calls `next()`, and Express tries routes in the order they were
registered. Everything a family uses sits in the handler lists of that family's routes, so it runs
on those routes and on no others. Settings, such as the view engine and ETag generation, belong to
an application, and a sub-application mounted on a path has its own.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application, in TypeScript. `app.ts` builds it, `routes/` holds one module per corpus family, and `views/` holds the Pug view. |
| `container-h1/` | How container-h1 starts it. `server.ts` loads the payloads and listens, and `Dockerfile` builds the image. |
| `UnitTests/` | node:test tests of the wiring, sending each request through supertest. |
| `client-exception/` | How the corpus reads the validate routes' refusals. |
| `package.json` | The dependencies, and the scripts that start, check and test the Implementation. |
| `package-lock.json` | What npm resolved, which the image installs. |
| `tsconfig.json` | How tsc checks the source. |

There is no `Client/`. Express writes no OpenAPI document about its routes without a third-party
library.

## Building, running and testing

```sh
npm ci
RB_PAYLOADS=../../../tests/payloads PORT=8080 NODE_ENV=production npm start
npm test
```

Nothing is built. Node strips the types as it loads each file and runs the source. tsc only checks
it, which `npm test` does before it runs the suite. The scripts pass `--experimental-strip-types`,
which Node 22 needs and Node 26 accepts.

`RB_PAYLOADS` names the payload directory, which the Implementation loads before it starts
listening. `PORT` defaults to 8080. The image sets `NODE_ENV=production`, which Express reads when
the application is built, and so does the suite.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | `res.send` writes the string, with the type set to `text/plain`. | Express |
| json | `res.json`, which serialises the payload with `JSON.stringify`. | Express |
| middleware | No-op middleware functions in the route's handler list. | Express |
| parameters, query, headers | Express captures, parses and reads strings, and converts nothing. The handler converts each number with `Number()`. | Express |
| body | `express.json()` on every body route. On the validate routes an express-validator schema runs its chains as middleware before the handler. The bind routes run none. | Express, express-validator |
| authorized | Middleware in the route's handler list compares the token and refuses any other with `res.sendStatus(403)`. | Express |
| cache | Middleware in each cache route's handler list replays a stored answer, or wraps `res.send` to store one. | by hand |
| compressed | `compression` in the compressed routes' handler lists, at its default threshold and zlib's fastest level. | compression |
| etag | Express's `etag` setting, on in a sub-application mounted at `/etag`. `res.send` hashes the body with SHA-1 and answers 304 when `If-None-Match` names the tag. | Express |
| template | `res.render`, with Pug as the view engine. | Express, pug |
| items | One route per method on `/items/:id`. Express answers HEAD with the GET route. | Express |
| errors | The final handler's 404 and 400 pages, and the items handlers' `res.sendStatus(404)`. | Express |
| cors | `cors` in the handler lists of the OPTIONS and GET routes for `/cors/small`. | cors |
| forms | `express.urlencoded()` parses the form, which query.many's conversion binds. `multer` reads the upload into memory. | Express, multer |
| stream | The handler pipes a `Readable` of lines into the response. | Node |
| sse | The handler sets `text/event-stream` and pipes a `Readable` of events into the response. | by hand |
| static | `express.static` over the payload directory, mounted at `/static`. | Express, serve-static |

## Notes

- Express hashes every body `res.send` writes for an ETag, whatever the route, unless the `etag`
  setting is off. The application turns it off and the etag family's sub-application turns it on,
  so the json rows that the etag rows are read against carry no hash.
- A sub-application starts from Express's defaults rather than from its parent's settings, so the
  etag family's turns `x-powered-by` off a second time.
- Express's final handler writes every error passed to it to stderr, with its stack, unless
  `NODE_ENV` is `test`. Each `errors.malformed` request logs the parser's `SyntaxError`.
- Express has no validation, and its documentation names no library for it. The validate routes
  run express-validator, the library written for Express, and refuse a body as its guide does:
  `res.status(400).json({ errors: result.array() })`.
- express-validator runs validator.js on a value's string form, so `"7"` passes `isInt` where a
  JSON Schema would refuse a string.
- express-validator runs every chain unless told to stop, so the first-error route runs the chains
  one at a time, as its guide shows, and stops at the first that fails.
- Express ships no response cache. apicache, the one written for Express, was last released in
  2021, three years before Express 5, so the cache family's middleware is written for it.
- Express has no support for server-sent events, so the sse handler writes the event stream itself.
- Pug writes `doctype html` as `<!DOCTYPE html>`, so the view writes the doctype as plain text.
- `res.render` writes the response's locals into the object it is handed, so each render gets a
  copy of the payload rather than the one the json rows write.
- Express answers an OPTIONS request on any route without one with a 200 of its own, listing the
  route's methods in `Allow`. Only `/cors/small` has an OPTIONS route, which the cors middleware
  answers.
- The server is one Node process, as Express's `listen` starts it, on the container's two cores.

## Refusals

Every refusal but the validate routes' is Express's own.

- A body that fails express-validator's schema is 400 with `{ errors }`, one entry per failed
  check, each naming its field by `path`, such as `lines[0].qty`. The route writes it as
  express-validator's guide does, because express-validator writes no answer itself.
- `/body/validate/small` and `/body/validate/medium` run every chain, so `order.invalid` is refused
  naming `customerId`, `status` and `lines`. `/body/validate/first-error` names `customerId` alone.
- A body that is not JSON is `express.json()`'s 400, which Express's final handler writes as an
  HTML page reading `Bad Request`.
- A path no route matches, and a method a path has no route for, get the final handler's 404 page,
  such as `Cannot POST /items/17`.
- A missing row is `res.sendStatus(404)`, and a wrong token `res.sendStatus(403)`, each the
  status's name as `text/plain`.
