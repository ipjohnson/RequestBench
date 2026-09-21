import { performanceTest, text } from "#kit";

const path = "/plaintext";

/** Written by the handler as a literal, so it is the one answer with no file in tests/payloads. */
const HELLO = text("Hello, World!", "Hello, World!");

export default performanceTest({
  id: { family: "baseline", name: "plaintext" },
  path,
  about:
    "The dispatch floor. A fixed string out, with no serialiser in the way, " +
    "so what is left is the framework accepting a connection, matching a " +
    "route and writing a response. Every other row in the corpus is read " +
    "against this one.",

  request: (c) => c.get(path).okWith(HELLO).hasHeader("content-type", /^text\/plain/),
});
