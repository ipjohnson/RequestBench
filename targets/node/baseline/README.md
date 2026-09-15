# node-http

Node's own `node:http`, with no framework and no dependencies. This is the denominator
every Node framework in a run is divided by, so what it costs is what the comparison
subtracts out.

## How it is wired

Routing is one function that takes a method, the path split into segments, the query, the
parsed body and the headers, and returns a plain `{status, headers, body}`. It never
touches a socket. That is what lets one routing implementation serve three transports
without one wrapping another:

- `listen(port)` — a `node:http` server, the container host
- `handler(req, res)` — a `(req, res)` function, for a host that brings its own server
- `lambda(event)` — an API Gateway v2 handler, for a runtime with no HTTP in the process

The Lambda path is written out rather than shimmed over the HTTP path. A bare baseline has
to be the floor for its own host; a translation of another host's floor would carry that
host's costs into the ratio.

Dispatch is a switch on the method, then on segment count, then on the first segment. There
is no router and no matching: this is the cheapest thing that can answer the endpoint set
correctly, which is what makes it a floor rather than a competitor.

## What is unusual about it

**It has no route table**, which is why every endpoint here is located by an `rb:snippet`
marker rather than derived from its path. There is no path literal to anchor on — the
switch compares segments, so `/json/small` appears nowhere in the file.

**Compression has no threshold.** The baseline compresses whatever it is handed, so
`compressed.gzip_small` is the cost of gzip turning a 125-byte payload into 125 bytes. A
framework that declines to compress a body that small will beat it on that row, and that
is the row saying so.

**The ETag is read from the fixture**, not computed. `cached` therefore measures emitting
a validator header and comparing it, not hashing a body.

**Middleware is a plain function that calls the next.** The chains for `middleware.four`
and `middleware.sixteen` are built once at startup, the way a framework registers its own,
so what a request pays is walking them.

**The template family is string concatenation.** `renderItems` builds the HTML with `+`.
`/__meta` reports `string-concat` rather than an engine name so that the `template` column
never reads this row as a renderer it is not.
