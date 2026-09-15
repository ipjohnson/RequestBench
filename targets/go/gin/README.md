# Gin

A Go HTTP framework over `net/http`, built on a radix-tree router with a middleware chain
per route group. Its `*gin.Context` carries the request, the response writer, the captured
parameters and the chain position in one value.

## How it is wired

Routes are registered on the engine, with `:name` for captures. Where the value set is
fixed the registration is a loop, but the routes it produces are still static — see below.

Middleware is `gin.HandlerFunc`, the same type as a handler, appended to the route. There
is no separate middleware type, so `middleware.four` and `middleware.sixteen` measure Gin
walking a slice of the same functions it would call anyway.

## What is unusual about it

**The JSON family is registered as three static routes, not `/json/:size`.** A capture
would make Gin pay radix parameter cost on the family that `json.small` anchors most of
the endpoint set to, and it would answer 200 with an empty body for a size that does not
exist. The loop is a registration convenience; the router sees three literals.

**Compression is scoped to a group.** `gin-contrib/gzip` is attached to
`r.Group("/compressed", …)` and nowhere else. Registered on the engine it would put a
"did the client ask?" check on all forty-five endpoints and contaminate the baseline the
compressed rows are measured against. The level is pinned across every language; the size
threshold is left at the library's default for the same reason as everywhere else.

**The cached group carries its validators as middleware.** `validatorsFor(size)` closes
over the pinned ETag from the fixture and short-circuits with 304, so `cached` measures
the conditional rather than a digest.

**The template is embedded in the binary.** `//go:embed views/items.tmpl` and
`SetHTMLTemplate` at startup, because the container image is the built binary on a bare
Alpine and a template file beside the source would not be there to load. The engine is
`html/template`, reported on `/__meta`.

**`NoRoute` answers `errors.unmatched`**, which is a handler with no route and therefore
the one endpoint here that no path can locate. It is named by an `rb:snippet` marker.

## Bundle note

The `gin` bundle holds the target's own `main.go`, the shared domain module every Go
target calls, the embedded template, and `go.mod`/`go.sum`. A change to the shared module
moves every Go target at once, which is why it is in each of their bundles rather than
tracked separately.
