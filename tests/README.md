# Tests

Each file `tests/<family>/<name>.ts` is one test: a request sent to every framework, and the
assertions its response must meet. A family groups the tests of one feature. Together the tests
are the corpus.

The tests are used in three ways. `npm test` checks that each test passes the correct answer from
the reference server in `orchestrator/test/reference.ts`, and fails a wrong answer for each of its
assertions. `npm run rb -- validate` runs the tests against a framework's container.
`npm run rb -- measure` sends each performance test's request at fixed rates and records the
latency.

| Path | What it is |
| --- | --- |
| `<family>/index.ts` | The family: its name, what it measures, what its numbers compare across, and its tests. |
| `<family>/<name>.ts` | One test. |
| `index.ts` | The list of families. |
| `factors.ts` | What each `varies` value measures. |
| `kit/` | What a test is written with: `performanceTest`, `validationTest`, `family`, the payload helpers and the client. |
| `payloads/` | The committed data every framework serves, and the answers computed from it. |
| `models/` | The zod models of the payloads, the values drawn per run, and fixed request headers. |

## The format of a test

A test file default-exports `performanceTest({...})` or `validationTest({...})` from `#kit`. For
example, `query/one.ts`:

```ts
import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/query/one?page={run.page}";

export default performanceTest({
  id: { family: "query", name: "one" },
  path,
  base: "json.small",
  varies: "query_params",
  about:
    "One query parameter parsed, coerced to an integer and written back. Read " +
    "against json.small, the difference is the query string being parsed at " +
    "all.",

  request: (c) => c.get("/query/one").query("page", String(c.run.page)).okWith(items.small, { echo: ["page"] }),
});
```

| Field | Meaning |
| --- | --- |
| `id` | `{ family, name }`. The test's id is `<family>.<name>`, such as `query.one`. The family must be the one whose list holds the test. |
| `path` | The endpoint the request calls, with `{run.<name>}` or `{draw.<name>}` where it uses a drawn value. Optional for a validation test. |
| `about` | What the test measures, and what it is read against. |
| `base` | Performance tests only. Optional. The test this one is read against. |
| `varies` | Performance tests only. Required with `base`. The one factor that differs from `base`, named in `factors.ts`. |
| `request` | A function that sends the request and asserts on the response. |
| `scope` | Validation tests only. Optional. A function of what a framework's rb.json declares, which says whether the test applies to it. |
| `leaves` | Validation tests only. Optional. How the test leaves the server changed. |

### The request

`request` receives a client, `c`. A request starts with its method: `c.get(path)`, `c.head`,
`c.post(path, body)`, `c.put`, `c.patch`, `c.delete` or `c.options`. `.header()`, `.query()`,
`.body()` and `.raw()` add to it, and the assertions chain onto the same call:

| Assertion | What it checks |
| --- | --- |
| `ok()`, `status(code, ...or)` | The status. `status` takes more than one code where frameworks differ. |
| `okWith(payload, options)` | A 200 whose body equals the payload. `echo` names the run values the body echoes, and `compressed` says whether the body must arrive gzipped. |
| `bodyIs(payload, options)` | The body alone, for a status other than 200. |
| `emptyBody()` | No body. |
| `notModified()` | A 304. |
| `hasHeader(name, match)`, `noHeader(name)` | A response header is present, optionally matching, or absent. |
| `notFound()`, `wrongMethod()` | The framework's status for a path with no route, or a method the path has no route for. |
| `rejected(...fields)`, `unparseable()` | A body refused for these fields, or refused because it did not parse. |
| `fresh()`, `replayed()` | The handler ran for this request, or a stored response was replayed instead. |

The error assertions read the status and the field names through the framework's
`client-exception`. `fresh()` and `replayed()` read `x-rb-serial`, a counter the handler increments
each time it runs.

`c.run` holds values drawn once per run and never given to a framework. `c.draw` picks a value for
each request, such as a row id. `c.once(key, make)` runs a priming request once per framework,
outside the measured window. `kit/types.ts` documents every method.

### Rules

- Compare the whole body. `okWith` and `bodyIs` compare the response with a payload the corpus
  knows exactly, so the right shape with the wrong values fails.
