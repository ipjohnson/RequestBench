/**
 * Headers the corpus sends that no framework reads. The values a framework
 * configures itself from, such as the token and the vary values, are published in
 * tests/payloads/settings.json instead.
 */

/**
 * What a browser and the proxies in front of it add, at realistic lengths, which
 * puts the larger header row at about a kilobyte.
 *
 * Every name is this repository's own `x-rb-*`, because a real one would switch
 * something else on: `accept-encoding` compression, `cookie` a cookie parser,
 * `if-none-match` conditional handling.
 */
export const BROWSER_AND_PROXY: readonly (readonly [string, string])[] = [
  ["x-rb-user-agent", "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0"],
  ["x-rb-accept", "application/json, text/plain, */*"],
  ["x-rb-accept-language", "en-US,en;q=0.5"],
  ["x-rb-accept-encoding", "gzip, deflate, br, zstd"],
  ["x-rb-referer", "https://shop.example.com/orders?page=2"],
  ["x-rb-origin", "https://shop.example.com"],
  ["x-rb-sec-fetch-dest", "empty"],
  ["x-rb-sec-fetch-mode", "cors"],
  ["x-rb-sec-fetch-site", "same-origin"],
  ["x-rb-priority", "u=4"],
  ["x-rb-pragma", "no-cache"],
  ["x-rb-cache-control", "no-cache"],
  ["x-rb-te", "trailers"],
  ["x-rb-dnt", "1"],
  ["x-rb-sec-gpc", "1"],
  ["x-rb-forwarded-for", "203.0.113.195, 198.51.100.17"],
  ["x-rb-forwarded-proto", "https"],
  ["x-rb-forwarded-host", "shop.example.com"],
  ["x-rb-forwarded-port", "443"],
  ["x-rb-real-ip", "203.0.113.195"],
  ["x-rb-via", "1.1 cdn-edge, 1.1 envoy"],
  ["x-rb-traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"],
  ["x-rb-tracestate", "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"],
  ["x-rb-envoy-attempt-count", "1"],
  ["x-rb-amzn-trace-id", "Root=1-66e9b7c2-5759e988bd862e3fe1be46a9"],
];
