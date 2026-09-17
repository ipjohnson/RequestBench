# Fastify

A Node HTTP framework built around a radix router and a plugin system whose defining idea
is encapsulation: a plugin registered inside a scope affects that scope and nothing
outside it. Three of the six feature families here are wired through that mechanism rather
than through a conditional in a handler.

## How it is wired

`listen` starts Fastify's own server. `handler` exposes the same routing as a plain
`(req, res)` function through `app.routing`, which is what a function host invokes after
`app.ready()`. Neither wraps the other.

Routes are registered directly on the instance, one call per endpoint, except where the
size set makes a loop clearer. Parameters use Fastify's `:name` syntax.

## What is unusual about it

**No route declares a schema.** Fastify's headline feature is a JSON Schema compiled per
route, which gives it both validation and a specialised serializer through
fast-json-stringify. Neither is used here. Validation goes to the shared domain module so
that every language validates identically and the `body` family measures one thing, and
with no response schema the serializer is plain `JSON.stringify`. This is the single
biggest thing the numbers here do not tell you about Fastify.

**The JSON body parser is replaced.** `addContentTypeParser` returns `req.raw.body`
untouched when a function host has already parsed it, because reading the stream a second
time hangs. Under the `container` host nothing has pre-parsed, so Fastify's own parser
path runs and a parse failure becomes the shared `ValidationError`.

**Middleware is hooks.** There is no `app.use` chain in the path. `middleware.four` and
`middleware.sixteen` pass an array of `onRequest` hooks scoped to that one route, so the
cost measured is Fastify walking its own hook array. `authorized` uses the same mechanism
with a single hook.

**Compression is encapsulated, not global.** `@fastify/compress` is registered inside
`app.register(async (scope) => …)`, so only the three `/compressed` routes carry it. The
size threshold is left at the plugin's default, because whether a framework bothers to
compress a body too small to benefit is what `compressed.gzip_small` exists to show.

**The ETag hook is hand-written.** `@fastify/etag` computes a digest of the body, which
could not produce the value pinned in the fixture. The hook here emits the pinned
validator and compares `if-none-match`, so `cached` measures the conditional rather than a
hash. The size is closed over per route rather than sliced out of `req.url`, which carries
the query string.

## Dependencies in the bundle

`fastify`, `@fastify/compress` for the compressed family, `@fastify/view` with `ejs` for
the template family. The template engine is reported on `/__meta` and shows up in the
`template` column, which is why that family is comparable only against another target
declaring the same engine.