- Echo drawn values. A handler that binds a value writes it back in an `echo` object, and the value
  comes from `c.run`. A framework cannot answer from a table of known values.
- Read errors through the framework. A test never depends on the shape of an error body, which is
  the framework's own.
- Keep setup out of the measured window. Everything in `request` outside `c.once` is timed.
- Leave the server unchanged. A performance test that changed the server would change every test
  measured after it.
- Name a request header `x-rb-*` when no framework should act on it. A real name such as `cookie`
  or `accept-encoding` would switch a feature on.

### Payloads

Response data lives in committed files in `payloads/`, one per payload, such as
`items.large.json`. The files are the source, and nothing regenerates them. Every framework loads
them at startup from the directory `RB_PAYLOADS` names, and serializes them on every request.
`payloads/index.ts` loads each file and checks it against its model in `models/`. An answer derived
from a payload, such as one row, an echo or a rendered page, is computed in `payloads/index.ts` and
never published, so a framework has to compute it too.

A payload's format decides how a response is compared with it:

| Format | Compared as |
| --- | --- |
| `json` | The parsed value, so key order and how a number is written do not matter. |
| `lines` | One JSON value per line. |
| `events` | One JSON value per server-sent event, read the way a browser's `EventSource` reads the stream. |
| `text` | Byte for byte. |
| `html` | Text with whitespace removed at element boundaries and collapsed inside text. |

`settings.json` holds the values a framework configures itself from, such as the bearer token, the
cache's capacity and vary values, and the CORS policy. It also holds values only the tests send,
such as a wrong token and an ETag no framework computes.

### Base and factors

A performance test can name a `base`, the test it is read against, and `varies`, the one factor
that differs between them. The site walks each test's base back to a test that has none, and reads
each step as the cost of its factor. `factors.ts` says what each factor measures. The suite refuses
a base that is not a performance test, a factor missing from `factors.ts`, a chain of bases that
loops, and a factor that no test varies.

### Performance and validation tests

A performance test is checked and then measured. Every framework must pass every performance test,
or it is not measured. A performance test cannot use `scope` or `leaves`, because it is asked of
every framework and must leave the server unchanged.

A validation test is checked and never measured. It can apply to some frameworks only, through
`scope`. A framework that cannot pass a validation test lists it in its rb.json `skips`, with the
reason.

## Adding a test

To add a performance test:

1. Write `<family>/<name>.ts`. The file name is the test's name with hyphens for underscores, so
   `body.bind_small` is in `body/bind-small.ts`.
2. Add it to the `tests` list in `<family>/index.ts`. A test missing from the list never runs.
3. Give it a `base` and `varies` if it is read against another test. Add a new factor to
   `factors.ts`.
4. Put any new response data in a committed file in `payloads/`. Give it a model in `models/`, and
   load it in `payloads/index.ts`.
5. Add a route to `orchestrator/test/reference.ts` that computes the right answer from the request.
6. If the reference answers it with a framework's own error body, add the test to `REFUSALS` in
   `orchestrator/test/reference.ts`, and its answer to each contract in
   `orchestrator/test/contracts.ts`.
7. Update the tests that count performance tests. In `traffic-generator/cli.test.ts`, add a stub
   route and update `testsLive`. In `orchestrator/test/edges.test.ts`, update the list of tests
   with no base or the count of tests with one.
8. Run `npm run spec` to regenerate `frameworks/openapi.json`.
9. Run `git add` on the new files, then `npm run typecheck` and `npm test`.
10. Add the route to every framework, with a unit test marked `rb:test`, and check each framework
    with `npm run rb -- validate`. [frameworks/README.md](../frameworks/README.md) has the steps.

A validation test needs every step except 3 and 7. In step 10, a framework may list it in `skips`
instead of passing it.

Every run records the corpus version, a hash of what each performance test sends and asserts, the
payload files, and the shape of the drawn values. Two runs are comparable only when their versions
match. Adding a performance test, or changing one's request, assertions or payload, changes the
version. Changing an `about`, or adding a validation test, does not.

## Adding a family

