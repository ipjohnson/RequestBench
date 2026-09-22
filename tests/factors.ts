import type { Factor } from "#kit";

/**
 * What the one difference between a test and its base measures. The site walks each test's
 * base to its root and reads every step by its factor, so a step's delta is the cost of that
 * one thing. Most come from upstream's spec/endpoints.json. lookup, creation, known_path,
 * preflight, cors, form, multipart, streaming and static_file came with the rows that replaced
 * the domain family, and method now reads for any method rather than only for a write.
 * event_stream came with the sse family.
 */
export default {
  size: { reads: "a larger response body, same route and same handler" },
  depth: { reads: "a deeper static route, with no captures in it" },
  captures: { reads: "one more path segment the router has to capture" },
  authorization: { reads: "a bearer token the framework has to check" },
  outcome: { reads: "the request refused rather than served" },
  compression_wiring: { reads: "the compression middleware installed and declining" },
  compression: { reads: "the compression middleware actually compressing" },
  validators: { reads: "the framework hashing the body and writing the ETag it computed onto the response" },
  conditional: { reads: "a conditional request answered 304, with no body" },
  stale_validator: { reads: "a conditional request whose validator does not match, answered in full" },
  response_cache: { reads: "the handler skipped and a stored response replayed" },
  cache_key: { reads: "the stored response keyed by request headers as well as by path" },
  validation: { reads: "the bound body checked against a schema" },
  error_contract: { reads: "the first field error reported instead of all of them" },
  parse_failure: { reads: "a body that is not JSON at all" },
  query_params: { reads: "more query string keys parsed, coerced and echoed" },
  route: { reads: "a different route carrying the same handler, which should cost nothing" },
  header_count: { reads: "thirty request headers instead of five" },
  header_binding: {
    reads: "three request headers bound through the framework, one of them as an integer, and echoed in the response",
  },
  layers: { reads: "more no-op middleware layers in front of the handler" },
  method: { reads: "the same resource through a different HTTP method" },
  renderer: { reads: "a template rendered instead of the model serialized" },
  lookup: { reads: "a row found by the id the route captured, instead of a fixed body" },
  creation: { reads: "the body kept as a new resource and answered 201 with its location" },
  known_path: { reads: "a path the router knows, asked with a method it does not accept, instead of a path it does not know" },
  preflight: { reads: "a CORS preflight answered by the framework's CORS feature, before any handler" },
  cors: { reads: "the CORS feature checking the origin and adding its headers to a real response" },
  form: { reads: "the same fields read from a urlencoded form body instead of the query string" },
  multipart: { reads: "a multipart body with a file part instead of a urlencoded one" },
  streaming: { reads: "the rows written one per line as they are produced, with no content length" },
  static_file: { reads: "the published file served by the static-file feature instead of serialized" },
  event_stream: { reads: "the rows sent as server-sent events through the framework's own support for them, instead of as lines" },
} satisfies Record<string, Factor>;
