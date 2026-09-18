# axum

A Rust HTTP framework over hyper and tower. Routing is a `Router` of `MethodRouter`s, and
everything else is a tower `Layer`, so middleware here is the same abstraction the rest of
the Rust HTTP ecosystem uses rather than something axum invented.

## How it is wired

Routes are registered on the router, with `{name}` for captures. Handlers are plain async
functions whose arguments are extractors: `Path` for captures, `Query` for the query
string, `Bytes` for a body. A handler returns anything that implements `IntoResponse`,
which is why the families that set headers return a tuple of headers and a body rather
than building a response by hand.

Middleware is `tower::Layer`, applied per route. `MethodRouter::layer` returns a
`MethodRouter`, so `middleware.four` and `middleware.sixteen` are a fold over the count
rather than four and sixteen written-out calls, and each layer is a real `from_fn` that
awaits the next.

## What is unusual about it

**Compression is a tower layer scoped to three routes.** `tower-http`'s `CompressionLayer`
is attached to the compressed routes alone. On the router it would put a "did the client
ask?" check on all forty-five endpoints and contaminate the rows those are measured
against. The level is pinned to the one every language uses; the size threshold is left at
the library's default, because whether a framework bothers to compress a body too small to
benefit is what `compressed.gzip_small` is in the set to show.

**Payloads are closed over, not looked up.** `payload_route` takes the size once and moves
it into the handler. A `/json/{size}` capture would make the router pay parameter cost on
the family every other target serves from a static route, and would answer 200 with an
empty body for a size that does not exist.

## Where the numbers come from

`rb-domain` holds every response this target produces; the wiring above is the only thing
that differs from the other five Rust targets. The shared crate is a port of
`targets/go/_shared/domain.go`, and all six Rust targets are gated against the same
captured responses as the Node and Go targets.