1. Create `<family>/index.ts`, default-exporting `family({ name, about, comparable, tests })`.
   `about` says what the family measures, and `comparable` says what its numbers compare across.
   Both appear in `frameworks/openapi.json` and on the site.
2. Add the family to `index.ts`. A family missing from that list never runs.
3. Add its tests as described above.
4. Give the family an entry in every framework's rb.json `mechanisms`, and describe its wiring in
   each framework's README.
5. Add a section for it below.

## Families

`baseline` and `json` come first, because most other tests are read against one of theirs. The
rest are in alphabetical order.

### baseline

`baseline` measures the cost of answering a request when there is nothing to serialize. The
handler writes a fixed string as `text/plain`. What remains is the framework accepting the
connection, matching the route and writing the response. The other families are read against it.
A framework that is slow here is slow everywhere. Its numbers compare across every framework.

### json

`json` measures serializing a body the framework already holds, at each of the three item payload
sizes: one row, 89 rows and 1,425 rows. The framework loads the payload at startup and serializes
it on every request. Serving the file's bytes instead would measure a copy. Comparing the sizes
separates a framework with a fast serializer from one with a fast request path. Many families serve
the same payloads, so their difference from `json` is the cost of their feature alone. Its numbers
compare across every framework at one size, and across the sizes as a set.

### authorized

`authorized` measures the framework's own authorization mechanism checking a bearer token before
the handler runs. The token is an opaque string from `settings.json`, so no cryptography is
measured. The family covers a token that is accepted and one that is refused with 403. The refused
token differs from the accepted one only in its last character, so the check has to compare the
whole string. Its numbers compare across every framework.

### body

`body` measures the JSON body parser and the validator. The request is an order with a customer
id, a status and a list of lines, sent at two sizes. One route parses and binds the order without
validating it. Its answer carries a count of the values it found and the bytes it received, which
shows the body was parsed rather than copied back. Another route validates the same order against
a schema and answers the same way, so the difference between the two is the validator alone. The
family also measures refusals, with an order that parses but breaks every rule. One route reports
every bad field and another stops at the first, which compares the two error contracts. Its
numbers compare across every framework.

### cache

`cache` measures the framework's response cache: the handler skipped and a stored response
replayed. Some responses are keyed by path alone, and others by request headers too, which
multiplies the entries the store holds. Each test asserts that the response was replayed rather
than produced by the handler. `settings.json` gives the cache's capacity, its lifetime and the
header values. Several frameworks have no response cache of their own and use a package chosen for
them, so the numbers compare across cache stores rather than across frameworks.

### compressed

`compressed` measures outbound gzip. Each body is requested twice. Asking for no encoding leaves
the compression middleware installed but declining, which measures the cost of the wiring. Asking
for gzip makes it compress, and the difference between the two is the compression itself. A
framework may decline to compress a body too small to benefit, and the test on that body accepts
either answer. Each test asserts that the handler ran, so no stored response can stand in. Its
numbers compare across every framework.

### cors

`cors` measures the framework's own CORS feature. Each framework attaches one policy, read from
`settings.json`, to the `/cors` routes and nowhere else. The policy names one origin, one method,
one custom header and a max age. It names its origin rather than `*`, because `*` compares nothing
and an API that sends credentials cannot use it. The performance tests measure the preflight,
which the CORS feature answers before any handler runs, and the real cross-origin request, which
the policy lets through to the handler. The policy must also refuse other origins, stay off routes
outside `/cors`, and send `Vary: Origin`, which validation tests check. A framework whose CORS
feature can only cover the whole application runs it on every request, and says so in its README.
Its numbers compare across every framework.

### errors

`errors` measures what it costs to refuse a request at each stage: the router finding no route,
the router finding the path but not the method, the handler finding no row, and the parser failing
on a body that is not JSON. A framework that walks its whole route table before giving up pays for
it here. A router answers a method it does not have with 405 or 404 depending on how it matches, so
the status is read from the framework's declaration. A parser failure often has a different status
from a validation failure in the same framework. The numbers compare across every framework on the
status and on whether the response has a body. The body's shape is the framework's own and is not
compared.

### etag

`etag` measures the framework's own conditional-request support. The framework computes an ETag
over the body it is about to send and writes it on the response. A request whose `If-None-Match`
matches is answered 304 with no body, and one that does not match is answered in full. The ETag's
format is the framework's own, so a test first asks the framework for its tag, outside the measured
window, and sends it back. A 304 saves only the write, because the body is built and hashed before
the tags are compared. The numbers compare across every framework at one body size. They do not
compare across sizes, because the difference between sizes is mostly the hash rate.

### forms

`forms` measures request bodies that are not JSON, bound through the framework's own form support.
A urlencoded form carries the eight search fields the `query` family sends in a query string, and
answers the same, so the difference is where the fields came from. A multipart upload carries two
fields and a 32 KB text file. Its answer includes the file's name and size, so the handler has to
read the whole part. Its numbers compare across every framework.

### headers

`headers` measures the request header map. A request carries five headers or thirty. The extra
twenty-five are what a browser and the proxies in front of it add, about a kilobyte, and each is
named `x-rb-*` so that none switches a feature on. The headers are first left unread, then three of
them are bound through the framework, one as an integer, and echoed. Unread against bound separates
binding from reading the header map. Five against thirty shows whether the binder pays for headers
it was not asked for. Its numbers compare across every framework.

### items

`items` measures every HTTP method on one resource, `/items/{id}`, over the rows of the large
payload. It reads a row by the id in the path, asks for its headers alone, and writes it through
each write method. The id is drawn for each request, so requests spread across the rows. Each
request sends one row-sized body or none and answers one row or nothing, so the methods differ in
what the framework does rather than in how much it serializes. A performance test may not leave
the server changed, so the writes answer as if they had written and store nothing. Its numbers
compare across every framework.

### middleware

`middleware` measures the cost of each middleware layer. A handler that serves the small payload
sits behind a number of no-op layers, starting from none. Each layer calls the next and does
nothing else, so the slope is the per-layer cost. The route with no layers should cost the same as
serving the small payload in `json`. If it does not, the framework is paying for the route rather
than for the layers. Its numbers compare across every framework.

### parameters

`parameters` measures the router capturing path segments. Each captured segment is bound as an
integer and echoed. A static route of the same depth holds the depth constant, so the difference
is capturing rather than matching a longer path. The values are drawn per run, so a framework
cannot answer from a table. Its numbers compare across every framework.

### query

`query` measures parsing the query string: splitting it, percent-decoding it and converting the
values to their types. The values are echoed and put to no other use. The family goes from one
parameter to eight, which is what a real search endpoint carries: a page and a size, a sort, a text
term and four filters. Its numbers compare across every framework.

### sse

`sse` measures server-sent events written through the framework's own support for them. The
response is `text/event-stream`, with the medium payload's rows as one event each and no
`Content-Length`. The `stream` family writes the same rows as lines, so the difference is the event
framing. The comparison reads the stream the way a browser's `EventSource` does, so comments and
line endings do not matter. A framework with no support of its own writes the events by hand and
says so in its README. Its numbers compare across every framework.

### static

`static` measures the framework's static-file feature. It serves `items.large.json` from the
payload directory, with its `Last-Modified`, to a request that accepts gzip as a browser's does.
The body is compared byte for byte after decoding, so the file may go out as it is or compressed.
The `json` family serializes the same rows, so the difference is a file served against rows
serialized. This is the one family where serving a file's bytes is the point. `Last-Modified` is checked rather than an ETag,
because Go's file server sends no ETag. Its numbers compare across every framework.

### stream

`stream` measures a response written in parts as it is produced, rather than serialized whole and
sent with its length. The medium payload's rows are written one per line as `application/x-ndjson`,
with no `Content-Length`. The `json` family serializes the same rows in one body, so the difference
is the streaming path and a write per row. Its numbers compare across every framework.

### template

`template` measures server-side rendering through the framework's own view layer. It renders a
fixed HTML page from the same rows the `json` family serializes. The comparison ignores whitespace
between elements, so an engine's indentation does not matter. Rendering more rows shows the engine's
per-row cost. Rendering is partly the engine's work, so the numbers compare across template engines
rather than across frameworks.
